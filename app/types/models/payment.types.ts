import type { InvoiceRow, PaymentRow } from '~/types/database'

export interface IPaymentWithRelations extends PaymentRow {
  invoice: InvoiceRow | null
}
