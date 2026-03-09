import type { SupabaseClient } from '@supabase/supabase-js'
import type { Database, Tables, TablesUpdate } from '~/types/database'

export function clinicService(supabase: SupabaseClient<Database>) {
  async function get(id: string): Promise<Tables<'clinics'> | null> {
    const { data, error } = await supabase.from('clinics').select('*').eq('id', id).single()

    if (error) throw error
    return data
  }

  async function update(id: string, updates: TablesUpdate<'clinics'>): Promise<void> {
    const { error } = await supabase.from('clinics').update(updates).eq('id', id)

    if (error) throw error
  }

  return { get, update }
}
