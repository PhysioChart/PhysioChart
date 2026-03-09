import type { Database, Tables } from '~/types/database'
import { useAppointmentsStore } from '~/stores/appointments.store'
import { useInvoicesStore } from '~/stores/invoices.store'
import { usePatientsStore } from '~/stores/patients.store'
import { useStaffStore } from '~/stores/staff.store'
import { useTreatmentsStore } from '~/stores/treatments.store'

type BootstrapStatus = 'idle' | 'loading' | 'ready' | 'guest' | 'needs_onboarding' | 'error'

export interface AuthMembership extends Tables<'clinic_memberships'> {
  clinic: Tables<'clinics'> | null
}

interface SignInInput {
  email: string
  password: string
  resumeInviteToken?: string | null
}

interface SignUpOwnerInput {
  clinicName: string
  fullName: string
  email: string
  password: string
}

interface InviteSignUpInput {
  email: string
  password: string
  fullName: string
  token: string
}

interface InviteSignUpResult {
  requiresLogin: boolean
}

interface InvitePreview {
  is_valid: boolean
  clinic_name?: string
  role?: Tables<'clinic_invites'>['role']
  masked_email?: string
  expires_at?: string
}

type JwtLike = {
  sub?: string
  id?: string
} | null

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null
}

function sessionUserId(session: unknown): string | null {
  if (!isRecord(session)) return null
  const user = session.user
  if (!isRecord(user) || typeof user.id !== 'string') return null
  return user.id
}

export function extractAuthUserId(raw: unknown): string | null {
  const user = raw as JwtLike
  return user?.sub ?? user?.id ?? null
}

export function isExistingAccountSignUpError(error: unknown): boolean {
  return (
    isRecord(error) &&
    typeof error.message === 'string' &&
    error.message.toLowerCase().includes('already registered')
  )
}

async function waitForStatus(status: Ref<BootstrapStatus>) {
  if (status.value !== 'loading') return

  await new Promise<void>((resolve, reject) => {
    const stop = watch(
      status,
      (value) => {
        if (value === 'loading') return
        stop()
        if (value === 'error') {
          reject(new Error('Auth bootstrap failed'))
          return
        }
        resolve()
      },
      { immediate: true },
    )
  })
}

export function useAuth() {
  const supabase = useSupabaseClient<Database>()
  const session = useSupabaseSession()
  const claims = useSupabaseUser()
  const patientsStore = usePatientsStore()
  const staffStore = useStaffStore()
  const appointmentsStore = useAppointmentsStore()
  const treatmentsStore = useTreatmentsStore()
  const invoicesStore = useInvoicesStore()

  const profile = useState<Tables<'profiles'> | null>('auth:profile', () => null)
  const memberships = useState<AuthMembership[]>('auth:memberships', () => [])
  const activeClinic = useState<Tables<'clinics'> | null>('auth:activeClinic', () => null)
  const bootstrapStatus = useState<BootstrapStatus>('auth:bootstrapStatus', () => 'idle')
  const bootstrappedUserId = useState<string | null>('auth:bootstrappedUserId', () => null)
  const bootstrapForUserId = useState<string | null>('auth:bootstrapForUserId', () => null)
  const bootstrapEpoch = useState<number>('auth:bootstrapEpoch', () => 0)
  const onboardingDraft = useState<{ clinicName: string; fullName: string } | null>(
    'auth:onboardingDraft',
    () => null,
  )
  const pendingInviteToken = useState<string | null>('auth:pendingInviteToken', () => null)

  const authUserId = computed(
    () => sessionUserId(session.value) ?? extractAuthUserId(claims.value) ?? null,
  )
  const activeMembership = computed<AuthMembership | null>(() => {
    if (!profile.value?.default_membership_id) return memberships.value[0] ?? null
    return (
      memberships.value.find(
        (membership) => membership.id === profile.value?.default_membership_id,
      ) ?? null
    )
  })
  const clinic = computed(() => activeClinic.value)
  const isAuthenticated = computed(() => !!session.value)
  const isAdmin = computed(() => activeMembership.value?.role === 'admin')

  function clearStoreCaches() {
    patientsStore.invalidate()
    staffStore.invalidate()
    appointmentsStore.invalidate()
    treatmentsStore.invalidate()
    invoicesStore.invalidate()
  }

  function clearAuthState() {
    bootstrapEpoch.value += 1
    profile.value = null
    memberships.value = []
    activeClinic.value = null
    bootstrapStatus.value = session.value ? 'idle' : 'guest'
    bootstrappedUserId.value = null
    bootstrapForUserId.value = null
    onboardingDraft.value = null
    pendingInviteToken.value = null
    clearStoreCaches()
    clearNuxtData()
    clearNuxtState((key) => key.startsWith('auth:'))
  }

  async function loadMemberships(userId: string): Promise<AuthMembership[]> {
    const { data, error } = await supabase
      .from('clinic_memberships')
      .select(
        `
          id,
          clinic_id,
          user_id,
          role,
          created_by_user_id,
          created_at,
          ended_at,
          clinic:clinics (
            id,
            name,
            address,
            phone,
            email,
            logo_url,
            created_at,
            updated_at
          )
        `,
      )
      .eq('user_id', userId)
      .is('ended_at', null)
      .order('created_at', { ascending: true })

    if (error) throw error
    return (data ?? []) as AuthMembership[]
  }

  async function ensureBootstrapped(options: { userId?: string; force?: boolean } = {}) {
    const resolvedUserId =
      options.userId ?? sessionUserId(session.value) ?? extractAuthUserId(claims.value)

    if (!resolvedUserId) {
      clearStoreCaches()
      profile.value = null
      memberships.value = []
      activeClinic.value = null
      bootstrappedUserId.value = null
      bootstrapForUserId.value = null
      bootstrapStatus.value = 'guest'
      return
    }

    if (
      !options.force &&
      bootstrapStatus.value === 'ready' &&
      bootstrappedUserId.value === resolvedUserId &&
      activeMembership.value
    ) {
      return
    }

    if (
      !options.force &&
      bootstrapStatus.value === 'loading' &&
      bootstrapForUserId.value === resolvedUserId
    ) {
      await waitForStatus(bootstrapStatus)
      return
    }

    const epoch = bootstrapEpoch.value + 1
    bootstrapEpoch.value = epoch
    bootstrapForUserId.value = resolvedUserId
    bootstrapStatus.value = 'loading'

    try {
      const { data: profileData, error: profileError } = await supabase
        .from('profiles')
        .select('*')
        .eq('id', resolvedUserId)
        .maybeSingle()

      if (profileError) throw profileError
      if (bootstrapEpoch.value !== epoch || authUserId.value !== resolvedUserId) return

      profile.value = profileData

      if (!profileData) {
        memberships.value = []
        activeClinic.value = null
        bootstrappedUserId.value = resolvedUserId
        bootstrapStatus.value = 'needs_onboarding'
        return
      }

      const activeMemberships = await loadMemberships(resolvedUserId)

      if (bootstrapEpoch.value !== epoch || authUserId.value !== resolvedUserId) return

      memberships.value = activeMemberships

      if (activeMemberships.length === 0) {
        activeClinic.value = null
        bootstrappedUserId.value = resolvedUserId
        bootstrapStatus.value = 'needs_onboarding'
        return
      }

      let selectedMembership =
        activeMemberships.find(
          (membership) => membership.id === profileData.default_membership_id,
        ) ?? null

      if (!selectedMembership) {
        selectedMembership = activeMemberships[0] ?? null
        if (selectedMembership) {
          await supabase.rpc('set_default_membership', { p_membership_id: selectedMembership.id })
          if (bootstrapEpoch.value !== epoch || authUserId.value !== resolvedUserId) return
          profile.value = { ...profileData, default_membership_id: selectedMembership.id }
        }
      }

      activeClinic.value = selectedMembership?.clinic ?? null
      bootstrappedUserId.value = resolvedUserId
      bootstrapStatus.value = 'ready'
    } catch (error) {
      if (bootstrapEpoch.value !== epoch || authUserId.value !== resolvedUserId) return
      profile.value = null
      memberships.value = []
      activeClinic.value = null
      bootstrappedUserId.value = null
      bootstrapStatus.value = 'error'
      throw error
    } finally {
      if (bootstrapForUserId.value === resolvedUserId) {
        bootstrapForUserId.value = null
      }
    }
  }

  async function refreshAuthContext() {
    await ensureBootstrapped({ force: true })
  }

  async function completeOnboarding(
    clinicName = onboardingDraft.value?.clinicName ?? '',
    fullName = onboardingDraft.value?.fullName ?? profile.value?.full_name ?? '',
  ) {
    const userId = sessionUserId(session.value)
    if (!userId) {
      throw new Error('Authentication required')
    }

    const normalizedClinicName = clinicName.trim()
    const normalizedFullName = fullName.trim()
    if (!normalizedClinicName || !normalizedFullName) {
      throw new Error('Clinic name and full name are required')
    }

    const { error } = await supabase.rpc('complete_registration', {
      clinic_name: normalizedClinicName,
      full_name: normalizedFullName,
    })

    if (error) throw error

    onboardingDraft.value = null
    await ensureBootstrapped({ userId, force: true })
  }

  async function acceptInvite(input: { token: string; fullName: string }) {
    const userId = sessionUserId(session.value)
    if (!userId) {
      throw new Error('Authentication required')
    }

    const { error } = await supabase.rpc('accept_invite', {
      p_invite_token: input.token,
      p_full_name: input.fullName.trim(),
    })

    if (error) throw error

    pendingInviteToken.value = null
    await ensureBootstrapped({ userId, force: true })
  }

  async function fetchInvitePreview(token: string) {
    const { data, error } = await supabase.rpc('get_invite_preview', {
      p_invite_token: token,
    })

    if (error) throw error

    return (data ?? { is_valid: false }) as unknown as InvitePreview
  }

  async function signUpFromInvite(input: InviteSignUpInput): Promise<InviteSignUpResult> {
    const { data, error } = await supabase.auth.signUp({
      email: input.email,
      password: input.password,
      options: {
        data: {
          full_name: input.fullName.trim(),
        },
      },
    })

    if (error) {
      if (isExistingAccountSignUpError(error)) {
        pendingInviteToken.value = input.token
        return { requiresLogin: true }
      }
      throw error
    }

    if (!data.user) {
      throw new Error('Invite signup failed')
    }

    if (!data.session) {
      throw new Error('Invite signup requires email confirmation to stay disabled')
    }

    await acceptInvite({ token: input.token, fullName: input.fullName })
    await navigateTo('/home')

    return { requiresLogin: false }
  }

  async function signUpOwner(input: SignUpOwnerInput) {
    const { data, error } = await supabase.auth.signUp({
      email: input.email,
      password: input.password,
      options: {
        data: {
          full_name: input.fullName.trim(),
        },
      },
    })

    if (error) throw error
    if (!data.user) {
      throw new Error('Registration failed')
    }
    if (!data.session) {
      throw new Error('Owner signup requires email confirmation to stay disabled')
    }

    onboardingDraft.value = {
      clinicName: input.clinicName,
      fullName: input.fullName,
    }

    try {
      await completeOnboarding(input.clinicName, input.fullName)
      const redirect = useSupabaseCookieRedirect()
      await navigateTo(redirect.pluck() || '/home')
    } catch {
      bootstrapStatus.value = 'needs_onboarding'
      await navigateTo('/onboarding')
    }
  }

  async function signIn(input: SignInInput) {
    const { data, error } = await supabase.auth.signInWithPassword({
      email: input.email,
      password: input.password,
    })

    if (error) throw error
    if (!data.user || !data.session) {
      throw new Error('Login failed')
    }

    await ensureBootstrapped({ userId: data.user.id, force: true })

    if (input.resumeInviteToken) {
      pendingInviteToken.value = input.resumeInviteToken
      await navigateTo(`/invite/${input.resumeInviteToken}`)
      return
    }

    const redirect = useSupabaseCookieRedirect()
    await navigateTo(redirect.pluck() || '/home')
  }

  async function signOut() {
    const { error } = await supabase.auth.signOut({ scope: 'local' })
    if (error) throw error
    clearAuthState()
    await navigateTo('/login')
  }

  return {
    session,
    claims,
    profile,
    memberships,
    clinic,
    activeClinic,
    activeMembership,
    onboardingDraft,
    pendingInviteToken,
    authUserId,
    isAuthenticated,
    isAdmin,
    bootstrapStatus,
    ensureBootstrapped,
    refreshAuthContext,
    completeOnboarding,
    fetchInvitePreview,
    signUpFromInvite,
    acceptInvite,
    signUpOwner,
    signIn,
    signOut,
    clearAuthState,
  }
}
