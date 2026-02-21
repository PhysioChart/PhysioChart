import type { User } from '@supabase/supabase-js'
import type { Tables } from '~/types/database'

interface AuthState {
  user: Ref<User | null>
  profile: Ref<Tables<'profiles'> | null>
  clinic: Ref<Tables<'clinics'> | null>
  loading: Ref<boolean>
  isAuthenticated: Ref<boolean>
  isAdmin: Ref<boolean>
}

const authState: AuthState = {
  user: ref(null),
  profile: ref(null),
  clinic: ref(null),
  loading: ref(true),
  isAuthenticated: computed(() => !!authState.user.value),
  isAdmin: computed(() => authState.profile.value?.role === 'admin'),
}

let initialized = false

export function useAuth() {
  const supabase = useSupabase()

  async function fetchProfile() {
    if (!authState.user.value) {
      authState.profile.value = null
      authState.clinic.value = null
      return
    }

    const { data: profile } = await supabase
      .from('profiles')
      .select('*')
      .eq('id', authState.user.value.id)
      .single()

    authState.profile.value = profile

    if (profile?.clinic_id) {
      const { data: clinic } = await supabase
        .from('clinics')
        .select('*')
        .eq('id', profile.clinic_id)
        .single()

      authState.clinic.value = clinic
    }
  }

  async function initialize() {
    if (initialized) return
    initialized = true

    try {
      const {
        data: { session },
      } = await supabase.auth.getSession()
      authState.user.value = session?.user ?? null
      await fetchProfile()
    } finally {
      authState.loading.value = false
    }

    supabase.auth.onAuthStateChange(async (_event, session) => {
      authState.user.value = session?.user ?? null
      await fetchProfile()
    })
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

    const clinicId = (rpcData as Record<string, unknown>).clinic_id as string

    // 2. Sign up the user with clinic_id in metadata
    const { error: signUpError } = await supabase.auth.signUp({
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

    if (signUpError) throw signUpError
  }

  async function signIn(email: string, password: string) {
    const { error } = await supabase.auth.signInWithPassword({ email, password })
    if (error) throw error
  }

  async function signOut() {
    const { error } = await supabase.auth.signOut()
    if (error) throw error
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
