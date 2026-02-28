import { storeToRefs } from 'pinia'
import { toast } from 'vue-sonner'
import { UserRole } from '~/enums/user-role.enum'
import { clinicService } from '~/services/clinic.service'
import { staffService } from '~/services/staff.service'
import { useStaffStore } from '~/stores/staff.store'

export function useSettingsPage() {
  const supabase = useSupabase()
  const { clinic, profile, isAdmin, fetchProfile } = useAuth()
  const staffStore = useStaffStore()
  const { byClinic } = storeToRefs(staffStore)

  const clinicForm = ref({
    name: '',
    address: '',
    phone: '',
    email: '',
    logo_url: '',
  })
  const isSavingClinic = ref(false)

  const isLoadingStaff = ref(true)
  const showInviteDialog = ref(false)
  const inviteForm = ref({
    email: '',
    full_name: '',
    role: UserRole.STAFF as UserRole,
    password: '',
  })
  const isInviting = ref(false)
  const isDeactivating = ref(false)

  const staffMembers = computed(() => {
    if (!profile.value) return []
    return byClinic.value[profile.value.clinic_id] ?? []
  })

  function loadClinicForm() {
    if (!clinic.value) return
    clinicForm.value = {
      name: clinic.value.name,
      address: clinic.value.address ?? '',
      phone: clinic.value.phone ?? '',
      email: clinic.value.email ?? '',
      logo_url: clinic.value.logo_url ?? '',
    }
  }

  async function saveClinicProfile() {
    if (!clinic.value || !isAdmin.value) return
    isSavingClinic.value = true

    try {
      await clinicService(supabase).update(clinic.value.id, {
        name: clinicForm.value.name,
        address: clinicForm.value.address || null,
        phone: clinicForm.value.phone || null,
        email: clinicForm.value.email || null,
        logo_url: clinicForm.value.logo_url || null,
      })

      toast.success('Clinic profile updated')
      await fetchProfile()
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : 'Failed to update clinic profile'
      toast.error(message)
    } finally {
      isSavingClinic.value = false
    }
  }

  async function loadStaff() {
    if (!profile.value) return
    isLoadingStaff.value = true

    try {
      await staffStore.fetchList(profile.value.clinic_id)
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : 'Failed to load staff'
      toast.error(message)
    } finally {
      isLoadingStaff.value = false
    }
  }

  async function inviteStaffMember() {
    if (
      !profile.value ||
      !inviteForm.value.email ||
      !inviteForm.value.full_name ||
      !inviteForm.value.password
    )
      return
    isInviting.value = true

    try {
      await staffService(supabase).invite(
        profile.value.clinic_id,
        inviteForm.value.email,
        inviteForm.value.password,
        inviteForm.value.full_name,
        inviteForm.value.role,
      )

      staffStore.invalidate(profile.value.clinic_id)
      toast.success('Staff member added')
      await loadStaff()
      showInviteDialog.value = false
      inviteForm.value = { email: '', full_name: '', role: UserRole.STAFF, password: '' }
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : 'Failed to add staff member'
      toast.error(message)
    } finally {
      isInviting.value = false
    }
  }

  async function deactivateStaff(staffId: string) {
    if (!isAdmin.value || staffId === profile.value?.id) return
    isDeactivating.value = true

    try {
      if (!profile.value) return
      await staffService(supabase).deactivate(profile.value.clinic_id, staffId)
      if (profile.value) {
        staffStore.invalidate(profile.value.clinic_id)
      }
      toast.success('Staff member deactivated')
      await loadStaff()
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : 'Failed to deactivate staff member'
      toast.error(message)
    } finally {
      isDeactivating.value = false
    }
  }

  onMounted(() => {
    loadClinicForm()
    void loadStaff()
  })

  watch(clinic, loadClinicForm)

  return {
    clinic,
    profile,
    isAdmin,
    clinicForm,
    isSavingClinic,
    isLoadingStaff,
    showInviteDialog,
    inviteForm,
    isInviting,
    staffMembers,
    saveClinicProfile,
    inviteStaffMember,
    deactivateStaff,
  }
}
