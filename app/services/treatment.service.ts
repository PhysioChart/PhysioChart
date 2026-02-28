import type { SupabaseClient } from '@supabase/supabase-js'
import type { Database, InsertDto, UpdateDto } from '~/types/database'
import type { ITreatmentPlanWithRelations } from '~/types/models/treatment.types'

export function treatmentService(supabase: SupabaseClient<Database>) {
  async function list(clinicId: string): Promise<ITreatmentPlanWithRelations[]> {
    const { data, error } = await supabase
      .from('treatment_plans')
      .select('*, patient:patients(*), therapist:profiles(*)')
      .eq('clinic_id', clinicId)
      .order('created_at', { ascending: false })

    if (error) throw error
    return (data ?? []) as ITreatmentPlanWithRelations[]
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
    return data as ITreatmentPlanWithRelations | null
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
    return (data ?? []) as ITreatmentPlanWithRelations[]
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
