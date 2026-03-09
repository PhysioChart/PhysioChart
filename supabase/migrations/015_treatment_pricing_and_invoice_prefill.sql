-- Phase 1d: Treatment pricing DB constraints
-- Phase 1e: Invoice prefill RPC

-- ============================================================
-- 1) Treatment pricing constraints
-- ============================================================
-- Legal states (exactly one of three):
--   Package-priced: package_price > 0, price_per_session IS NULL
--   Per-session-priced: price_per_session > 0, package_price IS NULL
--   Unpriced: both NULL
-- Zero is not valid — normalize to NULL first.

-- Phase 0 audit must pass before this runs.
-- Normalize zero values to NULL.
UPDATE public.treatment_plans SET package_price = NULL WHERE package_price = 0;
UPDATE public.treatment_plans SET price_per_session = NULL WHERE price_per_session = 0;

-- Resolve dual-priced rows: keep package_price, null out price_per_session.
UPDATE public.treatment_plans
  SET price_per_session = NULL
  WHERE package_price IS NOT NULL AND price_per_session IS NOT NULL;

-- Drop existing constraints if any (idempotent-safe)
ALTER TABLE public.treatment_plans
  DROP CONSTRAINT IF EXISTS chk_price_non_negative,
  DROP CONSTRAINT IF EXISTS chk_session_price_non_negative,
  DROP CONSTRAINT IF EXISTS chk_pricing_mode_exclusive;

-- Prices must be NULL or > 0
ALTER TABLE public.treatment_plans
  ADD CONSTRAINT chk_price_non_negative
  CHECK (package_price IS NULL OR package_price > 0);

ALTER TABLE public.treatment_plans
  ADD CONSTRAINT chk_session_price_non_negative
  CHECK (price_per_session IS NULL OR price_per_session > 0);

-- Cannot have both pricing modes set
ALTER TABLE public.treatment_plans
  ADD CONSTRAINT chk_pricing_mode_exclusive
  CHECK (NOT (package_price IS NOT NULL AND price_per_session IS NOT NULL));

-- ============================================================
-- 2) Invoice prefill RPC (Phase 1e)
-- ============================================================
-- Returns canonical draft line items based on current plan pricing.
-- For package: one line item with package price.
-- For per-session: one line item with per-session price.
-- For unpriced: returns empty array.

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
