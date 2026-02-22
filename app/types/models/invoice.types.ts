import type { Tables } from '~/types/database'

export interface IInvoiceWithRelations extends Tables<'invoices'> {
  patient: Tables<'patients'> | null
}

export interface IInvoiceLineItem {
  description: string
  quantity: number
  unit_price: number
  total: number
}
