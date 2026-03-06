import type { User } from '@supabase/supabase-js'
import type { Tables } from '~/types/database'
import { UserRole } from '~/enums/user-role.enum'
import { usePatientsStore } from '~/stores/patients.store'
import { useStaffStore } from '~/stores/staff.store'
import { useAppointmentsStore } from '~/stores/appointments.store'
import { useTreatmentsStore } from '~/stores/treatments.store'
import { useInvoicesStore } from '~/stores/invoices.store'

interface AuthState {
  user: Ref<User | null>
  profile: Ref<Tables<'profiles'> | null>
  clinic: Ref<Tables<'clinics'> | null>
  loading: Ref<boolean>
  isAuthenticated: Ref<boolean>
  isAdmin: Ref<boolean>
}

export function useAuth() {
  const supabase = useSupabase()
  const patientsStore = usePatientsStore()
  const staffStore = useStaffStore()
  const appointmentsStore = useAppointmentsStore()
  const treatmentsStore = useTreatmentsStore()
  const invoicesStore = useInvoicesStore()
  const user = useState<User | null>('auth:user', () => null)
  const profile = useState<Tables<'profiles'> | null>('auth:profile', () => null)
  const clinic = useState<Tables<'clinics'> | null>('auth:clinic', () => null)
  const loading = useState<boolean>('auth:loading', () => true)
  const initStatus = useState<'idle' | 'initializing' | 'done'>('auth:initStatus', () => 'idle')
  const listenerAttached = useState<boolean>('auth:listenerAttached', () => false)
  const skipNextSignedIn = useState<boolean>('auth:skipNextSignedIn', () => false)

  const authState: AuthState = {
    user,
    profile,
    clinic,
    loading,
    isAuthenticated: computed(() => !!user.value),
    isAdmin: computed(() => profile.value?.role === UserRole.ADMIN),
  }

  async function fetchProfile(userId?: string) {
    const previousClinicId = authState.profile.value?.clinic_id ?? null
    const id = userId ?? user.value?.id
    if (!id) {
      profile.value = null
      clinic.value = null
      patientsStore.invalidate()
      staffStore.invalidate()
      appointmentsStore.invalidate()
      treatmentsStore.invalidate()
      invoicesStore.invalidate()
      return
    }

    const { data: profileData } = await supabase.from('profiles').select('*').eq('id', id).single()

    authState.profile.value = profileData ?? null
    if (previousClinicId && previousClinicId !== profileData?.clinic_id) {
      patientsStore.invalidate()
      staffStore.invalidate()
      appointmentsStore.invalidate()
      treatmentsStore.invalidate()
      invoicesStore.invalidate()
    }

    if (profileData?.clinic_id) {
      const { data: clinicData } = await supabase
        .from('clinics')
        .select('*')
        .eq('id', profileData.clinic_id)
        .single()

      authState.clinic.value = clinicData ?? null
    } else {
      authState.clinic.value = null
    }
  }

  async function initialize() {
    if (initStatus.value === 'done') return
    if (initStatus.value === 'initializing') {
      await new Promise<void>((resolve) => {
        const stop = watch(
          initStatus,
          (status) => {
            if (status !== 'initializing') {
              stop()
              resolve()
            }
          },
          { immediate: true },
        )
      })
      return
    }

    initStatus.value = 'initializing'
    authState.loading.value = true

    try {
      const {
        data: { session },
      } = await supabase.auth.getSession()
      authState.user.value = session?.user ?? null
      await fetchProfile()
    } finally {
      authState.loading.value = false
      initStatus.value = 'done'
    }

    if (!listenerAttached.value) {
      listenerAttached.value = true
      supabase.auth.onAuthStateChange(async (event, session) => {
        // initialize() already resolves the startup session + profile/clinic.
        // Skip this event to avoid duplicate profile/clinic requests on page refresh.
        if (event === 'INITIAL_SESSION') return
        // signIn/signUp set the skip flag when they handle profile fetch themselves.
        if (event === 'SIGNED_IN' && skipNextSignedIn.value) {
          skipNextSignedIn.value = false
          return
        }
        authState.user.value = session?.user ?? null
        await fetchProfile()
      })
    }
  }

  async function signUp(clinicName: string, fullName: string, email: string, password: string) {
    // 1. Create the clinic via RPC
    const { data: rpcData, error: rpcError } = await supabase.rpc('create_clinic_and_admin', {
      clinic_name: clinicName,
      admin_email: email,
      admin_password: password,
      admin_full_name: fullName,
    })

    if (rpcError) throw rpcError
    if (!rpcData) throw new Error('Registration failed — please try again')

    const clinicId = (rpcData as Record<string, unknown>).clinic_id as string

    // 2. Sign up the user with clinic_id in metadata
    skipNextSignedIn.value = true
    const { data, error: signUpError } = await supabase.auth.signUp({
      email,
      password,
      options: {
        data: {
          clinic_id: clinicId,
          full_name: fullName,
          role: 'admin',
        },
      },
    })

    if (signUpError) {
      skipNextSignedIn.value = false
      throw signUpError
    }

    // If auto-confirm is enabled, signUp returns a session — fetch profile before setting user
    if (data.session?.user) {
      await fetchProfile(data.session.user.id)
      authState.user.value = data.session.user
    }
  }

  async function signIn(email: string, password: string) {
    skipNextSignedIn.value = true
    const { data, error } = await supabase.auth.signInWithPassword({ email, password })
    if (error) {
      skipNextSignedIn.value = false
      throw error
    }
    if (data.session?.user) {
      await fetchProfile(data.session.user.id)
      authState.user.value = data.session.user
    }
  }

  async function signOut() {
    const { error } = await supabase.auth.signOut()
    if (error) throw error
    patientsStore.invalidate()
    staffStore.invalidate()
    appointmentsStore.invalidate()
    treatmentsStore.invalidate()
    invoicesStore.invalidate()
    authState.user.value = null
    authState.profile.value = null
    authState.clinic.value = null
    await navigateTo('/login')
  }

  return {
    ...authState,
    initialize,
    signUp,
    signIn,
    signOut,
    fetchProfile,
  }
}
