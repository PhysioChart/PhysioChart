export const Gender = {
  MALE: 'male',
  FEMALE: 'female',
  OTHER: 'other',
} as const

export type Gender = (typeof Gender)[keyof typeof Gender]

export const GENDER_VALUES = Object.values(Gender)

export const GENDER_LABELS: Record<Gender, string> = {
  [Gender.MALE]: 'Male',
  [Gender.FEMALE]: 'Female',
  [Gender.OTHER]: 'Other',
}
