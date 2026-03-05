-- Treatment-linked appointment continuity:
-- idempotent linked booking + server-side relationship guardrails + linked appointment bulk read.

ALTER TABLE public.appointments
  ADD COLUMN IF NOT EXISTS idempotency_key text;

ALTER TABLE public.appointments
  DROP CONSTRAINT IF EXISTS appointments_idempotency_key_non_blank_check;

ALTER TABLE public.appointments
  ADD CONSTRAINT appointments_idempotency_key_non_blank_check
  CHECK (idempotency_key IS NULL OR char_length(btrim(idempotency_key)) > 0);

CREATE UNIQUE INDEX IF NOT EXISTS uq_appointments_clinic_idempotency
  ON public.appointments(clinic_id, idempotency_key)
  WHERE idempotency_key IS NOT NULL;

CREATE INDEX IF NOT EXISTS idx_appointments_clinic_plan_start_desc
  ON public.appointments(clinic_id, treatment_plan_id, start_time DESC)
  WHERE treatment_plan_id IS NOT NULL;

CREATE OR REPLACE FUNCTION public.validate_appointment_relationship_scope()
RETURNS trigger
LANGUAGE plpgsql
AS $$
DECLARE
  v_patient_clinic uuid;
  v_therapist_clinic uuid;
  v_plan_clinic uuid;
  v_plan_patient uuid;
BEGIN
  IF TG_OP = 'UPDATE'
    AND NEW.clinic_id IS NOT DISTINCT FROM OLD.clinic_id
    AND NEW.patient_id IS NOT DISTINCT FROM OLD.patient_id
    AND NEW.therapist_id IS NOT DISTINCT FROM OLD.therapist_id
    AND NEW.treatment_plan_id IS NOT DISTINCT FROM OLD.treatment_plan_id THEN
    RETURN NEW;
  END IF;

  SELECT p.clinic_id
  INTO v_patient_clinic
  FROM public.patients p
  WHERE p.id = NEW.patient_id;

  IF v_patient_clinic IS NULL THEN
    RAISE EXCEPTION USING MESSAGE = 'PATIENT_NOT_FOUND';
  END IF;

  IF v_patient_clinic <> NEW.clinic_id THEN
    RAISE EXCEPTION USING MESSAGE = 'PATIENT_CLINIC_MISMATCH';
  END IF;

  IF NEW.therapist_id IS NOT NULL THEN
    SELECT pr.clinic_id
    INTO v_therapist_clinic
    FROM public.profiles pr
    WHERE pr.id = NEW.therapist_id;

    IF v_therapist_clinic IS NULL THEN
      RAISE EXCEPTION USING MESSAGE = 'THERAPIST_NOT_FOUND';
    END IF;

    IF v_therapist_clinic <> NEW.clinic_id THEN
      RAISE EXCEPTION USING MESSAGE = 'THERAPIST_CLINIC_MISMATCH';
    END IF;
  END IF;

  IF NEW.treatment_plan_id IS NOT NULL THEN
    SELECT tp.clinic_id, tp.patient_id
    INTO v_plan_clinic, v_plan_patient
    FROM public.treatment_plans tp
    WHERE tp.id = NEW.treatment_plan_id;

    IF v_plan_clinic IS NULL THEN
      RAISE EXCEPTION USING MESSAGE = 'TREATMENT_PLAN_NOT_FOUND';
    END IF;

    IF v_plan_clinic <> NEW.clinic_id THEN
      RAISE EXCEPTION USING MESSAGE = 'TREATMENT_PLAN_CLINIC_MISMATCH';
    END IF;

    IF v_plan_patient <> NEW.patient_id THEN
      RAISE EXCEPTION USING MESSAGE = 'PATIENT_PLAN_MISMATCH';
    END IF;
  END IF;

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS validate_appointment_relationship_scope ON public.appointments;

CREATE TRIGGER validate_appointment_relationship_scope
BEFORE INSERT OR UPDATE OF clinic_id, patient_id, therapist_id, treatment_plan_id
ON public.appointments
FOR EACH ROW
EXECUTE FUNCTION public.validate_appointment_relationship_scope();

CREATE OR REPLACE FUNCTION public.create_treatment_linked_appointment(
  p_clinic_id uuid,
  p_treatment_plan_id uuid,
  p_therapist_id uuid,
  p_start_time timestamptz,
  p_end_time timestamptz,
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
BEGIN
  IF p_clinic_id IS NULL THEN
    RAISE EXCEPTION USING MESSAGE = 'INVALID_CLINIC_ID';
  END IF;

  IF p_start_time IS NULL
    OR p_end_time IS NULL
    OR p_end_time <= p_start_time
    OR (p_end_time - p_start_time) > interval '12 hours' THEN
    RAISE EXCEPTION USING MESSAGE = 'INVALID_APPOINTMENT_RANGE';
  END IF;

  IF p_therapist_id IS NULL THEN
    RAISE EXCEPTION USING MESSAGE = 'PRACTITIONER_REQUIRED';
  END IF;

  IF v_idempotency_key IS NULL THEN
    RAISE EXCEPTION USING MESSAGE = 'IDEMPOTENCY_KEY_REQUIRED';
  END IF;

  IF NOT EXISTS (
    SELECT 1
    FROM public.profiles pr
    WHERE pr.id = auth.uid()
      AND pr.clinic_id = p_clinic_id
  ) THEN
    RAISE EXCEPTION USING MESSAGE = 'CLINIC_SCOPE_MISMATCH';
  END IF;

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

  SELECT *
  INTO v_existing
  FROM public.appointments a
  WHERE a.clinic_id = p_clinic_id
    AND a.idempotency_key = v_idempotency_key
  ORDER BY a.created_at DESC
  LIMIT 1;

  IF FOUND THEN
    RETURN jsonb_build_object(
      'appointmentId', v_existing.id,
      'alreadyCreated', true,
      'message', 'APPOINTMENT_ALREADY_CREATED',
      'appointment', jsonb_build_object(
        'id', v_existing.id,
        'patientId', v_existing.patient_id,
        'therapistId', v_existing.therapist_id,
        'treatmentPlanId', v_existing.treatment_plan_id,
        'startTime', v_existing.start_time,
        'endTime', v_existing.end_time,
        'status', v_existing.status,
        'notes', v_existing.notes
      ),
      'treatmentSummary', jsonb_build_object(
        'id', v_plan.id,
        'patientId', v_plan.patient_id,
        'name', v_plan.name,
        'status', v_plan.status,
        'totalSessions', v_plan.total_sessions
      )
    );
  END IF;

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
      v_plan.patient_id,
      p_therapist_id,
      v_plan.id,
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
        ORDER BY a.created_at DESC
        LIMIT 1;

        IF FOUND THEN
          RETURN jsonb_build_object(
            'appointmentId', v_existing.id,
            'alreadyCreated', true,
            'message', 'APPOINTMENT_ALREADY_CREATED',
            'appointment', jsonb_build_object(
              'id', v_existing.id,
              'patientId', v_existing.patient_id,
              'therapistId', v_existing.therapist_id,
              'treatmentPlanId', v_existing.treatment_plan_id,
              'startTime', v_existing.start_time,
              'endTime', v_existing.end_time,
              'status', v_existing.status,
              'notes', v_existing.notes
            ),
            'treatmentSummary', jsonb_build_object(
              'id', v_plan.id,
              'patientId', v_plan.patient_id,
              'name', v_plan.name,
              'status', v_plan.status,
              'totalSessions', v_plan.total_sessions
            )
          );
        END IF;
      END IF;

      RAISE;
  END;

  RETURN jsonb_build_object(
    'appointmentId', v_created.id,
    'alreadyCreated', false,
    'message', NULL,
    'appointment', jsonb_build_object(
      'id', v_created.id,
      'patientId', v_created.patient_id,
      'therapistId', v_created.therapist_id,
      'treatmentPlanId', v_created.treatment_plan_id,
      'startTime', v_created.start_time,
      'endTime', v_created.end_time,
      'status', v_created.status,
      'notes', v_created.notes
    ),
    'treatmentSummary', jsonb_build_object(
      'id', v_plan.id,
      'patientId', v_plan.patient_id,
      'name', v_plan.name,
      'status', v_plan.status,
      'totalSessions', v_plan.total_sessions
    )
  );
END;
$$;

CREATE OR REPLACE FUNCTION public.get_treatment_linked_appointments_bulk(
  p_clinic_id uuid,
  p_plan_ids uuid[],
  p_now timestamptz DEFAULT now(),
  p_limit_per_plan integer DEFAULT 3
)
RETURNS TABLE (
  plan_id uuid,
  appointment_id uuid,
  start_time timestamptz,
  end_time timestamptz,
  status public.appointment_status
)
LANGUAGE plpgsql
SECURITY INVOKER
STABLE
AS $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM public.profiles pr
    WHERE pr.id = auth.uid()
      AND pr.clinic_id = p_clinic_id
  ) THEN
    RAISE EXCEPTION USING MESSAGE = 'CLINIC_SCOPE_MISMATCH';
  END IF;

  IF p_plan_ids IS NULL OR cardinality(p_plan_ids) = 0 THEN
    RETURN;
  END IF;

  IF cardinality(p_plan_ids) > 100 THEN
    RAISE EXCEPTION USING MESSAGE = 'PLAN_IDS_TOO_LARGE';
  END IF;

  IF p_limit_per_plan IS NULL OR p_limit_per_plan < 1 OR p_limit_per_plan > 10 THEN
    RAISE EXCEPTION USING MESSAGE = 'INVALID_LIMIT_PER_PLAN';
  END IF;

  RETURN QUERY
  WITH ranked AS (
    SELECT
      a.treatment_plan_id AS plan_id,
      a.id AS appointment_id,
      a.start_time,
      a.end_time,
      a.status,
      ROW_NUMBER() OVER (
        PARTITION BY a.treatment_plan_id
        ORDER BY
          CASE
            WHEN a.status IN ('scheduled', 'checked_in') AND a.start_time >= p_now THEN 0
            WHEN a.status IN ('scheduled', 'checked_in') THEN 1
            WHEN a.status = 'completed' THEN 2
            WHEN a.status = 'no_show' THEN 3
            ELSE 4
          END ASC,
          CASE
            WHEN a.status IN ('scheduled', 'checked_in') AND a.start_time >= p_now THEN a.start_time
          END ASC NULLS LAST,
          CASE
            WHEN NOT (a.status IN ('scheduled', 'checked_in') AND a.start_time >= p_now) THEN a.start_time
          END DESC NULLS LAST,
          a.id ASC
      ) AS rn
    FROM public.appointments a
    WHERE a.clinic_id = p_clinic_id
      AND a.treatment_plan_id = ANY(p_plan_ids)
  )
  SELECT
    r.plan_id,
    r.appointment_id,
    r.start_time,
    r.end_time,
    r.status
  FROM ranked r
  WHERE r.rn <= p_limit_per_plan;
END;
$$;
