import type { Tables } from '~/types/database'

export interface IPatientWithRelations extends Tables<'patients'> {
  appointments?: Tables<'appointments'>[]
  treatment_plans?: Tables<'treatment_plans'>[]
  invoices?: Tables<'invoices'>[]
}
