import type { AppointmentRow, PatientRow, ProfileRow, TreatmentPlanRow } from '~/types/database'

export interface ITreatmentPlanWithRelations extends TreatmentPlanRow {
  patient: PatientRow | null
  therapist: ProfileRow | null
  derived_completed_sessions: number
}

export interface ITreatmentSessionHistoryItem {
  sessionId: string
  appointmentId: string | null
  finalizedAt: string
  note: string | null
}

export interface ITreatmentLinkedAppointmentItem {
  id: string
  startTime: string
  endTime: string
  status: AppointmentRow['status']
}
