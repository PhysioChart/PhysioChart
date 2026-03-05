import type { Tables } from '~/types/database'

export interface ITreatmentPlanWithRelations extends Tables<'treatment_plans'> {
  patient: Tables<'patients'> | null
  therapist: Tables<'profiles'> | null
  derived_completed_sessions: number
}

export interface ITreatmentSessionHistoryItem {
  sessionId: string
  appointmentId: string | null
  finalizedAt: string
  note: string | null
}
