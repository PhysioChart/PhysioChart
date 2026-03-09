import type { SupabaseClient } from '@supabase/supabase-js'
import type { Database } from '~/types/database'
import type { UserRole } from '~/enums/user-role.enum'

export interface IClinicStaffMember {
  id: string
  membership_id: string
  full_name: string
  email: string
  role: UserRole
  is_active: boolean
}

interface InviteResponse {
  invite_url?: string
}

type StaffMembershipRow = {
  id: string
  clinic_id: string
  user_id: string
  role: UserRole
  ended_at: string | null
  profile: {
    id: string
    full_name: string
    email: string
    is_active: boolean
  } | null
}

function mapStaffMembership(row: StaffMembershipRow): IClinicStaffMember {
  return {
    id: row.user_id,
    membership_id: row.id,
    full_name: row.profile?.full_name ?? 'Unknown user',
    email: row.profile?.email ?? '',
    role: row.role,
    is_active: !row.ended_at && !!row.profile?.is_active,
  }
}

export function staffService(supabase: SupabaseClient<Database>) {
  async function list(clinicId: string): Promise<IClinicStaffMember[]> {
    const { data, error } = await supabase
      .from('clinic_memberships')
      .select(
        `
          id,
          clinic_id,
          user_id,
          role,
          ended_at,
          profile:profiles!clinic_memberships_user_id_fkey (
            id,
            full_name,
            email,
            is_active
          )
        `,
      )
      .eq('clinic_id', clinicId)
      .order('created_at')

    if (error) throw error
    return ((data ?? []) as StaffMembershipRow[]).map(mapStaffMembership)
  }

  async function listActive(clinicId: string): Promise<IClinicStaffMember[]> {
    const { data, error } = await supabase
      .from('clinic_memberships')
      .select(
        `
          id,
          clinic_id,
          user_id,
          role,
          ended_at,
          profile:profiles!clinic_memberships_user_id_fkey (
            id,
            full_name,
            email,
            is_active
          )
        `,
      )
      .eq('clinic_id', clinicId)
      .is('ended_at', null)
      .order('created_at')

    if (error) throw error
    return ((data ?? []) as StaffMembershipRow[])
      .map(mapStaffMembership)
      .filter((row) => row.is_active)
  }

  async function createInvite(email: string, role: UserRole): Promise<string> {
    const { data, error } = await supabase.rpc('create_staff_invite', {
      p_email: email,
      p_role: role,
    })

    if (error) throw error

    const response = (data ?? {}) as InviteResponse
    if (!response.invite_url) {
      throw new Error('Invite link was not returned')
    }

    return response.invite_url
  }

  async function deactivate(membershipId: string): Promise<void> {
    const { error } = await supabase.rpc('deactivate_membership', {
      p_membership_id: membershipId,
    })

    if (error) throw error
  }

  return { list, listActive, createInvite, deactivate }
}
