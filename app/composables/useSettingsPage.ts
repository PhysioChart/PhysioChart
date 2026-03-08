import { storeToRefs } from 'pinia'
import { toast } from 'vue-sonner'
import { UserRole } from '~/enums/user-role.enum'
import { isValidIndianPhone, normalizeIndianPhone } from '~/lib/phone'
import { clinicService } from '~/services/clinic.service'
import { staffService } from '~/services/staff.service'
import { useStaffStore } from '~/stores/staff.store'

export function useSettingsPage() {
  const supabase = useSupabaseClient()
  const { clinic, profile, activeMembership, isAdmin, refreshAuthContext } = useAuth()
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
    role: UserRole.STAFF as UserRole,
  })
  const isInviting = ref(false)
  const isDeactivating = ref(false)

  const staffMembers = computed(() => {
    if (!activeMembership.value?.clinic_id) return []
    return byClinic.value[activeMembership.value.clinic_id] ?? []
  })

  function loadClinicForm() {
    if (!clinic.value) return
    clinicForm.value = {
      name: clinic.value.name,
      address: clinic.value.address ?? '',
      phone: normalizeIndianPhone(clinic.value.phone),
      email: clinic.value.email ?? '',
      logo_url: clinic.value.logo_url ?? '',
    }
  }

  async function saveClinicProfile() {
    if (!clinic.value || !isAdmin.value) return
    if (clinicForm.value.phone && !isValidIndianPhone(clinicForm.value.phone)) {
      toast.error('Enter a valid 10-digit Indian mobile number')
      return
    }
    isSavingClinic.value = true

    try {
      await clinicService(supabase).update(clinic.value.id, {
        name: clinicForm.value.name,
        address: clinicForm.value.address || null,
        phone: normalizeIndianPhone(clinicForm.value.phone) || null,
        email: clinicForm.value.email || null,
        logo_url: clinicForm.value.logo_url || null,
      })

      toast.success('Clinic profile updated')
      await refreshAuthContext()
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : 'Failed to update clinic profile'
      toast.error(message)
    } finally {
      isSavingClinic.value = false
    }
  }

  async function loadStaff() {
    if (!activeMembership.value?.clinic_id) return
    isLoadingStaff.value = true

    try {
      await staffStore.fetchList(activeMembership.value.clinic_id)
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : 'Failed to load staff'
      toast.error(message)
    } finally {
      isLoadingStaff.value = false
    }
  }

  async function inviteStaffMember() {
    if (!inviteForm.value.email) return
    isInviting.value = true

    try {
      const inviteUrl = await staffService(supabase).createInvite(
        inviteForm.value.email,
        inviteForm.value.role,
      )
      await navigator.clipboard.writeText(new URL(inviteUrl, window.location.origin).toString())
      toast.success('Invite link copied to clipboard')
      showInviteDialog.value = false
      inviteForm.value = { email: '', role: UserRole.STAFF }
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
      const target = staffMembers.value.find((member) => member.id === staffId)
      if (!target || !activeMembership.value?.clinic_id) return
      await staffService(supabase).deactivate(target.membership_id)
      staffStore.invalidate(activeMembership.value.clinic_id)
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
