import type { SupabaseClient } from '@supabase/supabase-js'
import type { Database, Tables, InsertDto } from '~/types/database'

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

    if (error) throw error
    return data ?? []
  }

  async function create(payment: InsertDto<'payments'>): Promise<void> {
    const { error } = await supabase.from('payments').insert(payment)

    if (error) throw error
  }

  return { listForInvoice, create }
}
