import type { Tables } from '~/types/database'

export interface ITreatmentPlanWithRelations extends Tables<'treatment_plans'> {
  patient: Tables<'patients'> | null
  therapist: Tables<'profiles'> | null
}
