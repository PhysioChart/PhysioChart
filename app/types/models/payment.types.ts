import type { Tables } from '~/types/database'

export interface IPaymentWithRelations extends Tables<'payments'> {
  invoice: Tables<'invoices'> | null
}
