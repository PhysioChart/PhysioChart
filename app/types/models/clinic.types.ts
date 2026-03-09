import type { ClinicRow, ProfileRow } from '~/types/database'

export interface IClinicWithRelations extends ClinicRow {
  profiles?: ProfileRow[]
}
