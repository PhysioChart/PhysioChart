-- Treatment progress automation: status recompute, history RPC, perf index

-- Perf index for history ordering
CREATE INDEX IF NOT EXISTS idx_treatment_sessions_plan_finalized_desc
  ON public.treatment_sessions(plan_id, finalized_at DESC);

-- Guarded history RPC (status final, non-voided by status enum, capped plan ids)
CREATE OR REPLACE FUNCTION public.get_treatment_session_history_bulk(
  p_clinic_id uuid,
  p_plan_ids uuid[],
  p_limit_per_plan integer DEFAULT 5
)
RETURNS TABLE (
  plan_id uuid,
  session_id uuid,
  appointment_id uuid,
  finalized_at timestamptz,
  note text
)
LANGUAGE plpgsql
SECURITY INVOKER
AS $$
BEGIN
  IF p_plan_ids IS NULL OR cardinality(p_plan_ids) = 0 THEN
    RETURN;
  END IF;

  IF cardinality(p_plan_ids) > 100 THEN
    RAISE EXCEPTION USING MESSAGE = 'PLAN_IDS_TOO_LARGE';
  END IF;

  RETURN QUERY
  SELECT t.plan_id,
         t.id AS session_id,
         t.appointment_id,
         t.finalized_at,
         COALESCE(t.note_text, t.notes) AS note
  FROM (
    SELECT ts.*, ROW_NUMBER() OVER (
             PARTITION BY ts.plan_id
             ORDER BY ts.finalized_at DESC, ts.created_at DESC
           ) AS rn
    FROM public.treatment_sessions ts
    WHERE ts.clinic_id = p_clinic_id
      AND ts.plan_id IS NOT NULL
      AND ts.plan_id = ANY(p_plan_ids)
      AND ts.status = 'final'
  ) t
  WHERE t.rn <= COALESCE(p_limit_per_plan, 5);
END;
$$;

-- Completion RPC with status recompute + idempotency
CREATE OR REPLACE FUNCTION public.complete_appointment_with_session_note(
  p_clinic_id uuid,
  p_appointment_id uuid,
  p_session_note text DEFAULT NULL
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY INVOKER
AS $$
DECLARE
  v_appt public.appointments%ROWTYPE;
  v_plan public.treatment_plans%ROWTYPE;
  v_practitioner_id uuid;
  v_note text := NULLIF(BTRIM(COALESCE(p_session_note, '')), '');
  v_session_id uuid;
  v_now timestamptz := now();
  v_was_created boolean := false;
  v_completed_count integer := 0;
  v_total integer;
  v_message text := NULL;
  v_plan_status public.treatment_status;
  v_plan_completed boolean := NULL;
  v_next_session_number integer := 1;
BEGIN
  IF v_note IS NOT NULL AND char_length(v_note) > 1000 THEN
    RAISE EXCEPTION USING MESSAGE = 'NOTE_TOO_LONG';
  END IF;

  SELECT * INTO v_appt
  FROM public.appointments a
  WHERE a.id = p_appointment_id
    AND a.clinic_id = p_clinic_id
  FOR UPDATE;

  IF NOT FOUND THEN
    RAISE EXCEPTION USING MESSAGE = 'APPOINTMENT_NOT_FOUND';
  END IF;

  IF v_appt.status IN ('cancelled'::public.appointment_status, 'no_show'::public.appointment_status) THEN
    RAISE EXCEPTION USING MESSAGE = 'INVALID_STATUS_TRANSITION';
  END IF;

  IF v_appt.treatment_plan_id IS NOT NULL THEN
    SELECT * INTO v_plan
    FROM public.treatment_plans tp
    WHERE tp.id = v_appt.treatment_plan_id
      AND tp.clinic_id = v_appt.clinic_id
    FOR UPDATE;

    IF NOT FOUND OR v_plan.patient_id <> v_appt.patient_id THEN
      RAISE EXCEPTION USING MESSAGE = 'PATIENT_PLAN_MISMATCH';
    END IF;

    v_total := v_plan.total_sessions;
  ELSE
    v_total := NULL;
  END IF;

  v_practitioner_id := COALESCE(v_appt.therapist_id, v_plan.therapist_id);
  IF v_practitioner_id IS NULL THEN
    RAISE EXCEPTION USING MESSAGE = 'PRACTITIONER_REQUIRED';
  END IF;

  IF v_appt.treatment_plan_id IS NOT NULL THEN
    SELECT COALESCE(COUNT(*), 0) + 1
    INTO v_next_session_number
    FROM public.treatment_sessions ts
    WHERE ts.plan_id = v_appt.treatment_plan_id
      AND ts.status = 'final';
  END IF;

  -- Idempotent path if already completed
  IF v_appt.status = 'completed'::public.appointment_status THEN
    SELECT ts.id INTO v_session_id
    FROM public.treatment_sessions ts
    WHERE ts.appointment_id = v_appt.id
      AND ts.status <> 'voided'::public.session_status
    LIMIT 1;

    IF v_session_id IS NULL THEN
      INSERT INTO public.treatment_sessions (
        clinic_id, treatment_plan_id, plan_id, appointment_id,
        session_number, patient_id, practitioner_id,
        notes, note_text, status, finalized_at, session_order_time
      )
      VALUES (
        v_appt.clinic_id, v_appt.treatment_plan_id, v_appt.treatment_plan_id, v_appt.id,
        v_next_session_number, v_appt.patient_id, v_practitioner_id,
        NULL, v_note, 'final'::public.session_status,
        COALESCE(v_appt.completed_at, v_now),
        v_appt.start_time
      )
      ON CONFLICT (appointment_id) WHERE status <> 'voided'::public.session_status
      DO NOTHING
      RETURNING id INTO v_session_id;

      IF v_session_id IS NULL THEN
        SELECT ts.id INTO v_session_id
        FROM public.treatment_sessions ts
        WHERE ts.appointment_id = v_appt.id
          AND ts.status <> 'voided'::public.session_status
        LIMIT 1;
      END IF;

      v_was_created := true;
    END IF;

    IF v_appt.completed_at IS NULL THEN
      UPDATE public.appointments
      SET completed_at = v_now,
          completed_by = COALESCE(auth.uid(), completed_by),
          status_before_completion = COALESCE(v_appt.status_before_completion, 'scheduled'::public.appointment_status)
      WHERE id = v_appt.id;
    ELSIF v_appt.status_before_completion IS NULL THEN
      UPDATE public.appointments
      SET status_before_completion = 'scheduled'::public.appointment_status
      WHERE id = v_appt.id;
    END IF;

    IF v_appt.treatment_plan_id IS NOT NULL THEN
      SELECT COUNT(*)::integer INTO v_completed_count
      FROM public.treatment_sessions ts
      WHERE ts.plan_id = v_appt.treatment_plan_id
        AND ts.status = 'final';

      v_plan_status := v_plan.status;
      IF v_total IS NOT NULL AND v_plan.status <> 'cancelled' AND v_completed_count >= v_total THEN
        UPDATE public.treatment_plans
        SET status = 'completed'::public.treatment_status
        WHERE id = v_plan.id;
        v_plan_status := 'completed'::public.treatment_status;
      END IF;
      v_plan_completed := (v_plan_status = 'completed');
    END IF;

    v_message := 'ALREADY_COMPLETED';

    RETURN jsonb_build_object(
      'appointmentCompleted', true,
      'sessionCreated', v_was_created,
      'sessionId', v_session_id,
      'message', v_message,
      'planProgress',
        CASE WHEN v_appt.treatment_plan_id IS NULL THEN NULL
             ELSE jsonb_build_object(
               'completed', COALESCE(v_completed_count, 0),
               'total', v_total,
               'extended', (v_total IS NOT NULL AND COALESCE(v_completed_count, 0) > v_total),
               'suggested_completed', (v_total IS NOT NULL AND COALESCE(v_completed_count, 0) >= v_total)
             )
        END,
      'planStatus', v_plan_status,
      'planCompleted', v_plan_completed
    );
  END IF;

  -- Fresh completion path
  INSERT INTO public.treatment_sessions (
    clinic_id, treatment_plan_id, plan_id, appointment_id,
    session_number, patient_id, practitioner_id,
    notes, note_text, status, finalized_at, session_order_time
  )
  VALUES (
    v_appt.clinic_id, v_appt.treatment_plan_id, v_appt.treatment_plan_id, v_appt.id,
    v_next_session_number, v_appt.patient_id, v_practitioner_id,
    NULL, v_note, 'final'::public.session_status,
    v_now, v_appt.start_time
  )
  ON CONFLICT (appointment_id) WHERE status <> 'voided'::public.session_status
  DO NOTHING
  RETURNING id INTO v_session_id;

  IF v_session_id IS NULL THEN
    SELECT ts.id INTO v_session_id
    FROM public.treatment_sessions ts
    WHERE ts.appointment_id = v_appt.id
      AND ts.status <> 'voided'::public.session_status
    LIMIT 1;
  ELSE
    v_was_created := true;
  END IF;

  UPDATE public.appointments
  SET status_before_completion = v_appt.status,
      status = 'completed'::public.appointment_status,
      completed_at = v_now,
      completed_by = auth.uid()
  WHERE id = v_appt.id;

  UPDATE public.treatment_sessions ts
  SET finalized_at = v_now
  WHERE ts.id = v_session_id
    AND ts.finalized_at IS DISTINCT FROM v_now;

  IF v_appt.treatment_plan_id IS NOT NULL THEN
    SELECT COUNT(*)::integer INTO v_completed_count
    FROM public.treatment_sessions ts
    WHERE ts.plan_id = v_appt.treatment_plan_id
      AND ts.status = 'final';

    v_plan_status := v_plan.status;
    IF v_total IS NOT NULL AND v_plan.status <> 'cancelled' AND v_completed_count >= v_total THEN
      UPDATE public.treatment_plans
      SET status = 'completed'::public.treatment_status
      WHERE id = v_plan.id;
      v_plan_status := 'completed'::public.treatment_status;
    END IF;
    v_plan_completed := (v_plan_status = 'completed');
  END IF;

  RETURN jsonb_build_object(
    'appointmentCompleted', true,
    'sessionCreated', v_was_created,
    'sessionId', v_session_id,
    'message', NULL,
    'planProgress',
      CASE WHEN v_appt.treatment_plan_id IS NULL THEN NULL
           ELSE jsonb_build_object(
             'completed', COALESCE(v_completed_count, 0),
             'total', v_total,
             'extended', (v_total IS NOT NULL AND COALESCE(v_completed_count, 0) > v_total),
             'suggested_completed', (v_total IS NOT NULL AND COALESCE(v_completed_count, 0) >= v_total)
           )
      END,
    'planStatus', v_plan_status,
    'planCompleted', v_plan_completed
  );
END;
$$;

-- Reopen RPC with lock alignment and payload status
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
  v_plan public.treatment_plans%ROWTYPE;
  v_total integer;
  v_completed_count integer;
  v_plan_status public.treatment_status;
  v_plan_completed boolean := NULL;
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

  IF v_appt.treatment_plan_id IS NOT NULL THEN
    SELECT * INTO v_plan
    FROM public.treatment_plans tp
    WHERE tp.id = v_appt.treatment_plan_id
      AND tp.clinic_id = v_appt.clinic_id
    FOR UPDATE;
    IF FOUND THEN
      v_total := v_plan.total_sessions;
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
    SET status = 'voided'::public.session_status,
        voided_at = now(),
        voided_by = auth.uid()
    WHERE id = v_session_id;
    v_session_voided := true;
  END IF;

  UPDATE public.appointments
  SET status = COALESCE(v_appt.status_before_completion, 'scheduled'::public.appointment_status),
      reopened_at = now(),
      reopened_by = auth.uid()
  WHERE id = v_appt.id;

  IF v_plan.id IS NOT NULL AND v_total IS NOT NULL AND v_plan.status <> 'cancelled' THEN
    SELECT COUNT(*)::integer INTO v_completed_count
    FROM public.treatment_sessions ts
    WHERE ts.plan_id = v_plan.id
      AND ts.status = 'final';

    IF v_completed_count < v_total THEN
      UPDATE public.treatment_plans
      SET status = 'active'::public.treatment_status
      WHERE id = v_plan.id;
      v_plan_status := 'active'::public.treatment_status;
    ELSE
      v_plan_status := 'completed'::public.treatment_status;
    END IF;
    v_plan_completed := (v_plan_status = 'completed');
  ELSE
    v_plan_status := v_plan.status;
  END IF;

  RETURN jsonb_build_object(
    'reopened', true,
    'sessionVoided', v_session_voided,
    'message', CASE WHEN v_session_voided THEN NULL ELSE 'REOPEN_NO_ACTIVE_SESSION' END,
    'planStatus', v_plan_status,
    'planCompleted', v_plan_completed
  );
END;
$$;
