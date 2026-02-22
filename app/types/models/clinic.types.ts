import type { Tables } from '~/types/database'

export interface IClinicWithRelations extends Tables<'clinics'> {
  profiles?: Tables<'profiles'>[]
}
