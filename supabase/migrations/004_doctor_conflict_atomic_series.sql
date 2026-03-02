-- Step 2: constraints + RPC after enum value exists.

-- Duration guards.
ALTER TABLE public.appointments
  ADD CONSTRAINT appointments_positive_duration_check
  CHECK (end_time > start_time);

ALTER TABLE public.appointments
  ADD CONSTRAINT appointments_max_duration_check
  CHECK ((end_time - start_time) <= interval '12 hours');

-- DB-level overlap prevention for blocking statuses.
CREATE EXTENSION IF NOT EXISTS btree_gist;

-- Auto-resolve legacy overlaps before enforcing exclusion.
-- Keep the earliest record (by id) and cancel later overlapping ones.
WITH overlapping_later_rows AS (
  SELECT DISTINCT newer.id
  FROM public.appointments older
  JOIN public.appointments newer
    ON older.clinic_id = newer.clinic_id
    AND older.therapist_id = newer.therapist_id
    AND older.id < newer.id
    AND older.therapist_id IS NOT NULL
    AND older.status IN ('scheduled'::public.appointment_status, 'checked_in'::public.appointment_status)
    AND newer.status IN ('scheduled'::public.appointment_status, 'checked_in'::public.appointment_status)
    AND tstzrange(older.start_time, older.end_time, '[)') && tstzrange(newer.start_time, newer.end_time, '[)')
)
UPDATE public.appointments a
SET
  status = 'cancelled'::public.appointment_status,
  notes = CONCAT(
    COALESCE(a.notes || E'\n', ''),
    '[System] Auto-cancelled during overlap-enforcement migration'
  )
WHERE a.id IN (SELECT id FROM overlapping_later_rows);

ALTER TABLE public.appointments
  ADD CONSTRAINT appointments_doctor_no_overlap_excl
  EXCLUDE USING gist (
    clinic_id WITH =,
    therapist_id WITH =,
    tstzrange(start_time, end_time, '[)') WITH &&
  )
  WHERE (
    therapist_id IS NOT NULL
    AND status IN ('scheduled'::public.appointment_status, 'checked_in'::public.appointment_status)
  );

-- Atomic series creation RPC with pre-validation and conflict payload.
CREATE OR REPLACE FUNCTION public.create_appointment_series(
  p_clinic_id uuid,
  p_patient_id uuid,
  p_therapist_id uuid,
  p_treatment_plan_id uuid DEFAULT NULL,
  p_notes text DEFAULT NULL,
  p_occurrences jsonb DEFAULT '[]'::jsonb
)
RETURNS jsonb
LANGUAGE plpgsql
AS $$
DECLARE
  v_series_id uuid := gen_random_uuid();
  v_conflicts jsonb := '[]'::jsonb;
BEGIN
  IF p_therapist_id IS NULL THEN
    RAISE EXCEPTION USING MESSAGE = 'Doctor is required';
  END IF;

  IF jsonb_typeof(p_occurrences) <> 'array' OR jsonb_array_length(p_occurrences) = 0 THEN
    RAISE EXCEPTION USING MESSAGE = 'Series occurrences are required';
  END IF;

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
  ORDER BY p.series_index;

  RETURN jsonb_build_object(
    'hasConflict', false,
    'seriesId', v_series_id,
    'createdCount', jsonb_array_length(p_occurrences)
  );
END;
$$;
