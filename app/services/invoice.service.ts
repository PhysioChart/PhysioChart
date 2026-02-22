import type { SupabaseClient } from '@supabase/supabase-js'
import type { Database, InsertDto } from '~/types/database'
import type { IInvoiceWithRelations } from '~/types/models/invoice.types'

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

  async function create(invoice: InsertDto<'invoices'>): Promise<void> {
    const { error } = await supabase.from('invoices').insert(invoice)

    if (error) throw error
  }

  async function nextInvoiceNumber(clinicId: string): Promise<string> {
    const dateStr = (new Date().toISOString().split('T')[0] ?? '').replace(/-/g, '')
    const { count, error } = await supabase
      .from('invoices')
      .select('id', { count: 'exact', head: true })
      .eq('clinic_id', clinicId)

    if (error) throw error
    return `INV-${dateStr}-${String((count ?? 0) + 1).padStart(3, '0')}`
  }

  return { list, create, nextInvoiceNumber }
}
