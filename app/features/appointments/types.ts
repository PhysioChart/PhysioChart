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
