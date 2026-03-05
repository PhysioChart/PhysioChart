import type { SupabaseClient } from '@supabase/supabase-js'
import type { Database, Tables, InsertDto } from '~/types/database'

export interface IRecordInvoicePaymentInput {
  clinicId: string
  invoiceId: string
  amount: number
  method: Tables<'payments'>['method']
  paidAt: string
  referenceNote?: string | null
  idempotencyKey?: string | null
}

export interface IRecordedPayment {
  id: string
  invoiceId: string
  amount: number
  method: Tables<'payments'>['method']
  notes: string | null
  paidAt: string
  createdAt: string
  recordedBy: string | null
}

export interface IRecordInvoicePaymentResult {
  paymentId: string
  invoiceId: string
  amountPaid: number
  total: number
  outstanding: number
  status: Tables<'invoices'>['status']
  alreadyRecorded: boolean
  message: string | null
  payment: IRecordedPayment
}

function isRecordedPayment(payload: unknown): payload is IRecordedPayment {
  if (!payload || typeof payload !== 'object') return false
  const value = payload as Partial<IRecordedPayment>

  return (
    typeof value.id === 'string' &&
    typeof value.invoiceId === 'string' &&
    typeof value.amount === 'number' &&
    typeof value.method === 'string' &&
    (typeof value.notes === 'string' || value.notes === null) &&
    typeof value.paidAt === 'string' &&
    typeof value.createdAt === 'string' &&
    (typeof value.recordedBy === 'string' || value.recordedBy === null)
  )
}

function isRecordInvoicePaymentResult(payload: unknown): payload is IRecordInvoicePaymentResult {
  if (!payload || typeof payload !== 'object') return false
  const value = payload as Partial<IRecordInvoicePaymentResult>

  return (
    typeof value.paymentId === 'string' &&
    typeof value.invoiceId === 'string' &&
    typeof value.amountPaid === 'number' &&
    typeof value.total === 'number' &&
    typeof value.outstanding === 'number' &&
    typeof value.status === 'string' &&
    typeof value.alreadyRecorded === 'boolean' &&
    (typeof value.message === 'string' || value.message === null) &&
    isRecordedPayment(value.payment)
  )
}

export function paymentService(supabase: SupabaseClient<Database>) {
  async function listForInvoice(
    clinicId: string,
    invoiceId: string,
  ): Promise<Tables<'payments'>[]> {
    const { data, error } = await supabase
      .from('payments')
      .select('*')
      .eq('clinic_id', clinicId)
      .eq('invoice_id', invoiceId)
      .order('paid_at', { ascending: false })
      .order('created_at', { ascending: false })

    if (error) throw error
    return data ?? []
  }

  async function create(payment: InsertDto<'payments'>): Promise<void> {
    const { error } = await supabase.from('payments').insert(payment)

    if (error) throw error
  }

  async function recordForInvoice(
    payload: IRecordInvoicePaymentInput,
  ): Promise<IRecordInvoicePaymentResult> {
    const { data, error } = await supabase.rpc('record_invoice_payment', {
      p_clinic_id: payload.clinicId,
      p_invoice_id: payload.invoiceId,
      p_amount: payload.amount,
      p_method: payload.method,
      p_paid_at: payload.paidAt,
      p_reference_note: payload.referenceNote ?? null,
      p_idempotency_key: payload.idempotencyKey ?? null,
    })

    if (error) throw error
    if (!isRecordInvoicePaymentResult(data)) {
      throw new Error('INVALID_RECORD_PAYMENT_RESPONSE')
    }

    return data
  }

  return { listForInvoice, create, recordForInvoice }
}
