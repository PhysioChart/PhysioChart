<template>
  <div class="space-y-6">
    <div>
      <h1 class="text-2xl font-bold tracking-tight">Settings</h1>
      <p class="text-muted-foreground text-sm">Manage your clinic profile and team</p>
    </div>

    <Tabs default-value="clinic">
      <TabsList class="w-full justify-start overflow-x-auto">
        <TabsTrigger value="clinic">
          <Building2 class="mr-2 h-4 w-4" />
          Clinic Profile
        </TabsTrigger>
        <TabsTrigger value="staff">
          <Users class="mr-2 h-4 w-4" />
          Staff
        </TabsTrigger>
      </TabsList>

      <TabsContent value="clinic">
        <ClinicProfileForm
          :clinic="clinicFormData"
          :is-admin="isAdmin"
          :is-saving="isSavingClinic"
          @submit="saveClinicProfile"
        />
      </TabsContent>

      <TabsContent value="staff">
        <StaffMembersList
          :members="staffMembers"
          :is-admin="isAdmin"
          :is-loading="isLoadingStaff"
          :current-user-id="profile?.id"
          @remove="deactivateStaff"
        >
          <template #header-action>
            <Button size="lg" @click="showInviteDialog = true">
              <UserPlus class="mr-2 h-4 w-4" />
              Add Staff
            </Button>
          </template>
        </StaffMembersList>
      </TabsContent>
    </Tabs>

    <StaffInviteDialog
      ref="inviteDialogRef"
      :open="showInviteDialog"
      @update:open="showInviteDialog = $event"
      @submit="handleInviteStaff"
    />
  </div>
</template>

<script setup lang="ts">
import { storeToRefs } from 'pinia'
import { toast } from 'vue-sonner'
import { Building2, Users, UserPlus } from 'lucide-vue-next'
import { clinicService } from '~/services/clinic.service'
import { staffService } from '~/services/staff.service'
import { useStaffStore } from '~/stores/staff.store'
import ClinicProfileForm from '~/features/settings/components/ClinicProfileForm.vue'
import type { ClinicProfilePayload } from '~/features/settings/components/ClinicProfileForm.vue'
import StaffMembersList from '~/features/settings/components/StaffMembersList.vue'
import StaffInviteDialog from '~/features/settings/components/StaffInviteDialog.vue'
import type { StaffInvitePayload } from '~/features/settings/components/StaffInviteDialog.vue'

definePageMeta({ layout: 'protected' })

useHead({ title: 'Settings' })

const supabase = useSupabaseClient()
const { clinic, profile, activeMembership, isAdmin, refreshAuthContext } = useAuth()
const staffStore = useStaffStore()
const { byClinic } = storeToRefs(staffStore)

const isSavingClinic = ref(false)
const isLoadingStaff = ref(true)
const showInviteDialog = ref(false)

// --- Computed ---

const clinicFormData = computed<ClinicProfilePayload>(() => ({
  name: clinic.value?.name ?? '',
  address: clinic.value?.address ?? '',
  phone: clinic.value?.phone ?? '',
  email: clinic.value?.email ?? '',
  logo_url: clinic.value?.logo_url ?? '',
}))

const staffMembers = computed(() => {
  if (!activeMembership.value?.clinic_id) return []
  return byClinic.value[activeMembership.value.clinic_id] ?? []
})

// --- Clinic Profile ---

async function saveClinicProfile(payload: ClinicProfilePayload) {
  if (!clinic.value || !isAdmin.value) return
  isSavingClinic.value = true
  try {
    await clinicService(supabase).update(clinic.value.id, {
      name: payload.name,
      address: payload.address || null,
      phone: payload.phone || null,
      email: payload.email || null,
      logo_url: payload.logo_url || null,
    })
    toast.success('Clinic profile updated')
    await refreshAuthContext()
  } catch (err: unknown) {
    toast.error(err instanceof Error ? err.message : 'Failed to update clinic profile')
  } finally {
    isSavingClinic.value = false
  }
}

// --- Staff ---

async function loadStaff() {
  if (!activeMembership.value?.clinic_id) return
  isLoadingStaff.value = true
  try {
    await staffStore.fetchList(activeMembership.value.clinic_id)
  } catch (err: unknown) {
    toast.error(err instanceof Error ? err.message : 'Failed to load staff')
  } finally {
    isLoadingStaff.value = false
  }
}

const inviteDialogRef = ref<InstanceType<typeof StaffInviteDialog> | null>(null)

async function handleInviteStaff(payload: StaffInvitePayload) {
  try {
    const inviteUrl = await staffService(supabase).createInvite(payload.email, payload.role)
    try {
      await navigator.clipboard.writeText(new URL(inviteUrl, window.location.origin).toString())
      toast.success('Invite link copied to clipboard')
    } catch {
      toast.success('Invite created (clipboard copy failed)')
    }
    showInviteDialog.value = false
  } catch (err: unknown) {
    toast.error(err instanceof Error ? err.message : 'Failed to add staff member')
  } finally {
    inviteDialogRef.value?.markSubmitted()
  }
}

async function deactivateStaff(staffId: string) {
  if (!isAdmin.value || staffId === profile.value?.id) return
  const target = staffMembers.value.find((m) => m.id === staffId)
  if (!target || !activeMembership.value?.clinic_id) return
  try {
    await staffService(supabase).deactivate(target.membership_id)
    staffStore.invalidate(activeMembership.value.clinic_id)
    toast.success('Staff member deactivated')
    await loadStaff()
  } catch (err: unknown) {
    toast.error(err instanceof Error ? err.message : 'Failed to deactivate staff member')
  }
}

onMounted(loadStaff)
</script>
