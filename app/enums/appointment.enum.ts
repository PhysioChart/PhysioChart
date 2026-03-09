export const AppointmentStatus = {
  SCHEDULED: 'scheduled',
  CHECKED_IN: 'checked_in',
  COMPLETED: 'completed',
  CANCELLED: 'cancelled',
  NO_SHOW: 'no_show',
} as const

export type AppointmentStatus = (typeof AppointmentStatus)[keyof typeof AppointmentStatus]

export const APPOINTMENT_STATUS_VALUES = Object.values(AppointmentStatus)

export const APPOINTMENT_STATUS_LABELS: Record<AppointmentStatus, string> = {
  [AppointmentStatus.SCHEDULED]: 'Scheduled',
  [AppointmentStatus.CHECKED_IN]: 'Checked In',
  [AppointmentStatus.COMPLETED]: 'Completed',
  [AppointmentStatus.CANCELLED]: 'Cancelled',
  [AppointmentStatus.NO_SHOW]: 'No Show',
}
