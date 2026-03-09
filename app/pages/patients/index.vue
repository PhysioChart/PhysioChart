<template>
  <div class="space-y-4">
    <PatientListHeader
      :search="searchQuery"
      @update:search="searchQuery = $event"
      @add-patient="showCreateDialog = true"
    />

    <PatientListTable
      :patients="filteredPatients"
      :is-loading="isLoading"
      :has-search-query="!!searchQuery"
      @view-patient="navigateTo(`/patients/${$event}`)"
    >
      <template #empty-action>
        <Button variant="outline" class="mt-3" @click="showCreateDialog = true">
          Register your first patient
        </Button>
      </template>
    </PatientListTable>

    <PatientCreateDialog
      ref="createDialogRef"
      :open="showCreateDialog"
      @update:open="showCreateDialog = $event"
      @submit="handleCreatePatient"
    />
  </div>
</template>

<script setup lang="ts">
import { storeToRefs } from 'pinia'
import { toast } from 'vue-sonner'
import type { Gender } from '~/enums/gender.enum'
import { patientService } from '~/services/patient.service'
import { usePatientsStore } from '~/stores/patients.store'
import PatientListHeader from '~/features/patients/components/PatientListHeader.vue'
import PatientListTable from '~/features/patients/components/PatientListTable.vue'
import PatientCreateDialog from '~/features/patients/components/PatientCreateDialog.vue'
import type { PatientCreatePayload } from '~/features/patients/components/PatientCreateDialog.vue'

definePageMeta({ layout: 'protected' })

useHead({ title: 'Patients' })

const supabase = useSupabaseClient()
const { activeMembership } = useAuth()
const route = useRoute()
const patientsStore = usePatientsStore()
const { byClinic } = storeToRefs(patientsStore)

const searchQuery = ref('')
const isLoading = ref(true)
const showCreateDialog = ref(route.query.action === 'new')
const createDialogRef = ref<InstanceType<typeof PatientCreateDialog> | null>(null)

const patients = computed(() => {
  if (!activeMembership.value?.clinic_id) return []
  return byClinic.value[activeMembership.value.clinic_id] ?? []
})

const filteredPatients = computed(() => {
  if (!searchQuery.value) return patients.value
  const q = searchQuery.value.toLowerCase()
  return patients.value.filter((p) => p.full_name.toLowerCase().includes(q) || p.phone.includes(q))
})

async function loadPatients() {
  if (!activeMembership.value?.clinic_id) return
  isLoading.value = true
  try {
    await patientsStore.fetchList(activeMembership.value.clinic_id)
  } catch (err: unknown) {
    toast.error(err instanceof Error ? err.message : 'Failed to load patients')
  } finally {
    isLoading.value = false
  }
}

async function handleCreatePatient(payload: PatientCreatePayload) {
  if (!activeMembership.value?.clinic_id) return
  try {
    const created = await patientService(supabase).create({
      clinic_id: activeMembership.value.clinic_id,
      full_name: payload.full_name,
      phone: payload.phone,
      email: payload.email || null,
      date_of_birth: payload.date_of_birth || null,
      gender: (payload.gender as Gender) || null,
      address: payload.address || null,
      emergency_contact_name: payload.emergency_contact_name || null,
      emergency_contact_phone: payload.emergency_contact_phone || null,
      notes: payload.notes || null,
      medical_history: payload.medical_history,
    })
    patientsStore.upsertPatient(activeMembership.value.clinic_id, created)
    patientsStore.invalidate(activeMembership.value.clinic_id)
    toast.success('Patient registered successfully')
    await loadPatients()
    showCreateDialog.value = false
  } catch (err: unknown) {
    toast.error(err instanceof Error ? err.message : 'Failed to create patient')
  } finally {
    createDialogRef.value?.markSubmitted()
  }
}

onMounted(loadPatients)
</script>
