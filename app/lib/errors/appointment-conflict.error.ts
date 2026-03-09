import { AppointmentErrorCode } from '~/enums/appointment-error.enum'
import type {
  IAppointmentConflictMetadata,
  ISeriesConflictMetadata,
} from '~/types/models/appointment.types'

export class AppointmentConflictError extends Error {
  readonly code = AppointmentErrorCode.APPOINTMENT_DOCTOR_CONFLICT
  readonly status = 409
  conflict?: IAppointmentConflictMetadata
  conflicts?: ISeriesConflictMetadata[]

  constructor(
    message: string,
    args?: { conflict?: IAppointmentConflictMetadata; conflicts?: ISeriesConflictMetadata[] },
  ) {
    super(message)
    this.name = 'AppointmentConflictError'
    this.conflict = args?.conflict
    this.conflicts = args?.conflicts
  }
}
