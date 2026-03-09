-- Payment recording hardening: atomic invoice payment RPC, idempotency, and ledger guardrails.

-- ============================================================
-- 1) Payments table hardening (additive)
-- ============================================================

ALTER TABLE public.payments
  ADD COLUMN IF NOT EXISTS recorded_by uuid REFERENCES public.profiles(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS idempotency_key text;

ALTER TABLE public.payments
  DROP CONSTRAINT IF EXISTS payments_amount_positive_check,
  DROP CONSTRAINT IF EXISTS payments_notes_length_check;

ALTER TABLE public.payments
  ADD CONSTRAINT payments_amount_positive_check
    CHECK (amount > 0) NOT VALID,
  ADD CONSTRAINT payments_notes_length_check
    CHECK (notes IS NULL OR char_length(notes) <= 280) NOT VALID;

CREATE UNIQUE INDEX IF NOT EXISTS uq_payments_invoice_idempotency
  ON public.payments(invoice_id, idempotency_key)
  WHERE idempotency_key IS NOT NULL;

CREATE INDEX IF NOT EXISTS idx_payments_invoice_paid_created
  ON public.payments(invoice_id, paid_at DESC, created_at DESC);

-- ============================================================
-- 2) Prevent invoice total from dropping below amount_paid
-- ============================================================

CREATE OR REPLACE FUNCTION public.guard_invoice_total_not_below_paid()
RETURNS trigger
LANGUAGE plpgsql
AS $$
BEGIN
  IF NEW.total < NEW.amount_paid THEN
    RAISE EXCEPTION USING MESSAGE = 'INVOICE_TOTAL_BELOW_PAID';
  END IF;

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS enforce_invoice_total_not_below_paid ON public.invoices;

CREATE TRIGGER enforce_invoice_total_not_below_paid
BEFORE UPDATE OF total ON public.invoices
FOR EACH ROW
EXECUTE FUNCTION public.guard_invoice_total_not_below_paid();

-- ============================================================
-- 3) Atomic record-payment RPC with deterministic status precedence
-- ============================================================

CREATE OR REPLACE FUNCTION public.record_invoice_payment(
  p_clinic_id uuid,
  p_invoice_id uuid,
  p_amount numeric,
  p_method public.payment_method,
  p_paid_at timestamptz,
  p_reference_note text DEFAULT NULL,
  p_idempotency_key text DEFAULT NULL
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY INVOKER
AS $$
DECLARE
  v_invoice public.invoices%ROWTYPE;
  v_payment public.payments%ROWTYPE;
  v_existing_payment public.payments%ROWTYPE;
  v_note text := NULLIF(BTRIM(COALESCE(p_reference_note, '')), '');
  v_idempotency_key text := NULLIF(BTRIM(COALESCE(p_idempotency_key, '')), '');
  v_amount numeric(10,2);
  v_amount_paid_new numeric(10,2);
  v_status public.invoice_status;
  v_paid_at timestamptz := COALESCE(p_paid_at, now());
BEGIN
  IF v_note IS NOT NULL AND char_length(v_note) > 280 THEN
    RAISE EXCEPTION USING MESSAGE = 'REFERENCE_NOTE_TOO_LONG';
  END IF;

  IF p_amount IS NULL OR p_amount <= 0 OR p_amount <> ROUND(p_amount, 2) THEN
    RAISE EXCEPTION USING MESSAGE = 'INVALID_AMOUNT';
  END IF;

  v_amount := ROUND(p_amount, 2);

  SELECT * INTO v_invoice
  FROM public.invoices i
  WHERE i.id = p_invoice_id
    AND i.clinic_id = p_clinic_id
  FOR UPDATE;

  IF NOT FOUND THEN
    RAISE EXCEPTION USING MESSAGE = 'INVOICE_NOT_FOUND';
  END IF;

  IF v_invoice.status NOT IN (
    'sent'::public.invoice_status,
    'overdue'::public.invoice_status,
    'partially_paid'::public.invoice_status
  ) THEN
    RAISE EXCEPTION USING MESSAGE = 'INVOICE_STATUS_INVALID';
  END IF;

  IF v_invoice.total <= 0 THEN
    RAISE EXCEPTION USING MESSAGE = 'INVALID_INVOICE_TOTAL';
  END IF;

  IF v_idempotency_key IS NOT NULL THEN
    SELECT * INTO v_existing_payment
    FROM public.payments p
    WHERE p.invoice_id = v_invoice.id
      AND p.idempotency_key = v_idempotency_key
    ORDER BY p.created_at DESC
    LIMIT 1;

    IF FOUND THEN
      RETURN jsonb_build_object(
        'paymentId', v_existing_payment.id,
        'invoiceId', v_invoice.id,
        'amountPaid', v_invoice.amount_paid,
        'total', v_invoice.total,
        'outstanding', GREATEST(v_invoice.total - v_invoice.amount_paid, 0),
        'status', v_invoice.status,
        'alreadyRecorded', true,
        'message', 'PAYMENT_ALREADY_RECORDED',
        'payment', jsonb_build_object(
          'id', v_existing_payment.id,
          'invoiceId', v_existing_payment.invoice_id,
          'amount', v_existing_payment.amount,
          'method', v_existing_payment.method,
          'notes', v_existing_payment.notes,
          'paidAt', v_existing_payment.paid_at,
          'createdAt', v_existing_payment.created_at,
          'recordedBy', v_existing_payment.recorded_by
        )
      );
    END IF;
  END IF;

  v_amount_paid_new := v_invoice.amount_paid + v_amount;

  IF v_amount_paid_new > v_invoice.total THEN
    RAISE EXCEPTION USING MESSAGE = 'PAYMENT_EXCEEDS_OUTSTANDING';
  END IF;

  INSERT INTO public.payments (
    clinic_id,
    invoice_id,
    amount,
    method,
    notes,
    paid_at,
    recorded_by,
    idempotency_key
  )
  VALUES (
    v_invoice.clinic_id,
    v_invoice.id,
    v_amount,
    p_method,
    v_note,
    v_paid_at,
    auth.uid(),
    v_idempotency_key
  )
  RETURNING * INTO v_payment;

  IF v_amount_paid_new >= v_invoice.total THEN
    v_status := 'paid'::public.invoice_status;
  ELSIF v_invoice.due_date IS NOT NULL AND v_invoice.due_date < CURRENT_DATE THEN
    v_status := 'overdue'::public.invoice_status;
  ELSE
    v_status := 'partially_paid'::public.invoice_status;
  END IF;

  UPDATE public.invoices
  SET
    amount_paid = v_amount_paid_new,
    status = v_status
  WHERE id = v_invoice.id
  RETURNING * INTO v_invoice;

  RETURN jsonb_build_object(
    'paymentId', v_payment.id,
    'invoiceId', v_invoice.id,
    'amountPaid', v_invoice.amount_paid,
    'total', v_invoice.total,
    'outstanding', GREATEST(v_invoice.total - v_invoice.amount_paid, 0),
    'status', v_invoice.status,
    'alreadyRecorded', false,
    'message', NULL,
    'payment', jsonb_build_object(
      'id', v_payment.id,
      'invoiceId', v_payment.invoice_id,
      'amount', v_payment.amount,
      'method', v_payment.method,
      'notes', v_payment.notes,
      'paidAt', v_payment.paid_at,
      'createdAt', v_payment.created_at,
      'recordedBy', v_payment.recorded_by
    )
  );
END;
$$;
