export const TreatmentStatus = {
  ACTIVE: 'active',
  COMPLETED: 'completed',
  CANCELLED: 'cancelled',
} as const

export type TreatmentStatus = (typeof TreatmentStatus)[keyof typeof TreatmentStatus]

export const TREATMENT_STATUS_VALUES = Object.values(TreatmentStatus)

export const TREATMENT_STATUS_LABELS: Record<TreatmentStatus, string> = {
  [TreatmentStatus.ACTIVE]: 'Active',
  [TreatmentStatus.COMPLETED]: 'Completed',
  [TreatmentStatus.CANCELLED]: 'Cancelled',
}
