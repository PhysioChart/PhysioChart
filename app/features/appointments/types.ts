import type { TherapistColor } from '~/composables/useCalendar'

export type AppointmentBookingMode = 'single' | 'series'
export type AppointmentsViewMode = 'list' | 'day' | 'week'
export type AppointmentsListFilter = 'today' | 'all'

export interface AppointmentFormState {
  patient_id: string
  therapist_id: string
  treatment_plan_id: string
  date: string
  start_time: string
  duration: string
  notes: string
}

export interface SeriesConfigState {
  days: number[]
  totalSessions: number
}

export interface TherapistLegendItem {
  id: string
  name: string
  color: TherapistColor
}

export interface AppointmentTimeOption {
  value: string
  label: string
  disabled: boolean
  disabledReason?: string
}

export interface IBookAppointmentPayload {
  mode: 'single' | 'series'
  patientId: string
  therapistId: string
  treatmentPlanId: string | null
  notes: string | null
  // Single mode
  startTime?: string
  endTime?: string
  singleIdempotencyKey?: string
  linkedIdempotencyKey?: string
  // Series mode
  occurrences?: Array<{ start_time: string; end_time: string; series_index: number }>
  seriesIdempotencyKey?: string
}

export interface ICompleteAppointmentPayload {
  appointmentId: string
  note: string | null
}
