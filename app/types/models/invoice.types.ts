import type { InvoiceRow, PatientRow } from '~/types/database'

export interface IInvoiceWithRelations extends InvoiceRow {
  patient: PatientRow | null
}

export interface IInvoiceLineItem {
  description: string
  quantity: number
  unit_price: number
  total: number
}
