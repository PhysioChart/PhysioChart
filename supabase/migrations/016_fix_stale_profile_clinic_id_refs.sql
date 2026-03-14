-- Fix stale references to profiles.clinic_id (dropped in 012)
-- in create_appointment (014) and get_treatment_invoice_prefill (015).
-- Replace with membership-aware is_member_of_clinic().

-- ============================================================
-- 1) Fix create_appointment
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

  IF NOT public.is_member_of_clinic(p_clinic_id) THEN
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

  -- Validate treatment plan if provided
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
-- 2) Fix get_treatment_invoice_prefill
-- ============================================================

CREATE OR REPLACE FUNCTION public.get_treatment_invoice_prefill(
  p_clinic_id uuid,
  p_treatment_plan_id uuid
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY INVOKER
STABLE
AS $$
DECLARE
  v_plan public.treatment_plans%ROWTYPE;
  v_items jsonb := '[]'::jsonb;
BEGIN
  IF p_clinic_id IS NULL THEN
    RAISE EXCEPTION USING MESSAGE = 'INVALID_CLINIC_ID';
  END IF;

  IF NOT public.is_member_of_clinic(p_clinic_id) THEN
    RAISE EXCEPTION USING MESSAGE = 'CLINIC_SCOPE_MISMATCH';
  END IF;

  SELECT *
  INTO v_plan
  FROM public.treatment_plans tp
  WHERE tp.id = p_treatment_plan_id
    AND tp.clinic_id = p_clinic_id;

  IF NOT FOUND THEN
    RAISE EXCEPTION USING MESSAGE = 'TREATMENT_PLAN_NOT_FOUND';
  END IF;

  IF v_plan.patient_id IS NULL THEN
    RAISE EXCEPTION USING MESSAGE = 'PATIENT_NOT_FOUND';
  END IF;

  -- Package-priced plan
  IF v_plan.package_price IS NOT NULL AND v_plan.package_price > 0 THEN
    v_items := jsonb_build_array(
      jsonb_build_object(
        'description', format('Package: %s', v_plan.name),
        'quantity', 1,
        'unit_price', v_plan.package_price,
        'total', v_plan.package_price
      )
    );
  -- Per-session-priced plan
  ELSIF v_plan.price_per_session IS NOT NULL AND v_plan.price_per_session > 0 THEN
    v_items := jsonb_build_array(
      jsonb_build_object(
        'description', format('Session: %s', v_plan.name),
        'quantity', 1,
        'unit_price', v_plan.price_per_session,
        'total', v_plan.price_per_session
      )
    );
  -- Unpriced plan: empty array (user adds manual items)
  END IF;

  RETURN jsonb_build_object(
    'treatmentPlanId', v_plan.id,
    'patientId', v_plan.patient_id,
    'planName', v_plan.name,
    'planStatus', v_plan.status,
    'pricingMode', CASE
      WHEN v_plan.package_price IS NOT NULL THEN 'package'
      WHEN v_plan.price_per_session IS NOT NULL THEN 'per_session'
      ELSE 'unpriced'
    END,
    'lineItems', v_items
  );
END;
$$;
