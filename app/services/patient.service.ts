import type { SupabaseClient } from '@supabase/supabase-js'
import type { Database, Tables, TablesInsert, TablesUpdate } from '~/types/database'

export function patientService(supabase: SupabaseClient<Database>) {
  async function list(clinicId: string): Promise<Tables<'patients'>[]> {
    const { data, error } = await supabase
      .from('patients')
      .select('*')
      .eq('clinic_id', clinicId)
      .eq('is_archived', false)
      .order('created_at', { ascending: false })

    if (error) throw error
    return data ?? []
  }

  async function getById(clinicId: string, id: string): Promise<Tables<'patients'> | null> {
    const { data, error } = await supabase
      .from('patients')
      .select('*')
      .eq('clinic_id', clinicId)
      .eq('id', id)
      .single()

    if (error) throw error
    return data
  }

  async function create(patient: TablesInsert<'patients'>): Promise<Tables<'patients'>> {
    const { data, error } = await supabase.from('patients').insert(patient).select().single()

    if (error) throw error
    return data
  }

  async function update(
    clinicId: string,
    id: string,
    updates: TablesUpdate<'patients'>,
  ): Promise<void> {
    const { error } = await supabase
      .from('patients')
      .update(updates)
      .eq('clinic_id', clinicId)
      .eq('id', id)

    if (error) throw error
  }

  async function archive(clinicId: string, id: string): Promise<void> {
    const { error } = await supabase
      .from('patients')
      .update({ is_archived: true })
      .eq('clinic_id', clinicId)
      .eq('id', id)

    if (error) throw error
  }

  async function search(clinicId: string, query: string): Promise<Tables<'patients'>[]> {
    const { data, error } = await supabase
      .from('patients')
      .select('*')
      .eq('clinic_id', clinicId)
      .eq('is_archived', false)
      .or(
        `full_name.ilike.%${query.replace(/[,%().*]/g, '')}%,phone.ilike.%${query.replace(/[,%().*]/g, '')}%`,
      )
      .order('full_name')
      .limit(20)

    if (error) throw error
    return data ?? []
  }

  /** List patients for dropdown (name + phone, ordered by name) */
  async function listForDropdown(clinicId: string): Promise<Tables<'patients'>[]> {
    const { data, error } = await supabase
      .from('patients')
      .select('*')
      .eq('clinic_id', clinicId)
      .eq('is_archived', false)
      .order('full_name')

    if (error) throw error
    return data ?? []
  }

  return { list, getById, create, update, archive, search, listForDropdown }
}
