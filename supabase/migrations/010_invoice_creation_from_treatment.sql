-- Invoice creation hardening:
-- atomic create_invoice RPC + idempotency + relationship guardrails + line-item canonicalization.

-- ============================================================
-- 1) Invoices table additive hardening
-- ============================================================

ALTER TABLE public.invoices
  ADD COLUMN IF NOT EXISTS idempotency_key text;

ALTER TABLE public.invoices
  DROP CONSTRAINT IF EXISTS invoices_idempotency_key_non_blank_check,
  DROP CONSTRAINT IF EXISTS invoices_subtotal_nonnegative_check,
  DROP CONSTRAINT IF EXISTS invoices_tax_nonnegative_check,
  DROP CONSTRAINT IF EXISTS invoices_total_nonnegative_check,
  DROP CONSTRAINT IF EXISTS invoices_amount_paid_nonnegative_check,
  DROP CONSTRAINT IF EXISTS invoices_amount_paid_lte_total_check,
  DROP CONSTRAINT IF EXISTS invoices_total_matches_sum_check,
  DROP CONSTRAINT IF EXISTS invoices_line_items_array_check;

ALTER TABLE public.invoices
  ADD CONSTRAINT invoices_idempotency_key_non_blank_check
    CHECK (idempotency_key IS NULL OR char_length(btrim(idempotency_key)) > 0) NOT VALID,
  ADD CONSTRAINT invoices_subtotal_nonnegative_check
    CHECK (subtotal >= 0) NOT VALID,
  ADD CONSTRAINT invoices_tax_nonnegative_check
    CHECK (tax >= 0) NOT VALID,
  ADD CONSTRAINT invoices_total_nonnegative_check
    CHECK (total >= 0) NOT VALID,
  ADD CONSTRAINT invoices_amount_paid_nonnegative_check
    CHECK (amount_paid >= 0) NOT VALID,
  ADD CONSTRAINT invoices_amount_paid_lte_total_check
    CHECK (amount_paid <= total) NOT VALID,
  ADD CONSTRAINT invoices_total_matches_sum_check
    CHECK (total = round(subtotal + tax, 2)) NOT VALID,
  ADD CONSTRAINT invoices_line_items_array_check
    CHECK (jsonb_typeof(line_items) = 'array') NOT VALID;

CREATE UNIQUE INDEX IF NOT EXISTS uq_invoices_clinic_idempotency
  ON public.invoices(clinic_id, idempotency_key)
  WHERE idempotency_key IS NOT NULL;

-- ============================================================
-- 2) Line-item normalization
-- ============================================================

CREATE OR REPLACE FUNCTION public.normalize_invoice_line_items(p_line_items jsonb)
RETURNS TABLE (
  sanitized_line_items jsonb,
  sanitized_subtotal numeric(10,2)
)
LANGUAGE plpgsql
AS $$
DECLARE
  v_item jsonb;
  v_items jsonb := '[]'::jsonb;
  v_description text;
  v_quantity_raw numeric;
  v_quantity integer;
  v_unit_price_raw numeric;
  v_unit_price numeric(10,2);
  v_line_total numeric(10,2);
  v_subtotal numeric(12,2) := 0;
BEGIN
  IF p_line_items IS NULL OR jsonb_typeof(p_line_items) <> 'array' THEN
    RAISE EXCEPTION USING MESSAGE = 'INVALID_LINE_ITEMS';
  END IF;

  IF jsonb_array_length(p_line_items) = 0 OR jsonb_array_length(p_line_items) > 100 THEN
    RAISE EXCEPTION USING MESSAGE = 'INVALID_LINE_ITEMS';
  END IF;

  FOR v_item IN SELECT value FROM jsonb_array_elements(p_line_items)
  LOOP
    IF jsonb_typeof(v_item) <> 'object' THEN
      RAISE EXCEPTION USING MESSAGE = 'INVALID_LINE_ITEMS';
    END IF;

    v_description := NULLIF(BTRIM(COALESCE(v_item->>'description', '')), '');
    IF v_description IS NULL THEN
      RAISE EXCEPTION USING MESSAGE = 'LINE_ITEM_DESCRIPTION_REQUIRED';
    END IF;

    BEGIN
      v_quantity_raw := (v_item->>'quantity')::numeric;
    EXCEPTION
      WHEN others THEN
        RAISE EXCEPTION USING MESSAGE = 'INVALID_LINE_ITEM_QUANTITY';
    END;

    IF v_quantity_raw IS NULL OR v_quantity_raw <> trunc(v_quantity_raw) THEN
      RAISE EXCEPTION USING MESSAGE = 'INVALID_LINE_ITEM_QUANTITY';
    END IF;

    IF v_quantity_raw < 1 OR v_quantity_raw > 2147483647 THEN
      RAISE EXCEPTION USING MESSAGE = 'INVALID_LINE_ITEM_QUANTITY';
    END IF;

    v_quantity := v_quantity_raw::integer;

    BEGIN
      v_unit_price_raw := (v_item->>'unit_price')::numeric;
    EXCEPTION
      WHEN others THEN
        RAISE EXCEPTION USING MESSAGE = 'INVALID_LINE_ITEM_PRICE';
    END;

    IF v_unit_price_raw IS NULL OR v_unit_price_raw < 0 OR v_unit_price_raw > 99999999.99 THEN
      RAISE EXCEPTION USING MESSAGE = 'INVALID_LINE_ITEM_PRICE';
    END IF;

    IF v_unit_price_raw <> round(v_unit_price_raw, 2) THEN
      RAISE EXCEPTION USING MESSAGE = 'INVALID_LINE_ITEM_PRICE';
    END IF;

    v_unit_price := round(v_unit_price_raw, 2)::numeric(10,2);

    IF (v_quantity::numeric * v_unit_price) > 99999999.99 THEN
      RAISE EXCEPTION USING MESSAGE = 'INVALID_INVOICE_TOTAL';
    END IF;

    v_line_total := (v_quantity::numeric * v_unit_price)::numeric(10,2);

    IF (v_subtotal + v_line_total) > 99999999.99 THEN
      RAISE EXCEPTION USING MESSAGE = 'INVALID_INVOICE_TOTAL';
    END IF;

    v_subtotal := v_subtotal + v_line_total;

    v_items := v_items || jsonb_build_array(
      jsonb_build_object(
        'description', v_description,
        'quantity', v_quantity,
        'unit_price', v_unit_price,
        'total', v_line_total
      )
    );
  END LOOP;

  IF v_subtotal <= 0 THEN
    RAISE EXCEPTION USING MESSAGE = 'INVALID_INVOICE_TOTAL';
  END IF;

  sanitized_line_items := v_items;
  sanitized_subtotal := v_subtotal::numeric(10,2);
  RETURN NEXT;
END;
$$;

CREATE OR REPLACE FUNCTION public.apply_invoice_line_item_totals()
RETURNS trigger
LANGUAGE plpgsql
AS $$
DECLARE
  v_normalized_line_items jsonb;
  v_normalized_subtotal numeric(10,2);
BEGIN
  SELECT n.sanitized_line_items, n.sanitized_subtotal
  INTO v_normalized_line_items, v_normalized_subtotal
  FROM public.normalize_invoice_line_items(NEW.line_items) AS n;

  NEW.line_items := v_normalized_line_items;
  NEW.subtotal := v_normalized_subtotal;
  NEW.tax := round(COALESCE(NEW.tax, 0), 2);

  IF NEW.tax < 0 OR NEW.tax > 99999999.99 THEN
    RAISE EXCEPTION USING MESSAGE = 'INVALID_INVOICE_TOTAL';
  END IF;

  IF (NEW.subtotal + NEW.tax) > 99999999.99 THEN
    RAISE EXCEPTION USING MESSAGE = 'INVALID_INVOICE_TOTAL';
  END IF;

  NEW.total := round(NEW.subtotal + NEW.tax, 2);

  IF NEW.total <= 0 THEN
    RAISE EXCEPTION USING MESSAGE = 'INVALID_INVOICE_TOTAL';
  END IF;

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS apply_invoice_line_item_totals ON public.invoices;

CREATE TRIGGER apply_invoice_line_item_totals
BEFORE INSERT OR UPDATE OF line_items, subtotal, tax, total
ON public.invoices
FOR EACH ROW
EXECUTE FUNCTION public.apply_invoice_line_item_totals();

-- Note: PostgreSQL executes same-time triggers alphabetically by trigger name.
-- "apply_invoice_line_item_totals" is intentionally named before relationship validation.

-- ============================================================
-- 3) Relationship validation trigger
-- ============================================================

CREATE OR REPLACE FUNCTION public.validate_invoice_relationship_scope()
RETURNS trigger
LANGUAGE plpgsql
AS $$
DECLARE
  v_patient_clinic uuid;
  v_plan_clinic uuid;
  v_plan_patient uuid;
  v_plan_status public.treatment_status;
BEGIN
  IF TG_OP = 'UPDATE'
    AND NEW.clinic_id IS NOT DISTINCT FROM OLD.clinic_id
    AND NEW.patient_id IS NOT DISTINCT FROM OLD.patient_id
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

  IF NEW.treatment_plan_id IS NOT NULL THEN
    SELECT tp.clinic_id, tp.patient_id, tp.status
    INTO v_plan_clinic, v_plan_patient, v_plan_status
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

    IF v_plan_status = 'cancelled'::public.treatment_status THEN
      RAISE EXCEPTION USING MESSAGE = 'TREATMENT_PLAN_CANCELLED';
    END IF;
  END IF;

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS validate_invoice_relationship_scope ON public.invoices;

CREATE TRIGGER validate_invoice_relationship_scope
BEFORE INSERT OR UPDATE OF clinic_id, patient_id, treatment_plan_id
ON public.invoices
FOR EACH ROW
EXECUTE FUNCTION public.validate_invoice_relationship_scope();

-- ============================================================
-- 4) Atomic create-invoice RPC
-- ============================================================

CREATE OR REPLACE FUNCTION public.create_invoice(
  p_clinic_id uuid,
  p_patient_id uuid,
  p_treatment_plan_id uuid DEFAULT NULL,
  p_line_items jsonb DEFAULT '[]'::jsonb,
  p_due_date date DEFAULT NULL,
  p_notes text DEFAULT NULL,
  p_idempotency_key text DEFAULT NULL
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY INVOKER
AS $$
DECLARE
  v_existing public.invoices%ROWTYPE;
  v_invoice public.invoices%ROWTYPE;
  v_patient public.patients%ROWTYPE;
  v_patient_json jsonb;
  v_plan_clinic uuid;
  v_plan_patient uuid;
  v_plan_status public.treatment_status;
  v_patient_clinic uuid;
  v_normalized_line_items jsonb;
  v_subtotal numeric(10,2);
  v_tax numeric(10,2) := 0;
  v_total numeric(10,2);
  v_status public.invoice_status;
  v_invoice_number text;
  v_sequence integer;
  v_constraint text;
  v_today_text text := to_char(CURRENT_DATE, 'YYYYMMDD');
  v_note text := NULLIF(BTRIM(COALESCE(p_notes, '')), '');
  v_idempotency_key text := NULLIF(BTRIM(COALESCE(p_idempotency_key, '')), '');
  v_created boolean := false;
  v_create_attempt integer;
  v_number_attempt integer;
BEGIN
  IF p_clinic_id IS NULL THEN
    RAISE EXCEPTION USING MESSAGE = 'INVALID_CLINIC_ID';
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

  SELECT p.clinic_id
  INTO v_patient_clinic
  FROM public.patients p
  WHERE p.id = p_patient_id;

  IF v_patient_clinic IS NULL THEN
    RAISE EXCEPTION USING MESSAGE = 'PATIENT_NOT_FOUND';
  END IF;

  IF v_patient_clinic <> p_clinic_id THEN
    RAISE EXCEPTION USING MESSAGE = 'PATIENT_CLINIC_MISMATCH';
  END IF;

  IF p_treatment_plan_id IS NOT NULL THEN
    SELECT tp.clinic_id, tp.patient_id, tp.status
    INTO v_plan_clinic, v_plan_patient, v_plan_status
    FROM public.treatment_plans tp
    WHERE tp.id = p_treatment_plan_id;

    IF v_plan_clinic IS NULL THEN
      RAISE EXCEPTION USING MESSAGE = 'TREATMENT_PLAN_NOT_FOUND';
    END IF;

    IF v_plan_clinic <> p_clinic_id THEN
      RAISE EXCEPTION USING MESSAGE = 'TREATMENT_PLAN_CLINIC_MISMATCH';
    END IF;

    IF v_plan_patient <> p_patient_id THEN
      RAISE EXCEPTION USING MESSAGE = 'PATIENT_PLAN_MISMATCH';
    END IF;

    IF v_plan_status = 'cancelled'::public.treatment_status THEN
      RAISE EXCEPTION USING MESSAGE = 'TREATMENT_PLAN_CANCELLED';
    END IF;
  END IF;

  SELECT n.sanitized_line_items, n.sanitized_subtotal
  INTO v_normalized_line_items, v_subtotal
  FROM public.normalize_invoice_line_items(p_line_items) AS n;

  v_total := round(v_subtotal + v_tax, 2);
  IF v_total <= 0 THEN
    RAISE EXCEPTION USING MESSAGE = 'INVALID_INVOICE_TOTAL';
  END IF;

  IF p_due_date IS NOT NULL AND p_due_date < CURRENT_DATE THEN
    v_status := 'overdue'::public.invoice_status;
  ELSE
    v_status := 'sent'::public.invoice_status;
  END IF;

  -- Keep p_idempotency_key default NULL for Supabase RPC compatibility;
  -- function still enforces non-null/non-blank keys for callers.
  FOR v_create_attempt IN 1..10 LOOP
    SELECT *
    INTO v_existing
    FROM public.invoices i
    WHERE i.clinic_id = p_clinic_id
      AND i.idempotency_key = v_idempotency_key
    ORDER BY i.created_at DESC
    LIMIT 1;

    IF FOUND THEN
      v_invoice := v_existing;
      EXIT;
    END IF;

    FOR v_number_attempt IN 1..10 LOOP
      SELECT COALESCE(
        MAX((regexp_match(i.invoice_number, '^INV-' || v_today_text || '-(\d+)$'))[1]::integer),
        0
      ) + 1
      INTO v_sequence
      FROM public.invoices i
      WHERE i.clinic_id = p_clinic_id
        AND i.invoice_number LIKE ('INV-' || v_today_text || '-%');

      v_invoice_number := format('INV-%s-%s', v_today_text, lpad(v_sequence::text, 3, '0'));

      BEGIN
        INSERT INTO public.invoices (
          clinic_id,
          patient_id,
          treatment_plan_id,
          invoice_number,
          line_items,
          subtotal,
          tax,
          total,
          amount_paid,
          status,
          due_date,
          notes,
          idempotency_key
        )
        VALUES (
          p_clinic_id,
          p_patient_id,
          p_treatment_plan_id,
          v_invoice_number,
          v_normalized_line_items,
          v_subtotal,
          v_tax,
          v_total,
          0,
          v_status,
          p_due_date,
          v_note,
          v_idempotency_key
        )
        RETURNING *
        INTO v_invoice;

        v_created := true;
        EXIT;
      EXCEPTION
        WHEN SQLSTATE '23505' THEN
          GET STACKED DIAGNOSTICS v_constraint = CONSTRAINT_NAME;

          IF v_constraint IN ('idx_invoices_number', 'invoices_clinic_id_invoice_number_key') THEN
            IF v_number_attempt = 10 THEN
              RAISE EXCEPTION USING MESSAGE = 'INVOICE_NUMBER_GENERATION_FAILED';
            END IF;
            CONTINUE;
          ELSIF v_constraint = 'uq_invoices_clinic_idempotency' THEN
            EXIT;
          ELSE
            RAISE;
          END IF;
      END;
    END LOOP;

    IF v_created THEN
      EXIT;
    END IF;
  END LOOP;

  IF NOT v_created AND v_invoice.id IS NULL THEN
    RAISE EXCEPTION USING MESSAGE = 'INVOICE_CREATE_RETRY_EXHAUSTED';
  END IF;

  IF v_invoice.id IS NULL THEN
    RAISE EXCEPTION USING MESSAGE = 'INVOICE_CREATE_RETRY_EXHAUSTED';
  END IF;

  SELECT *
  INTO v_patient
  FROM public.patients p
  WHERE p.id = v_invoice.patient_id;

  IF FOUND THEN
    v_patient_json := jsonb_build_object(
      'id', v_patient.id,
      'clinic_id', v_patient.clinic_id,
      'full_name', v_patient.full_name,
      'phone', v_patient.phone,
      'email', v_patient.email,
      'date_of_birth', v_patient.date_of_birth,
      'gender', v_patient.gender,
      'address', v_patient.address,
      'emergency_contact_name', v_patient.emergency_contact_name,
      'emergency_contact_phone', v_patient.emergency_contact_phone,
      'medical_history', v_patient.medical_history,
      'notes', v_patient.notes,
      'is_archived', v_patient.is_archived,
      'created_at', v_patient.created_at,
      'updated_at', v_patient.updated_at
    );
  ELSE
    v_patient_json := NULL;
  END IF;

  RETURN jsonb_build_object(
    'invoiceId', v_invoice.id,
    'alreadyCreated', NOT v_created,
    'message', CASE WHEN v_created THEN NULL ELSE 'INVOICE_ALREADY_CREATED' END,
    'invoice', jsonb_build_object(
      'id', v_invoice.id,
      'clinic_id', v_invoice.clinic_id,
      'patient_id', v_invoice.patient_id,
      'treatment_plan_id', v_invoice.treatment_plan_id,
      'invoice_number', v_invoice.invoice_number,
      'line_items', v_invoice.line_items,
      'subtotal', v_invoice.subtotal,
      'tax', v_invoice.tax,
      'total', v_invoice.total,
      'amount_paid', v_invoice.amount_paid,
      'status', v_invoice.status,
      'due_date', v_invoice.due_date,
      'notes', v_invoice.notes,
      'created_at', v_invoice.created_at,
      'updated_at', v_invoice.updated_at,
      'idempotency_key', v_invoice.idempotency_key,
      'patient', v_patient_json
    )
  );
END;
$$;
