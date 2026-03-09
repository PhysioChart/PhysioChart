import type { SupabaseClient } from '@supabase/supabase-js'
import type { Database, Json, Tables } from '~/types/database'
import type { IInvoiceLineItem, IInvoiceWithRelations } from '~/types/models/invoice.types'

export interface ICreateInvoiceInput {
  clinicId: string
  patientId: string
  treatmentPlanId?: string | null
  lineItems: IInvoiceLineItem[]
  dueDate?: string | null
  notes?: string | null
  idempotencyKey: string
}

export interface ICreateInvoiceResult {
  invoiceId: string
  alreadyCreated: boolean
  message: string | null
  invoice: IInvoiceWithRelations
}

function isPatient(payload: unknown): payload is Tables<'patients'> {
  if (!payload || typeof payload !== 'object') return false
  const value = payload as Partial<Tables<'patients'>>

  return (
    typeof value.id === 'string' &&
    typeof value.clinic_id === 'string' &&
    typeof value.full_name === 'string' &&
    typeof value.phone === 'string' &&
    (typeof value.email === 'string' || value.email === null) &&
    (typeof value.date_of_birth === 'string' || value.date_of_birth === null) &&
    (typeof value.gender === 'string' || value.gender === null) &&
    (typeof value.address === 'string' || value.address === null) &&
    (typeof value.emergency_contact_name === 'string' || value.emergency_contact_name === null) &&
    (typeof value.emergency_contact_phone === 'string' || value.emergency_contact_phone === null) &&
    !!value.medical_history &&
    typeof value.medical_history === 'object' &&
    (typeof value.notes === 'string' || value.notes === null) &&
    typeof value.is_archived === 'boolean' &&
    typeof value.created_at === 'string' &&
    typeof value.updated_at === 'string'
  )
}

function isInvoiceWithRelations(payload: unknown): payload is IInvoiceWithRelations {
  if (!payload || typeof payload !== 'object') return false
  const value = payload as Partial<IInvoiceWithRelations>

  return (
    typeof value.id === 'string' &&
    typeof value.clinic_id === 'string' &&
    typeof value.patient_id === 'string' &&
    (typeof value.treatment_plan_id === 'string' || value.treatment_plan_id === null) &&
    typeof value.invoice_number === 'string' &&
    Array.isArray(value.line_items) &&
    typeof value.subtotal === 'number' &&
    typeof value.tax === 'number' &&
    typeof value.total === 'number' &&
    typeof value.amount_paid === 'number' &&
    typeof value.status === 'string' &&
    (typeof value.due_date === 'string' || value.due_date === null) &&
    (typeof value.notes === 'string' || value.notes === null) &&
    typeof value.created_at === 'string' &&
    typeof value.updated_at === 'string' &&
    (typeof value.idempotency_key === 'string' || value.idempotency_key === null) &&
    (value.patient === null || isPatient(value.patient))
  )
}

function isCreateInvoiceResult(payload: unknown): payload is ICreateInvoiceResult {
  if (!payload || typeof payload !== 'object') return false
  const value = payload as Partial<ICreateInvoiceResult>

  return (
    typeof value.invoiceId === 'string' &&
    typeof value.alreadyCreated === 'boolean' &&
    (typeof value.message === 'string' || value.message === null) &&
    isInvoiceWithRelations(value.invoice)
  )
}

export function invoiceService(supabase: SupabaseClient<Database>) {
  async function list(clinicId: string): Promise<IInvoiceWithRelations[]> {
    const { data, error } = await supabase
      .from('invoices')
      .select('*, patient:patients(*)')
      .eq('clinic_id', clinicId)
      .order('created_at', { ascending: false })

    if (error) throw error
    return (data ?? []) as IInvoiceWithRelations[]
  }

  async function getByPatientId(
    clinicId: string,
    patientId: string,
  ): Promise<IInvoiceWithRelations[]> {
    const { data, error } = await supabase
      .from('invoices')
      .select('*, patient:patients(*)')
      .eq('clinic_id', clinicId)
      .eq('patient_id', patientId)
      .order('created_at', { ascending: false })

    if (error) throw error
    return (data ?? []) as IInvoiceWithRelations[]
  }

  async function createInvoice(payload: ICreateInvoiceInput): Promise<ICreateInvoiceResult> {
    const { data, error } = await supabase.rpc('create_invoice', {
      p_clinic_id: payload.clinicId,
      p_patient_id: payload.patientId,
      p_treatment_plan_id: payload.treatmentPlanId ?? undefined,
      p_line_items: payload.lineItems as unknown as Json,
      p_due_date: payload.dueDate ?? undefined,
      p_notes: payload.notes ?? undefined,
      p_idempotency_key: payload.idempotencyKey,
    })

    if (error) throw error
    if (!isCreateInvoiceResult(data)) {
      throw new Error('INVALID_CREATE_INVOICE_RESPONSE')
    }

    return data
  }

  return { list, getByPatientId, createInvoice }
}
