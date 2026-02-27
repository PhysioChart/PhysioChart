import type { Tables } from '~/types/database'
import type { AppointmentStatus } from '~/enums/appointment.enum'

export interface IAppointmentWithRelations extends Tables<'appointments'> {
  patient: Tables<'patients'> | null
  therapist: Tables<'profiles'> | null
  treatment_plan?: Pick<
    Tables<'treatment_plans'>,
    'name' | 'completed_sessions' | 'total_sessions'
  > | null
}

export interface IAppointmentFilters {
  status?: AppointmentStatus
  therapistId?: string
  dateFrom?: string
  dateTo?: string
}
