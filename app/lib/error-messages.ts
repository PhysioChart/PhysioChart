import { AppointmentErrorCode } from '~/enums/appointment-error.enum'
import { InvoiceErrorCode } from '~/enums/invoice-error.enum'
import { PaymentErrorCode } from '~/enums/payment-error.enum'

const GENERIC_ERROR = 'Something went wrong. Please try again.'

export function getAppointmentErrorMessage(codeOrMessage: string): string {
  switch (codeOrMessage) {
    case AppointmentErrorCode.INVALID_CLINIC_ID:
      return 'Clinic context is missing. Please refresh and try again.'
    case AppointmentErrorCode.CLINIC_SCOPE_MISMATCH:
      return 'You are not allowed to access this clinic.'
    case AppointmentErrorCode.APPOINTMENT_NOT_FOUND:
      return 'Appointment not found or inaccessible.'
    case AppointmentErrorCode.INVALID_APPOINTMENT_RANGE:
      return 'Appointment start and end time are invalid.'
    case AppointmentErrorCode.INVALID_STATUS_TRANSITION:
      return 'Only scheduled or checked-in appointments can be completed.'
    case AppointmentErrorCode.APPOINTMENT_ALREADY_CREATED:
      return 'Appointment already created for this request.'
    case AppointmentErrorCode.IDEMPOTENCY_KEY_REQUIRED:
      return 'Please retry the booking request.'
    case AppointmentErrorCode.TREATMENT_PLAN_NOT_FOUND:
      return 'Treatment plan not found.'
    case AppointmentErrorCode.TREATMENT_PLAN_NOT_ACTIVE:
      return 'Only active treatment plans can be linked to new appointments.'
    case AppointmentErrorCode.PATIENT_NOT_FOUND:
      return 'Patient not found.'
    case AppointmentErrorCode.PATIENT_CLINIC_MISMATCH:
      return 'Selected patient does not belong to this clinic.'
    case AppointmentErrorCode.THERAPIST_NOT_FOUND:
      return 'Therapist not found.'
    case AppointmentErrorCode.THERAPIST_CLINIC_MISMATCH:
      return 'Selected therapist does not belong to this clinic.'
    case AppointmentErrorCode.TREATMENT_PLAN_CLINIC_MISMATCH:
      return 'Selected treatment plan does not belong to this clinic.'
    case AppointmentErrorCode.PATIENT_PLAN_MISMATCH:
      return 'The linked treatment plan does not match this patient.'
    case AppointmentErrorCode.NOTE_TOO_LONG:
      return 'Session note must be 1000 characters or fewer.'
    case AppointmentErrorCode.REOPEN_WINDOW_EXPIRED:
      return 'This appointment can now only be reopened by an admin.'
    case AppointmentErrorCode.FORBIDDEN_REOPEN:
      return 'You do not have permission to reopen this appointment.'
    case AppointmentErrorCode.NOT_COMPLETED:
      return 'Only completed appointments can be reopened.'
    case AppointmentErrorCode.REOPEN_NO_ACTIVE_SESSION:
      return 'Appointment reopened. No active session was found.'
    case AppointmentErrorCode.PRACTITIONER_REQUIRED:
      return 'Assign a therapist before completing this appointment.'
    default:
      console.error('[AppointmentError] Unmapped code:', codeOrMessage)
      return GENERIC_ERROR
  }
}

export function getInvoiceErrorMessage(err: unknown): string {
  const raw = err instanceof Error ? err.message : String(err)

  if (raw.includes(InvoiceErrorCode.INVALID_CLINIC_ID)) {
    return 'Clinic context is invalid. Please reload and try again.'
  }
  if (raw.includes(InvoiceErrorCode.CLINIC_SCOPE_MISMATCH)) {
    return 'You are not allowed to create invoices for this clinic.'
  }
  if (
    raw.includes(InvoiceErrorCode.PATIENT_NOT_FOUND) ||
    raw.includes(InvoiceErrorCode.PATIENT_CLINIC_MISMATCH)
  ) {
    return 'Selected patient is unavailable.'
  }
  if (
    raw.includes(InvoiceErrorCode.TREATMENT_PLAN_NOT_FOUND) ||
    raw.includes(InvoiceErrorCode.TREATMENT_PLAN_CLINIC_MISMATCH) ||
    raw.includes(InvoiceErrorCode.PATIENT_PLAN_MISMATCH)
  ) {
    return 'Selected treatment plan is unavailable.'
  }
  if (raw.includes(InvoiceErrorCode.TREATMENT_PLAN_CANCELLED)) {
    return 'Cancelled treatment plans cannot be linked to invoices.'
  }
  if (raw.includes(InvoiceErrorCode.IDEMPOTENCY_KEY_REQUIRED)) {
    return 'Request key missing. Please try again.'
  }
  if (
    raw.includes(InvoiceErrorCode.INVALID_LINE_ITEMS) ||
    raw.includes(InvoiceErrorCode.LINE_ITEM_DESCRIPTION_REQUIRED) ||
    raw.includes(InvoiceErrorCode.INVALID_LINE_ITEM_QUANTITY) ||
    raw.includes(InvoiceErrorCode.INVALID_LINE_ITEM_PRICE)
  ) {
    return 'Please review line items and try again.'
  }
  if (raw.includes(InvoiceErrorCode.INVALID_INVOICE_TOTAL)) {
    return 'Invoice total must be greater than zero and valid.'
  }
  if (raw.includes(InvoiceErrorCode.INVOICE_ALREADY_CREATED)) {
    return 'Invoice already created.'
  }
  if (raw.includes(InvoiceErrorCode.INVOICE_NUMBER_GENERATION_FAILED)) {
    return 'Unable to generate invoice number. Please try again.'
  }
  if (raw.includes(InvoiceErrorCode.INVOICE_CREATE_RETRY_EXHAUSTED)) {
    return 'Invoice creation failed after multiple attempts. Please try again.'
  }
  if (raw.includes(InvoiceErrorCode.INVALID_CREATE_INVOICE_RESPONSE)) {
    return 'Unexpected response from server. Please try again.'
  }

  console.error('[InvoiceError] Unmapped error:', raw)
  return GENERIC_ERROR
}

export function getPaymentErrorMessage(err: unknown): string {
  const raw = err instanceof Error ? err.message : String(err)

  if (raw.includes(PaymentErrorCode.INVOICE_NOT_FOUND)) {
    return 'Invoice not found.'
  }
  if (raw.includes(PaymentErrorCode.INVOICE_STATUS_INVALID)) {
    return 'Payments can be recorded only for sent, overdue, or partially paid invoices.'
  }
  if (raw.includes(PaymentErrorCode.INVALID_AMOUNT)) {
    return 'Amount must be greater than zero and use at most 2 decimal places.'
  }
  if (raw.includes(PaymentErrorCode.INVALID_INVOICE_TOTAL)) {
    return 'Invoice total must be greater than zero before recording a payment.'
  }
  if (raw.includes(PaymentErrorCode.PAYMENT_EXCEEDS_OUTSTANDING)) {
    return 'Payment amount exceeds the outstanding balance.'
  }
  if (raw.includes(PaymentErrorCode.REFERENCE_NOTE_TOO_LONG)) {
    return 'Reference note must be 280 characters or less.'
  }
  if (raw.includes(PaymentErrorCode.PAYMENT_ALREADY_RECORDED)) {
    return 'Payment already recorded.'
  }
  if (raw.includes(PaymentErrorCode.INVOICE_TOTAL_BELOW_PAID)) {
    return 'Invoice total cannot be less than amount already paid.'
  }

  console.error('[PaymentError] Unmapped error:', raw)
  return GENERIC_ERROR
}
