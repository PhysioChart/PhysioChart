import type { SupabaseClient } from '@supabase/supabase-js'
import type { Database, Tables } from '~/types/database'
import type { UserRole } from '~/enums/user-role.enum'

export function staffService(supabase: SupabaseClient<Database>) {
  async function list(clinicId: string): Promise<Tables<'profiles'>[]> {
    const { data, error } = await supabase
      .from('profiles')
      .select('*')
      .eq('clinic_id', clinicId)
      .order('created_at')

    if (error) throw error
    return data ?? []
  }

  /** List only active staff (for dropdown selects) */
  async function listActive(clinicId: string): Promise<Tables<'profiles'>[]> {
    const { data, error } = await supabase
      .from('profiles')
      .select('*')
      .eq('clinic_id', clinicId)
      .eq('is_active', true)
      .order('full_name')

    if (error) throw error
    return data ?? []
  }

  async function invite(
    clinicId: string,
    email: string,
    password: string,
    fullName: string,
    role: UserRole,
  ): Promise<void> {
    const { error } = await supabase.auth.signUp({
      email,
      password,
      options: {
        data: {
          clinic_id: clinicId,
          full_name: fullName,
          role,
        },
      },
    })

    if (error) throw error
  }

  async function deactivate(staffId: string): Promise<void> {
    const { error } = await supabase.from('profiles').update({ is_active: false }).eq('id', staffId)

    if (error) throw error
  }

  return { list, listActive, invite, deactivate }
}
