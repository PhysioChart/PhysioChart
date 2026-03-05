import type { Tables } from '~/types/database'
import type { AppointmentStatus } from '~/enums/appointment.enum'
import type { TreatmentStatus } from '~/enums/treatment.enum'

export interface IAppointmentTreatmentPlanSummary {
  id: string
  name: string
  status: TreatmentStatus
  diagnosis: string | null
  treatment_type: string | null
  total_sessions: number | null
  derived_completed_sessions: number
}

export interface IAppointmentWithRelations extends Tables<'appointments'> {
  patient: Tables<'patients'> | null
  therapist: Tables<'profiles'> | null
  treatment_plan: IAppointmentTreatmentPlanSummary | null
}

export interface IAppointmentFilters {
  status?: AppointmentStatus
  therapistId?: string
  dateFrom?: string
  dateTo?: string
}
