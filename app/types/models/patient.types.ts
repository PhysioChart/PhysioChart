import type { AppointmentRow, InvoiceRow, PatientRow, TreatmentPlanRow } from '~/types/database'

/** Shape of the JSONB `medical_history` column on `patients`. */
export interface MedicalHistory {
  allergies?: string[]
  current_medications?: string[]
  past_surgeries?: string[]
  conditions?: string[]
  notes?: string
}

export interface IPatientWithRelations extends PatientRow {
  appointments?: AppointmentRow[]
  treatment_plans?: TreatmentPlanRow[]
  invoices?: InvoiceRow[]
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
