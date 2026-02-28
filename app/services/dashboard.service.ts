import type { SupabaseClient } from '@supabase/supabase-js'
import type { Database } from '~/types/database'
import { TreatmentStatus } from '~/enums/treatment.enum'

export interface IDashboardCounts {
  todayAppointments: number
  totalPatients: number
  activeTreatments: number
}

export function dashboardService(supabase: SupabaseClient<Database>) {
  async function getCounts(clinicId: string, todayDateKey: string): Promise<IDashboardCounts> {
    const tomorrow = new Date(`${todayDateKey}T00:00:00`)
    tomorrow.setDate(tomorrow.getDate() + 1)
    const tomorrowDateKey = `${tomorrow.getFullYear()}-${String(tomorrow.getMonth() + 1).padStart(2, '0')}-${String(tomorrow.getDate()).padStart(2, '0')}`

    const [patientsRes, appointmentsRes, treatmentsRes] = await Promise.all([
      supabase
        .from('patients')
        .select('id', { count: 'exact', head: true })
        .eq('clinic_id', clinicId),
      supabase
        .from('appointments')
        .select('id', { count: 'exact', head: true })
        .eq('clinic_id', clinicId)
        .gte('start_time', `${todayDateKey}T00:00:00`)
        .lt('start_time', `${tomorrowDateKey}T00:00:00`),
      supabase
        .from('treatment_plans')
        .select('id', { count: 'exact', head: true })
        .eq('clinic_id', clinicId)
        .eq('status', TreatmentStatus.ACTIVE),
    ])

    if (patientsRes.error) throw patientsRes.error
    if (appointmentsRes.error) throw appointmentsRes.error
    if (treatmentsRes.error) throw treatmentsRes.error

    return {
      todayAppointments: appointmentsRes.count ?? 0,
      totalPatients: patientsRes.count ?? 0,
      activeTreatments: treatmentsRes.count ?? 0,
    }
  }

  return { getCounts }
}
