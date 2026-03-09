import type {
  ITreatmentPlanProgressSummary,
  ICompleteAppointmentResult,
  IReopenAppointmentResult,
  ICreateTreatmentLinkedAppointmentResult,
} from '~/types/models/appointment.types'

export function isTreatmentPlanProgressSummary(
  value: unknown,
): value is ITreatmentPlanProgressSummary {
  if (!value || typeof value !== 'object') return false
  const progress = value as Record<string, unknown>
  return (
    typeof progress.completed === 'number' &&
    (typeof progress.total === 'number' || progress.total === null) &&
    typeof progress.extended === 'boolean' &&
    typeof progress.suggested_completed === 'boolean'
  )
}

export function isCompleteAppointmentResult(value: unknown): value is ICompleteAppointmentResult {
  if (!value || typeof value !== 'object') return false
  const payload = value as Record<string, unknown>
  const hasValidProgress =
    payload.planProgress === null || isTreatmentPlanProgressSummary(payload.planProgress)

  const planStatusOk =
    payload.planStatus === undefined ||
    payload.planStatus === null ||
    typeof payload.planStatus === 'string'

  const planCompletedOk =
    payload.planCompleted === undefined ||
    payload.planCompleted === null ||
    typeof payload.planCompleted === 'boolean'

  return (
    typeof payload.appointmentCompleted === 'boolean' &&
    typeof payload.sessionCreated === 'boolean' &&
    (typeof payload.sessionId === 'string' || payload.sessionId === null) &&
    hasValidProgress &&
    planStatusOk &&
    planCompletedOk
  )
}

export function isReopenAppointmentResult(value: unknown): value is IReopenAppointmentResult {
  if (!value || typeof value !== 'object') return false
  const payload = value as Record<string, unknown>
  return (
    typeof payload.reopened === 'boolean' &&
    typeof payload.sessionVoided === 'boolean' &&
    (typeof payload.message === 'string' ||
      payload.message === null ||
      payload.message === undefined) &&
    (payload.planStatus === undefined ||
      payload.planStatus === null ||
      typeof payload.planStatus === 'string') &&
    (payload.planCompleted === undefined ||
      payload.planCompleted === null ||
      typeof payload.planCompleted === 'boolean')
  )
}

export function isCreateTreatmentLinkedAppointmentResult(
  value: unknown,
): value is ICreateTreatmentLinkedAppointmentResult {
  if (!value || typeof value !== 'object') return false
  const payload = value as Record<string, unknown>
  if (
    typeof payload.appointmentId !== 'string' ||
    typeof payload.alreadyCreated !== 'boolean' ||
    (typeof payload.message !== 'string' && payload.message !== null)
  ) {
    return false
  }

  const appointment = payload.appointment
  const treatmentSummary = payload.treatmentSummary
  if (!appointment || typeof appointment !== 'object') return false
  if (!treatmentSummary || typeof treatmentSummary !== 'object') return false

  const appointmentObj = appointment as Record<string, unknown>
  const treatmentSummaryObj = treatmentSummary as Record<string, unknown>

  return (
    typeof appointmentObj.id === 'string' &&
    typeof appointmentObj.patientId === 'string' &&
    (typeof appointmentObj.therapistId === 'string' || appointmentObj.therapistId === null) &&
    (typeof appointmentObj.treatmentPlanId === 'string' ||
      appointmentObj.treatmentPlanId === null) &&
    typeof appointmentObj.startTime === 'string' &&
    typeof appointmentObj.endTime === 'string' &&
    typeof appointmentObj.status === 'string' &&
    (typeof appointmentObj.notes === 'string' || appointmentObj.notes === null) &&
    typeof treatmentSummaryObj.id === 'string' &&
    typeof treatmentSummaryObj.patientId === 'string' &&
    typeof treatmentSummaryObj.name === 'string' &&
    typeof treatmentSummaryObj.status === 'string' &&
    (typeof treatmentSummaryObj.totalSessions === 'number' ||
      treatmentSummaryObj.totalSessions === null)
  )
}
