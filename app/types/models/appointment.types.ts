import type { AppointmentRow, PatientRow, ProfileRow } from '~/types/database'
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

export interface IAppointmentWithRelations extends AppointmentRow {
  patient: PatientRow | null
  therapist: ProfileRow | null
  treatment_plan: IAppointmentTreatmentPlanSummary | null
}

export interface IAppointmentFilters {
  status?: AppointmentStatus
  therapistId?: string
  dateFrom?: string
  dateTo?: string
}

export interface IAppointmentBlockingInterval {
  id: string
  start_time: string
  end_time: string
}

export interface IAppointmentConflictMetadata {
  conflictingAppointmentId: string
  conflictingStartTime: string
  conflictingEndTime: string
}

export interface ISeriesConflictMetadata {
  occurrenceStartTime: string
  occurrenceEndTime: string
  conflictingAppointmentId?: string
  conflictingStartTime?: string
  conflictingEndTime?: string
}

export interface ITreatmentPlanProgressSummary {
  completed: number
  total: number | null
  extended: boolean
  suggested_completed: boolean
}

export interface ICompleteAppointmentResult {
  appointmentCompleted: boolean
  sessionCreated: boolean
  sessionId: string | null
  planProgress: ITreatmentPlanProgressSummary | null
  message?: string | null
  planStatus?: string | null
  planCompleted?: boolean | null
}

export interface IReopenAppointmentResult {
  reopened: boolean
  sessionVoided: boolean
  message?: string | null
  planStatus?: string | null
  planCompleted?: boolean | null
}

export interface ICreateTreatmentLinkedAppointmentInput {
  clinicId: string
  treatmentPlanId: string
  therapistId: string
  startTime: string
  endTime: string
  notes?: string | null
  idempotencyKey: string
}

export interface ICreateTreatmentLinkedAppointmentResult {
  appointmentId: string
  alreadyCreated: boolean
  message: string | null
  appointment: {
    id: string
    patientId: string
    therapistId: string | null
    treatmentPlanId: string | null
    startTime: string
    endTime: string
    status: string
    notes: string | null
  }
  treatmentSummary: {
    id: string
    patientId: string
    name: string
    status: string
    totalSessions: number | null
  }
}
