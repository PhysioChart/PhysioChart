<template>
  <ResponsiveFormOverlay :open="open" desktop-width="lg" @update:open="emit('update:open', $event)">
    <form class="flex min-h-0 flex-1 flex-col" @submit.prevent="handleSubmit">
      <DialogHeader
        class="bg-background shrink-0 border-b px-4 py-4 [padding-top:max(1rem,env(safe-area-inset-top))] text-left sm:px-6"
      >
        <DialogTitle>Create Treatment Plan</DialogTitle>
        <DialogDescription>Set up a treatment plan for a patient.</DialogDescription>
      </DialogHeader>
      <div class="min-h-0 flex-1 overflow-y-auto overscroll-contain px-4 py-4 sm:px-6">
        <div class="space-y-4">
          <div class="grid gap-4 sm:grid-cols-2">
            <div class="space-y-2">
              <Label>Patient *</Label>
              <Select v-model="draft.patient_id">
                <SelectTrigger class="w-full">
                  <SelectValue placeholder="Select patient" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem v-for="p in patients" :key="p.id" :value="p.id">
                    {{ p.full_name }}
                  </SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div class="space-y-2">
              <Label>Therapist</Label>
              <Select v-model="draft.therapist_id">
                <SelectTrigger class="w-full">
                  <SelectValue placeholder="Assign therapist (optional)" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem v-for="t in therapists" :key="t.id" :value="t.id">
                    {{ t.full_name }}
                  </SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>
          <div class="space-y-2">
            <Label>Plan Name *</Label>
            <Input v-model="draft.name" placeholder="e.g., Knee Rehabilitation" />
          </div>
          <div class="space-y-2">
            <Label>Diagnosis</Label>
            <Input v-model="draft.diagnosis" placeholder="e.g., ACL tear, post-operative" />
          </div>
          <div class="grid grid-cols-1 gap-4 sm:grid-cols-2">
            <div class="space-y-2">
              <Label>Treatment Type</Label>
              <Input v-model="draft.treatment_type" placeholder="e.g., Physiotherapy" />
            </div>
            <div class="space-y-2">
              <Label>Total Sessions</Label>
              <NumberInput v-model="draft.total_sessions" :min="1" />
            </div>
          </div>
          <div class="space-y-2">
            <Label>Pricing</Label>
            <div class="flex gap-2">
              <Button
                type="button"
                size="sm"
                :variant="draft.pricing_mode === 'per_session' ? 'default' : 'outline'"
                @click="draft.pricing_mode = 'per_session'"
              >
                Per Session
              </Button>
              <Button
                type="button"
                size="sm"
                :variant="draft.pricing_mode === 'package' ? 'default' : 'outline'"
                @click="draft.pricing_mode = 'package'"
              >
                Package
              </Button>
            </div>
          </div>
          <div v-if="draft.pricing_mode === 'per_session'" class="space-y-2">
            <Label>Price per Session (Rs)</Label>
            <NumberInput v-model="draft.price_per_session" :min="0" :step="50" />
          </div>
          <div v-else class="space-y-2">
            <Label>Package Price (Rs)</Label>
            <NumberInput v-model="draft.package_price" :min="0" :step="50" />
          </div>
          <div class="space-y-2">
            <Label>Notes</Label>
            <Textarea v-model="draft.notes" placeholder="Additional notes" rows="2" />
          </div>
        </div>
      </div>
      <DialogFooter
        class="bg-background shrink-0 border-t px-4 py-4 [padding-bottom:max(1rem,env(safe-area-inset-bottom))] sm:px-6"
      >
        <Button type="button" variant="outline" @click="emit('update:open', false)">
          Cancel
        </Button>
        <Button type="submit" :disabled="isSubmitting || !draft.patient_id || !draft.name">
          {{ isSubmitting ? 'Creating...' : 'Create Plan' }}
        </Button>
      </DialogFooter>
    </form>
  </ResponsiveFormOverlay>
</template>

<script setup lang="ts">
import { computed, ref, watch } from 'vue'
import { storeToRefs } from 'pinia'
import { NumberInput } from '~/components/ui/input'
import { usePatientsStore } from '~/stores/patients.store'
import { useStaffStore } from '~/stores/staff.store'
import { createDefaultTreatmentPlanDraft } from '~/features/treatments/types'

const props = defineProps<{
  open: boolean
}>()

const emit = defineEmits<{
  'update:open': [value: boolean]
  submit: [
    payload: {
      patientId: string
      therapistId: string | null
      name: string
      diagnosis: string | null
      treatmentType: string | null
      totalSessions: number
      pricePerSession: number | null
      packagePrice: number | null
      notes: string | null
    },
  ]
}>()

const { activeMembership } = useAuth()
const patientsStore = usePatientsStore()
const staffStore = useStaffStore()

const { dropdownByClinic } = storeToRefs(patientsStore)
const { activeByClinic } = storeToRefs(staffStore)

const draft = ref(createDefaultTreatmentPlanDraft())
const isSubmitting = ref(false)
let dropdownsLoaded = false

const patients = computed(() => {
  if (!activeMembership.value?.clinic_id) return []
  return dropdownByClinic.value[activeMembership.value.clinic_id] ?? []
})

const therapists = computed(() => {
  if (!activeMembership.value?.clinic_id) return []
  return activeByClinic.value[activeMembership.value.clinic_id] ?? []
})

async function loadDropdowns(): Promise<void> {
  if (dropdownsLoaded || !activeMembership.value?.clinic_id) return
  dropdownsLoaded = true

  try {
    const clinicId = activeMembership.value.clinic_id
    await Promise.all([patientsStore.fetchDropdown(clinicId), staffStore.fetchActiveList(clinicId)])
  } catch {
    dropdownsLoaded = false
  }
}

function handleSubmit(): void {
  if (!draft.value.patient_id || !draft.value.name) return
  isSubmitting.value = true

  emit('submit', {
    patientId: draft.value.patient_id,
    therapistId: draft.value.therapist_id || null,
    name: draft.value.name,
    diagnosis: draft.value.diagnosis || null,
    treatmentType: draft.value.treatment_type || null,
    totalSessions: draft.value.total_sessions,
    pricePerSession:
      draft.value.pricing_mode === 'per_session' ? draft.value.price_per_session || null : null,
    packagePrice: draft.value.pricing_mode === 'package' ? draft.value.package_price || null : null,
    notes: draft.value.notes || null,
  })
}

function markSubmitted() {
  isSubmitting.value = false
}

watch(
  () => props.open,
  (isOpen) => {
    if (isOpen) {
      void loadDropdowns()
    } else {
      draft.value = createDefaultTreatmentPlanDraft()
      isSubmitting.value = false
    }
  },
)

defineExpose({ markSubmitted })
</script>
