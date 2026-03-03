import type { SupabaseClient } from '@supabase/supabase-js'
import type { Database, InsertDto, UpdateDto } from '~/types/database'
import type { ITreatmentPlanWithRelations } from '~/types/models/treatment.types'

interface ITreatmentPlanProgressRow {
  plan_id: string
  completed_sessions: number
}

export function treatmentService(supabase: SupabaseClient<Database>) {
  async function fetchProgressMap(
    clinicId: string,
    planIds: string[],
  ): Promise<Map<string, number>> {
    if (planIds.length === 0) return new Map<string, number>()

    const { data, error } = await supabase.rpc('get_treatment_plan_progress_bulk', {
      p_clinic_id: clinicId,
      p_plan_ids: Array.from(new Set(planIds)),
    })

    if (error) throw error

    const map = new Map<string, number>()
    for (const row of (data ?? []) as ITreatmentPlanProgressRow[]) {
      map.set(row.plan_id, row.completed_sessions ?? 0)
    }
    return map
  }

  function attachDerivedProgress(
    plans: ITreatmentPlanWithRelations[],
    progressMap: Map<string, number>,
  ): ITreatmentPlanWithRelations[] {
    return plans.map((plan) => ({
      ...plan,
      derived_completed_sessions: progressMap.get(plan.id) ?? 0,
    }))
  }

  async function list(clinicId: string): Promise<ITreatmentPlanWithRelations[]> {
    const { data, error } = await supabase
      .from('treatment_plans')
      .select('*, patient:patients(*), therapist:profiles(*)')
      .eq('clinic_id', clinicId)
      .order('created_at', { ascending: false })

    if (error) throw error
    const plans = (data ?? []) as ITreatmentPlanWithRelations[]
    const progressMap = await fetchProgressMap(
      clinicId,
      plans.map((plan) => plan.id),
    )

    return attachDerivedProgress(plans, progressMap)
  }

  async function getById(
    clinicId: string,
    id: string,
  ): Promise<ITreatmentPlanWithRelations | null> {
    const { data, error } = await supabase
      .from('treatment_plans')
      .select('*, patient:patients(*), therapist:profiles(*)')
      .eq('clinic_id', clinicId)
      .eq('id', id)
      .single()

    if (error) throw error
    if (!data) return null

    const plan = data as ITreatmentPlanWithRelations
    const progressMap = await fetchProgressMap(clinicId, [plan.id])

    return {
      ...plan,
      derived_completed_sessions: progressMap.get(plan.id) ?? 0,
    }
  }

  async function getByPatientId(
    clinicId: string,
    patientId: string,
  ): Promise<ITreatmentPlanWithRelations[]> {
    const { data, error } = await supabase
      .from('treatment_plans')
      .select('*, patient:patients(*), therapist:profiles(*)')
      .eq('clinic_id', clinicId)
      .eq('patient_id', patientId)
      .order('created_at', { ascending: false })

    if (error) throw error
    const plans = (data ?? []) as ITreatmentPlanWithRelations[]
    const progressMap = await fetchProgressMap(
      clinicId,
      plans.map((plan) => plan.id),
    )

    return attachDerivedProgress(plans, progressMap)
  }

  async function create(plan: InsertDto<'treatment_plans'>): Promise<void> {
    const { error } = await supabase.from('treatment_plans').insert(plan).select().single()

    if (error) throw error
  }

  async function update(
    clinicId: string,
    id: string,
    updates: UpdateDto<'treatment_plans'>,
  ): Promise<void> {
    const { error } = await supabase
      .from('treatment_plans')
      .update(updates)
      .eq('clinic_id', clinicId)
      .eq('id', id)

    if (error) throw error
  }

  return { list, getById, getByPatientId, create, update }
}
