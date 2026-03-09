-- Phase 1a, 1b, 1c: Idempotent single-appointment creation, series ledger,
-- status transition enforcement, treatment plan validation on all creates.

-- ============================================================
-- 1) Series idempotency ledger table
-- ============================================================

CREATE TABLE IF NOT EXISTS public.appointment_series_requests (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  clinic_id uuid NOT NULL REFERENCES public.clinics(id),
  idempotency_key text NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  appointment_ids uuid[] NOT NULL,
  UNIQUE (clinic_id, idempotency_key)
);

ALTER TABLE public.appointment_series_requests ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view own clinic series requests"
  ON public.appointment_series_requests FOR SELECT
  USING (clinic_id = public.get_user_clinic_id());

CREATE POLICY "Users can insert own clinic series requests"
  ON public.appointment_series_requests FOR INSERT
  WITH CHECK (clinic_id = public.get_user_clinic_id());

-- ============================================================
-- 2) create_appointment RPC (single appointment, idempotent)
-- Replaces direct .insert() path in appointment.service.ts
-- ============================================================

CREATE OR REPLACE FUNCTION public.create_appointment(
  p_clinic_id uuid,
  p_patient_id uuid,
  p_therapist_id uuid,
  p_start_time timestamptz,
  p_end_time timestamptz,
  p_treatment_plan_id uuid DEFAULT NULL,
  p_notes text DEFAULT NULL,
  p_idempotency_key text DEFAULT NULL
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY INVOKER
AS $$
DECLARE
  v_plan public.treatment_plans%ROWTYPE;
  v_created public.appointments%ROWTYPE;
  v_existing public.appointments%ROWTYPE;
  v_note text := NULLIF(BTRIM(COALESCE(p_notes, '')), '');
  v_idempotency_key text := NULLIF(BTRIM(COALESCE(p_idempotency_key, '')), '');
  v_constraint text;
  v_already_created boolean := false;
BEGIN
  -- Validate clinic context
  IF p_clinic_id IS NULL THEN
    RAISE EXCEPTION USING MESSAGE = 'INVALID_CLINIC_ID';
  END IF;

  IF NOT EXISTS (
    SELECT 1
    FROM public.profiles pr
    WHERE pr.id = auth.uid()
      AND pr.clinic_id = p_clinic_id
  ) THEN
    RAISE EXCEPTION USING MESSAGE = 'CLINIC_SCOPE_MISMATCH';
  END IF;

  -- Validate time range
  IF p_start_time IS NULL
    OR p_end_time IS NULL
    OR p_end_time <= p_start_time
    OR (p_end_time - p_start_time) > interval '12 hours' THEN
    RAISE EXCEPTION USING MESSAGE = 'INVALID_APPOINTMENT_RANGE';
  END IF;

  -- Validate therapist
  IF p_therapist_id IS NULL THEN
    RAISE EXCEPTION USING MESSAGE = 'PRACTITIONER_REQUIRED';
  END IF;

  -- Validate idempotency key
  IF v_idempotency_key IS NULL THEN
    RAISE EXCEPTION USING MESSAGE = 'IDEMPOTENCY_KEY_REQUIRED';
  END IF;

  -- Validate treatment plan if provided (Phase 1c)
  IF p_treatment_plan_id IS NOT NULL THEN
    SELECT *
    INTO v_plan
    FROM public.treatment_plans tp
    WHERE tp.id = p_treatment_plan_id
      AND tp.clinic_id = p_clinic_id
    FOR UPDATE;

    IF NOT FOUND THEN
      RAISE EXCEPTION USING MESSAGE = 'TREATMENT_PLAN_NOT_FOUND';
    END IF;

    IF v_plan.status <> 'active'::public.treatment_status THEN
      RAISE EXCEPTION USING MESSAGE = 'TREATMENT_PLAN_NOT_ACTIVE';
    END IF;

    IF v_plan.patient_id <> p_patient_id THEN
      RAISE EXCEPTION USING MESSAGE = 'PATIENT_PLAN_MISMATCH';
    END IF;
  END IF;

  -- Idempotency check
  SELECT *
  INTO v_existing
  FROM public.appointments a
  WHERE a.clinic_id = p_clinic_id
    AND a.idempotency_key = v_idempotency_key
  LIMIT 1;

  IF FOUND THEN
    RETURN jsonb_build_object(
      'appointmentId', v_existing.id,
      'alreadyCreated', true,
      'message', 'APPOINTMENT_ALREADY_CREATED'
    );
  END IF;

  -- Insert with conflict handling
  BEGIN
    INSERT INTO public.appointments (
      clinic_id,
      patient_id,
      therapist_id,
      treatment_plan_id,
      start_time,
      end_time,
      status,
      notes,
      idempotency_key
    )
    VALUES (
      p_clinic_id,
      p_patient_id,
      p_therapist_id,
      p_treatment_plan_id,
      p_start_time,
      p_end_time,
      'scheduled'::public.appointment_status,
      v_note,
      v_idempotency_key
    )
    RETURNING * INTO v_created;
  EXCEPTION
    WHEN SQLSTATE '23505' THEN
      GET STACKED DIAGNOSTICS v_constraint = CONSTRAINT_NAME;

      IF v_constraint = 'uq_appointments_clinic_idempotency' THEN
        SELECT *
        INTO v_existing
        FROM public.appointments a
        WHERE a.clinic_id = p_clinic_id
          AND a.idempotency_key = v_idempotency_key
        LIMIT 1;

        IF FOUND THEN
          RETURN jsonb_build_object(
            'appointmentId', v_existing.id,
            'alreadyCreated', true,
            'message', 'APPOINTMENT_ALREADY_CREATED'
          );
        END IF;
      END IF;

      -- Re-raise other unique violations (e.g. exclusion constraint)
      RAISE;
    WHEN exclusion_violation THEN
      RAISE EXCEPTION USING MESSAGE = 'APPOINTMENT_DOCTOR_CONFLICT';
  END;

  RETURN jsonb_build_object(
    'appointmentId', v_created.id,
    'alreadyCreated', false,
    'message', NULL
  );
END;
$$;

-- ============================================================
-- 3) Extend create_appointment_series with ledger idempotency
-- + treatment plan validation (Phase 1c)
-- ============================================================

CREATE OR REPLACE FUNCTION public.create_appointment_series(
  p_clinic_id uuid,
  p_patient_id uuid,
  p_therapist_id uuid,
  p_treatment_plan_id uuid DEFAULT NULL,
  p_notes text DEFAULT NULL,
  p_occurrences jsonb DEFAULT '[]'::jsonb,
  p_idempotency_key text DEFAULT NULL
)
RETURNS jsonb
LANGUAGE plpgsql
AS $$
DECLARE
  v_series_id uuid := gen_random_uuid();
  v_conflicts jsonb := '[]'::jsonb;
  v_idempotency_key text := NULLIF(BTRIM(COALESCE(p_idempotency_key, '')), '');
  v_existing_request public.appointment_series_requests%ROWTYPE;
  v_plan public.treatment_plans%ROWTYPE;
  v_created_ids uuid[];
BEGIN
  IF p_therapist_id IS NULL THEN
    RAISE EXCEPTION USING MESSAGE = 'Doctor is required';
  END IF;

  IF jsonb_typeof(p_occurrences) <> 'array' OR jsonb_array_length(p_occurrences) = 0 THEN
    RAISE EXCEPTION USING MESSAGE = 'Series occurrences are required';
  END IF;

  -- Validate time ranges
  IF EXISTS (
    WITH parsed AS (
      SELECT
        row_number() OVER () AS row_num,
        (occ->>'start_time')::timestamptz AS start_time,
        (occ->>'end_time')::timestamptz AS end_time
      FROM jsonb_array_elements(p_occurrences) AS occ
    )
    SELECT 1
    FROM parsed
    WHERE start_time IS NULL
      OR end_time IS NULL
      OR end_time <= start_time
      OR (end_time - start_time) > interval '12 hours'
  ) THEN
    RAISE EXCEPTION USING MESSAGE = 'Series has invalid start/end time or duration';
  END IF;

  -- Check for internal overlaps
  IF EXISTS (
    WITH parsed AS (
      SELECT
        row_number() OVER () AS row_num,
        (occ->>'start_time')::timestamptz AS start_time,
        (occ->>'end_time')::timestamptz AS end_time
      FROM jsonb_array_elements(p_occurrences) AS occ
    )
    SELECT 1
    FROM parsed a
    JOIN parsed b ON a.row_num < b.row_num
    WHERE tstzrange(a.start_time, a.end_time, '[)') && tstzrange(b.start_time, b.end_time, '[)')
  ) THEN
    RAISE EXCEPTION USING MESSAGE = 'Series occurrences overlap each other';
  END IF;

  -- Treatment plan validation (Phase 1c)
  IF p_treatment_plan_id IS NOT NULL THEN
    SELECT *
    INTO v_plan
    FROM public.treatment_plans tp
    WHERE tp.id = p_treatment_plan_id
      AND tp.clinic_id = p_clinic_id
    FOR UPDATE;

    IF NOT FOUND THEN
      RAISE EXCEPTION USING MESSAGE = 'TREATMENT_PLAN_NOT_FOUND';
    END IF;

    IF v_plan.status <> 'active'::public.treatment_status THEN
      RAISE EXCEPTION USING MESSAGE = 'TREATMENT_PLAN_NOT_ACTIVE';
    END IF;

    IF v_plan.patient_id <> p_patient_id THEN
      RAISE EXCEPTION USING MESSAGE = 'PATIENT_PLAN_MISMATCH';
    END IF;
  END IF;

  -- Ledger-based idempotency check
  IF v_idempotency_key IS NOT NULL THEN
    SELECT *
    INTO v_existing_request
    FROM public.appointment_series_requests asr
    WHERE asr.clinic_id = p_clinic_id
      AND asr.idempotency_key = v_idempotency_key
    LIMIT 1;

    IF FOUND THEN
      -- Return canonical data from appointments table, not snapshot
      RETURN jsonb_build_object(
        'hasConflict', false,
        'alreadyCreated', true,
        'seriesId', NULL,
        'createdCount', cardinality(v_existing_request.appointment_ids),
        'appointmentIds', to_jsonb(v_existing_request.appointment_ids)
      );
    END IF;
  END IF;

  -- Check for external conflicts
  SELECT COALESCE(
    jsonb_agg(
      jsonb_build_object(
        'occurrenceStartTime', c.occurrence_start_time,
        'occurrenceEndTime', c.occurrence_end_time,
        'conflictingAppointmentId', c.conflicting_appointment_id,
        'conflictingStartTime', c.conflicting_start_time,
        'conflictingEndTime', c.conflicting_end_time
      )
      ORDER BY c.occurrence_start_time
    ),
    '[]'::jsonb
  )
  INTO v_conflicts
  FROM (
    WITH parsed AS (
      SELECT
        row_number() OVER () AS row_num,
        (occ->>'start_time')::timestamptz AS start_time,
        (occ->>'end_time')::timestamptz AS end_time
      FROM jsonb_array_elements(p_occurrences) AS occ
    )
    SELECT DISTINCT ON (p.row_num, a.id)
      p.start_time AS occurrence_start_time,
      p.end_time AS occurrence_end_time,
      a.id AS conflicting_appointment_id,
      a.start_time AS conflicting_start_time,
      a.end_time AS conflicting_end_time
    FROM parsed p
    JOIN public.appointments a
      ON a.clinic_id = p_clinic_id
      AND a.therapist_id = p_therapist_id
      AND a.status IN ('scheduled'::public.appointment_status, 'checked_in'::public.appointment_status)
      AND tstzrange(p.start_time, p.end_time, '[)') && tstzrange(a.start_time, a.end_time, '[)')
    ORDER BY p.row_num, a.id
  ) AS c;

  IF jsonb_array_length(v_conflicts) > 0 THEN
    RETURN jsonb_build_object(
      'hasConflict', true,
      'code', 'APPOINTMENT_DOCTOR_CONFLICT',
      'conflicts', v_conflicts
    );
  END IF;

  -- Insert all appointments atomically
  WITH inserted AS (
    INSERT INTO public.appointments (
      clinic_id,
      patient_id,
      therapist_id,
      treatment_plan_id,
      start_time,
      end_time,
      status,
      notes,
      series_id,
      series_index
    )
    SELECT
      p_clinic_id,
      p_patient_id,
      p_therapist_id,
      p_treatment_plan_id,
      p.start_time,
      p.end_time,
      'scheduled'::public.appointment_status,
      p_notes,
      v_series_id,
      p.series_index
    FROM (
      SELECT
        COALESCE((occ->>'series_index')::integer, row_number() OVER ()) AS series_index,
        (occ->>'start_time')::timestamptz AS start_time,
        (occ->>'end_time')::timestamptz AS end_time
      FROM jsonb_array_elements(p_occurrences) AS occ
    ) AS p
    ORDER BY p.series_index
    RETURNING id
  )
  SELECT array_agg(id ORDER BY id) INTO v_created_ids FROM inserted;

  -- Write to ledger (idempotency record)
  IF v_idempotency_key IS NOT NULL THEN
    BEGIN
      INSERT INTO public.appointment_series_requests (
        clinic_id,
        idempotency_key,
        appointment_ids
      )
      VALUES (
        p_clinic_id,
        v_idempotency_key,
        v_created_ids
      );
    EXCEPTION
      WHEN unique_violation THEN
        -- Concurrent insert won the race; this is fine since the appointments
        -- were already inserted within this transaction
        NULL;
    END;
  END IF;

  RETURN jsonb_build_object(
    'hasConflict', false,
    'alreadyCreated', false,
    'seriesId', v_series_id,
    'createdCount', jsonb_array_length(p_occurrences)
  );
END;
$$;

-- ============================================================
-- 4) Appointment status transition trigger (Phase 1b)
-- ============================================================

CREATE OR REPLACE FUNCTION public.validate_appointment_status_transition()
RETURNS trigger
LANGUAGE plpgsql
AS $$
DECLARE
  v_old_status public.appointment_status;
  v_new_status public.appointment_status;
  v_bypass_reopen text;
BEGIN
  -- Skip if status hasn't changed
  IF NEW.status IS NOT DISTINCT FROM OLD.status THEN
    RETURN NEW;
  END IF;

  v_old_status := OLD.status;
  v_new_status := NEW.status;

  -- Valid transitions:
  -- scheduled   → checked_in, completed, cancelled, no_show
  -- checked_in  → completed, cancelled, no_show
  -- completed   → scheduled (reopen bypass only)
  -- cancelled   → (terminal)
  -- no_show     → scheduled (reschedule)

  CASE v_old_status
    WHEN 'scheduled' THEN
      IF v_new_status NOT IN ('checked_in', 'completed', 'cancelled', 'no_show') THEN
        RAISE EXCEPTION USING MESSAGE = 'INVALID_STATUS_TRANSITION';
      END IF;

    WHEN 'checked_in' THEN
      IF v_new_status NOT IN ('completed', 'cancelled', 'no_show') THEN
        RAISE EXCEPTION USING MESSAGE = 'INVALID_STATUS_TRANSITION';
      END IF;

    WHEN 'completed' THEN
      -- Only allow completed → scheduled via reopen bypass
      v_bypass_reopen := current_setting('app.appointment_reopen', true);
      IF v_new_status <> 'scheduled' OR v_bypass_reopen IS NULL OR v_bypass_reopen <> 'true' THEN
        RAISE EXCEPTION USING MESSAGE = 'INVALID_STATUS_TRANSITION';
      END IF;

    WHEN 'cancelled' THEN
      -- Terminal state — no transitions allowed
      RAISE EXCEPTION USING MESSAGE = 'INVALID_STATUS_TRANSITION';

    WHEN 'no_show' THEN
      IF v_new_status <> 'scheduled' THEN
        RAISE EXCEPTION USING MESSAGE = 'INVALID_STATUS_TRANSITION';
      END IF;

    ELSE
      RAISE EXCEPTION USING MESSAGE = 'INVALID_STATUS_TRANSITION';
  END CASE;

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS validate_appointment_status_transition ON public.appointments;

CREATE TRIGGER validate_appointment_status_transition
BEFORE UPDATE OF status
ON public.appointments
FOR EACH ROW
EXECUTE FUNCTION public.validate_appointment_status_transition();

-- ============================================================
-- 5) Update reopen RPC to set bypass session variable
-- ============================================================

CREATE OR REPLACE FUNCTION public.reopen_completed_appointment(
  p_clinic_id uuid,
  p_appointment_id uuid
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY INVOKER
AS $$
DECLARE
  v_appt public.appointments%ROWTYPE;
  v_session_id uuid;
  v_is_admin boolean := public.is_clinic_admin();
  v_session_voided boolean := false;
BEGIN
  SELECT * INTO v_appt
  FROM public.appointments a
  WHERE a.id = p_appointment_id
    AND a.clinic_id = p_clinic_id
  FOR UPDATE;

  IF NOT FOUND THEN
    RAISE EXCEPTION USING MESSAGE = 'APPOINTMENT_NOT_FOUND';
  END IF;

  IF v_appt.status <> 'completed'::public.appointment_status THEN
    RAISE EXCEPTION USING MESSAGE = 'NOT_COMPLETED';
  END IF;

  IF NOT v_is_admin THEN
    IF v_appt.completed_at IS NULL OR now() - v_appt.completed_at > interval '24 hours' THEN
      RAISE EXCEPTION USING MESSAGE = 'REOPEN_WINDOW_EXPIRED';
    END IF;
  END IF;

  SELECT ts.id INTO v_session_id
  FROM public.treatment_sessions ts
  WHERE ts.appointment_id = v_appt.id
    AND ts.status <> 'voided'::public.session_status
  ORDER BY ts.finalized_at DESC, ts.created_at DESC
  LIMIT 1
  FOR UPDATE;

  IF v_session_id IS NOT NULL THEN
    UPDATE public.treatment_sessions
    SET
      status = 'voided'::public.session_status,
      voided_at = now(),
      voided_by = auth.uid()
    WHERE id = v_session_id;

    v_session_voided := true;
  END IF;

  -- Set transaction-local bypass flag for status transition trigger
  PERFORM set_config('app.appointment_reopen', 'true', true);

  UPDATE public.appointments
  SET
    status = COALESCE(v_appt.status_before_completion, 'scheduled'::public.appointment_status),
    reopened_at = now(),
    reopened_by = auth.uid()
  WHERE id = v_appt.id;

  RETURN jsonb_build_object(
    'reopened', true,
    'sessionVoided', v_session_voided,
    'message', CASE WHEN v_session_voided THEN NULL ELSE 'REOPEN_NO_ACTIVE_SESSION' END
  );
END;
$$;
