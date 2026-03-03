-- Session completion architecture hardening v2
-- Canonical sessions, derived progress, safe reopen, idempotent completion.

-- ============================================================
-- 1) Additive schema changes (nullable first)
-- ============================================================

DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'session_status') THEN
    CREATE TYPE public.session_status AS ENUM ('draft', 'final', 'voided');
  END IF;
END $$;

ALTER TABLE public.treatment_plans
  ALTER COLUMN total_sessions DROP NOT NULL,
  DROP CONSTRAINT IF EXISTS treatment_plans_total_sessions_check;

ALTER TABLE public.treatment_plans
  ADD CONSTRAINT treatment_plans_total_sessions_check
  CHECK (total_sessions IS NULL OR total_sessions > 0) NOT VALID;

ALTER TABLE public.treatment_sessions
  ADD COLUMN IF NOT EXISTS patient_id uuid,
  ADD COLUMN IF NOT EXISTS practitioner_id uuid,
  ADD COLUMN IF NOT EXISTS plan_id uuid,
  ADD COLUMN IF NOT EXISTS note_text text,
  ADD COLUMN IF NOT EXISTS status public.session_status,
  ADD COLUMN IF NOT EXISTS finalized_at timestamptz,
  ADD COLUMN IF NOT EXISTS voided_at timestamptz,
  ADD COLUMN IF NOT EXISTS voided_by uuid,
  ADD COLUMN IF NOT EXISTS session_order_time timestamptz;

ALTER TABLE public.treatment_sessions
  ALTER COLUMN treatment_plan_id DROP NOT NULL;

ALTER TABLE public.appointments
  ADD COLUMN IF NOT EXISTS status_before_completion public.appointment_status,
  ADD COLUMN IF NOT EXISTS completed_at timestamptz,
  ADD COLUMN IF NOT EXISTS completed_by uuid,
  ADD COLUMN IF NOT EXISTS reopened_at timestamptz,
  ADD COLUMN IF NOT EXISTS reopened_by uuid;

-- ============================================================
-- 2) Backfill treatment sessions and metadata
-- ============================================================

UPDATE public.treatment_sessions ts
SET
  plan_id = COALESCE(ts.plan_id, ts.treatment_plan_id),
  note_text = COALESCE(ts.note_text, ts.notes),
  status = COALESCE(ts.status, 'final'::public.session_status)
WHERE ts.plan_id IS NULL
   OR ts.note_text IS NULL
   OR ts.status IS NULL;

UPDATE public.treatment_sessions ts
SET
  patient_id = a.patient_id,
  practitioner_id = COALESCE(
    a.therapist_id,
    (
      SELECT tp.therapist_id
      FROM public.treatment_plans tp
      WHERE tp.id = COALESCE(ts.plan_id, ts.treatment_plan_id, a.treatment_plan_id)
      LIMIT 1
    )
  ),
  session_order_time = COALESCE(ts.session_order_time, a.start_time),
  finalized_at = COALESCE(ts.finalized_at, a.completed_at, ts.created_at, now())
FROM public.appointments a
WHERE ts.appointment_id = a.id
  AND (
    ts.patient_id IS NULL
    OR ts.practitioner_id IS NULL
    OR ts.session_order_time IS NULL
    OR ts.finalized_at IS NULL
  );

-- Ensure completed appointments always have one active session row.
INSERT INTO public.treatment_sessions (
  clinic_id,
  treatment_plan_id,
  plan_id,
  appointment_id,
  session_number,
  patient_id,
  practitioner_id,
  notes,
  note_text,
  status,
  finalized_at,
  session_order_time,
  created_at,
  updated_at
)
SELECT
  a.clinic_id,
  a.treatment_plan_id,
  a.treatment_plan_id,
  a.id,
  1,
  a.patient_id,
  COALESCE(a.therapist_id, tp.therapist_id),
  NULL,
  NULLIF(BTRIM(a.notes), ''),
  'final'::public.session_status,
  COALESCE(a.completed_at, now()),
  a.start_time,
  now(),
  now()
FROM public.appointments a
LEFT JOIN public.treatment_plans tp
  ON tp.id = a.treatment_plan_id
LEFT JOIN public.treatment_sessions ts
  ON ts.appointment_id = a.id
  AND COALESCE(ts.status, 'final'::public.session_status) <> 'voided'::public.session_status
WHERE a.status = 'completed'::public.appointment_status
  AND COALESCE(a.therapist_id, tp.therapist_id) IS NOT NULL
  AND ts.id IS NULL;

-- Backfill completion metadata for existing completed appointments.
UPDATE public.appointments a
SET
  status_before_completion = COALESCE(a.status_before_completion, 'scheduled'::public.appointment_status),
  completed_at = COALESCE(a.completed_at, a.updated_at, now())
WHERE a.status = 'completed'::public.appointment_status;

DO $$
DECLARE
  v_missing_count integer;
BEGIN
  SELECT COUNT(*)::integer
  INTO v_missing_count
  FROM public.treatment_sessions ts
  WHERE ts.practitioner_id IS NULL;

  IF v_missing_count > 0 THEN
    RAISE EXCEPTION
      'Cannot enforce treatment_sessions.practitioner_id NOT NULL. % row(s) are still missing practitioner_id. Backfill appointment.therapist_id or treatment_plan.therapist_id, then rerun migration.',
      v_missing_count;
  END IF;
END $$;

-- ============================================================
-- 3) Deduplicate active sessions per appointment before unique index
-- ============================================================

WITH ranked AS (
  SELECT
    ts.id,
    ts.appointment_id,
    ROW_NUMBER() OVER (
      PARTITION BY ts.appointment_id
      ORDER BY COALESCE(ts.finalized_at, ts.created_at) DESC, ts.created_at DESC, ts.id DESC
    ) AS rn
  FROM public.treatment_sessions ts
  WHERE ts.appointment_id IS NOT NULL
    AND COALESCE(ts.status, 'final'::public.session_status) <> 'voided'::public.session_status
), to_void AS (
  SELECT id
  FROM ranked
  WHERE rn > 1
)
UPDATE public.treatment_sessions ts
SET
  status = 'voided'::public.session_status,
  voided_at = COALESCE(ts.voided_at, now()),
  voided_by = COALESCE(ts.voided_by, '00000000-0000-0000-0000-000000000000')
WHERE ts.id IN (SELECT id FROM to_void);

-- ============================================================
-- 4) Constraints + FK updates after backfill
-- ============================================================

ALTER TABLE public.treatment_sessions
  DROP CONSTRAINT IF EXISTS treatment_sessions_note_text_len_check,
  DROP CONSTRAINT IF EXISTS treatment_sessions_voided_metadata_check;

ALTER TABLE public.treatment_sessions
  ADD CONSTRAINT treatment_sessions_note_text_len_check
  CHECK (note_text IS NULL OR char_length(note_text) <= 1000) NOT VALID,
  ADD CONSTRAINT treatment_sessions_voided_metadata_check
  CHECK (
    (status = 'voided'::public.session_status AND voided_at IS NOT NULL AND voided_by IS NOT NULL)
    OR
    (status <> 'voided'::public.session_status AND voided_at IS NULL AND voided_by IS NULL)
  ) NOT VALID;

-- Replace appointment FK behavior with RESTRICT to protect clinical history.
ALTER TABLE public.treatment_sessions
  DROP CONSTRAINT IF EXISTS treatment_sessions_appointment_id_fkey;

ALTER TABLE public.treatment_sessions
  ADD CONSTRAINT treatment_sessions_appointment_id_fkey
  FOREIGN KEY (appointment_id)
  REFERENCES public.appointments(id)
  ON DELETE RESTRICT
  NOT VALID;

ALTER TABLE public.treatment_sessions
  DROP CONSTRAINT IF EXISTS treatment_sessions_plan_id_fkey,
  DROP CONSTRAINT IF EXISTS treatment_sessions_patient_id_fkey,
  DROP CONSTRAINT IF EXISTS treatment_sessions_practitioner_id_fkey;

ALTER TABLE public.treatment_sessions
  ADD CONSTRAINT treatment_sessions_plan_id_fkey
    FOREIGN KEY (plan_id)
    REFERENCES public.treatment_plans(id)
    ON DELETE SET NULL
    NOT VALID,
  ADD CONSTRAINT treatment_sessions_patient_id_fkey
    FOREIGN KEY (patient_id)
    REFERENCES public.patients(id)
    ON DELETE RESTRICT
    NOT VALID,
  ADD CONSTRAINT treatment_sessions_practitioner_id_fkey
    FOREIGN KEY (practitioner_id)
    REFERENCES public.profiles(id)
    ON DELETE RESTRICT
    NOT VALID;

-- Validate newly introduced constraints after data cleanup.
ALTER TABLE public.treatment_plans VALIDATE CONSTRAINT treatment_plans_total_sessions_check;
ALTER TABLE public.treatment_sessions VALIDATE CONSTRAINT treatment_sessions_note_text_len_check;
ALTER TABLE public.treatment_sessions VALIDATE CONSTRAINT treatment_sessions_voided_metadata_check;
ALTER TABLE public.treatment_sessions VALIDATE CONSTRAINT treatment_sessions_appointment_id_fkey;
ALTER TABLE public.treatment_sessions VALIDATE CONSTRAINT treatment_sessions_plan_id_fkey;
ALTER TABLE public.treatment_sessions VALIDATE CONSTRAINT treatment_sessions_patient_id_fkey;
ALTER TABLE public.treatment_sessions VALIDATE CONSTRAINT treatment_sessions_practitioner_id_fkey;

ALTER TABLE public.treatment_sessions
  ALTER COLUMN patient_id SET NOT NULL,
  ALTER COLUMN practitioner_id SET NOT NULL,
  ALTER COLUMN status SET NOT NULL,
  ALTER COLUMN finalized_at SET NOT NULL,
  ALTER COLUMN session_order_time SET NOT NULL;

-- Keep appointment_id nullable for now to avoid destructive handling of legacy orphan session rows.
-- All new completion/reopen writes are appointment-bound and uniqueness is enforced via partial index.

ALTER TABLE public.treatment_sessions
  ALTER COLUMN status SET DEFAULT 'final'::public.session_status,
  ALTER COLUMN finalized_at SET DEFAULT now();

-- ============================================================
-- 5) Indexes and uniqueness for active sessions
-- ============================================================

DROP INDEX IF EXISTS uq_treatment_sessions_appointment;

CREATE UNIQUE INDEX IF NOT EXISTS uq_treatment_sessions_appointment_active
  ON public.treatment_sessions(appointment_id)
  WHERE status <> 'voided'::public.session_status;

CREATE INDEX IF NOT EXISTS idx_treatment_sessions_plan_status_time
  ON public.treatment_sessions(plan_id, status, session_order_time);

CREATE INDEX IF NOT EXISTS idx_treatment_sessions_clinic_patient_time
  ON public.treatment_sessions(clinic_id, patient_id, session_order_time);

-- ============================================================
-- 6) Progress aggregation helper (bulk, no N+1)
-- ============================================================

CREATE OR REPLACE FUNCTION public.get_treatment_plan_progress_bulk(
  p_clinic_id uuid,
  p_plan_ids uuid[] DEFAULT NULL
)
RETURNS TABLE (
  plan_id uuid,
  completed_sessions integer
)
LANGUAGE sql
SECURITY INVOKER
AS $$
  SELECT
    ts.plan_id,
    COUNT(*)::integer AS completed_sessions
  FROM public.treatment_sessions ts
  WHERE ts.clinic_id = p_clinic_id
    AND ts.plan_id IS NOT NULL
    AND ts.status <> 'voided'::public.session_status
    AND (p_plan_ids IS NULL OR ts.plan_id = ANY(p_plan_ids))
  GROUP BY ts.plan_id;
$$;

-- ============================================================
-- 7) Completion RPC (atomic + idempotent repair)
-- ============================================================

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
  v_completed integer := 0;
  v_total integer;
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
      AND tp.clinic_id = v_appt.clinic_id;

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

  IF v_appt.status = 'completed'::public.appointment_status THEN
    SELECT ts.id INTO v_session_id
    FROM public.treatment_sessions ts
    WHERE ts.appointment_id = v_appt.id
      AND ts.status <> 'voided'::public.session_status
    LIMIT 1;

    IF v_session_id IS NULL THEN
      INSERT INTO public.treatment_sessions (
        clinic_id,
        treatment_plan_id,
        plan_id,
        appointment_id,
        session_number,
        patient_id,
        practitioner_id,
        notes,
        note_text,
        status,
        finalized_at,
        session_order_time
      )
      VALUES (
        v_appt.clinic_id,
        v_appt.treatment_plan_id,
        v_appt.treatment_plan_id,
        v_appt.id,
        1,
        v_appt.patient_id,
        v_practitioner_id,
        NULL,
        v_note,
        'final'::public.session_status,
        COALESCE(v_appt.completed_at, v_now),
        v_appt.start_time
      )
      ON CONFLICT (appointment_id)
      WHERE status <> 'voided'::public.session_status
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
      SET
        completed_at = v_now,
        completed_by = COALESCE(auth.uid(), completed_by)
      WHERE id = v_appt.id;
    END IF;

    IF v_appt.treatment_plan_id IS NOT NULL THEN
      SELECT COUNT(*)::integer INTO v_completed
      FROM public.treatment_sessions ts
      WHERE ts.plan_id = v_appt.treatment_plan_id
        AND ts.status <> 'voided'::public.session_status;
    END IF;

    RETURN jsonb_build_object(
      'appointmentCompleted', true,
      'sessionCreated', v_was_created,
      'sessionId', v_session_id,
      'message', 'ALREADY_COMPLETED',
      'planProgress',
      CASE
        WHEN v_appt.treatment_plan_id IS NULL THEN NULL
        ELSE jsonb_build_object(
          'completed', COALESCE(v_completed, 0),
          'total', v_total,
          'extended', (v_total IS NOT NULL AND COALESCE(v_completed, 0) > v_total),
          'suggested_completed', (v_total IS NOT NULL AND COALESCE(v_completed, 0) >= v_total)
        )
      END
    );
  END IF;

  INSERT INTO public.treatment_sessions (
    clinic_id,
    treatment_plan_id,
    plan_id,
    appointment_id,
    session_number,
    patient_id,
    practitioner_id,
    notes,
    note_text,
    status,
    finalized_at,
    session_order_time
  )
  VALUES (
    v_appt.clinic_id,
    v_appt.treatment_plan_id,
    v_appt.treatment_plan_id,
    v_appt.id,
    1,
    v_appt.patient_id,
    v_practitioner_id,
    NULL,
    v_note,
    'final'::public.session_status,
    v_now,
    v_appt.start_time
  )
  ON CONFLICT (appointment_id)
  WHERE status <> 'voided'::public.session_status
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
  SET
    status_before_completion = v_appt.status,
    status = 'completed'::public.appointment_status,
    completed_at = v_now,
    completed_by = auth.uid()
  WHERE id = v_appt.id;

  -- Keep finalized_at aligned with completed_at for completion-created sessions.
  UPDATE public.treatment_sessions ts
  SET finalized_at = COALESCE((SELECT a.completed_at FROM public.appointments a WHERE a.id = v_appt.id), v_now)
  WHERE ts.id = v_session_id;

  IF v_appt.treatment_plan_id IS NOT NULL THEN
    SELECT COUNT(*)::integer INTO v_completed
    FROM public.treatment_sessions ts
    WHERE ts.plan_id = v_appt.treatment_plan_id
      AND ts.status <> 'voided'::public.session_status;
  END IF;

  RETURN jsonb_build_object(
    'appointmentCompleted', true,
    'sessionCreated', v_was_created,
    'sessionId', v_session_id,
    'message', NULL,
    'planProgress',
    CASE
      WHEN v_appt.treatment_plan_id IS NULL THEN NULL
      ELSE jsonb_build_object(
        'completed', COALESCE(v_completed, 0),
        'total', v_total,
        'extended', (v_total IS NOT NULL AND COALESCE(v_completed, 0) > v_total),
        'suggested_completed', (v_total IS NOT NULL AND COALESCE(v_completed, 0) >= v_total)
      )
    END
  );
END;
$$;

-- ============================================================
-- 8) Reopen RPC (void active session + restore status)
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

-- ============================================================
-- 9) Final deprecation
-- ============================================================

ALTER TABLE public.treatment_plans
  DROP COLUMN IF EXISTS completed_sessions;
