import type { Tables } from '~/types/database'

export interface IPatientWithRelations extends Tables<'patients'> {
  appointments?: Tables<'appointments'>[]
  treatment_plans?: Tables<'treatment_plans'>[]
  invoices?: Tables<'invoices'>[]
}

export interface IPatientEditForm {
  full_name: string
  phone: string
  email: string
  date_of_birth: string
  gender: string
  address: string
  emergency_contact_name: string
  emergency_contact_phone: string
  notes: string
}
