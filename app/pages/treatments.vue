<template>
  <div class="space-y-4">
    <TreatmentHeader @new-plan="showCreateDialog = true" />
    <TreatmentFilterBar v-model="filter" />

    <div v-if="isLoading" class="space-y-3">
      <Skeleton v-for="i in 3" :key="i" class="h-32 w-full" />
    </div>
    <div
      v-else-if="filteredPlans.length === 0"
      class="flex flex-col items-center justify-center py-12 text-center"
    >
      <ClipboardList class="text-muted-foreground/50 mb-3 h-10 w-10" />
      <p class="text-muted-foreground text-sm">
        {{
          filter === 'all'
            ? 'No treatment plans yet'
            : filter === TreatmentStatus.ACTIVE
              ? 'No active treatment plans'
              : 'No completed treatment plans'
        }}
      </p>
      <Button
        v-if="filter === 'all'"
        variant="outline"
        class="mt-3"
        @click="showCreateDialog = true"
      >
        Create your first treatment plan
      </Button>
    </div>
    <div v-else class="grid gap-4 md:grid-cols-2">
      <TreatmentPlanCard
        v-for="plan in filteredPlans"
        :key="plan.id"
        :plan="plan"
        :history="historyByPlan[plan.id] || []"
        :history-loading="loadingByPlan[plan.id]"
        :history-error="errorByPlan[plan.id]"
        :linked-appointments="linkedByPlan[plan.id] || []"
        :linked-loading="linkedLoadingByPlan[plan.id]"
        :linked-error="linkedErrorByPlan[plan.id]"
        @create-linked-appointment="openLinkedAppointment"
      />
    </div>

    <TreatmentCreateDialog
      ref="createDialogRef"
      :open="showCreateDialog"
      @update:open="showCreateDialog = $event"
      @submit="handleCreatePlan"
    />
  </div>
</template>

<script setup lang="ts">
import { storeToRefs } from 'pinia'
import { toast } from 'vue-sonner'
import { ClipboardList } from 'lucide-vue-next'
import { TreatmentStatus } from '~/enums/treatment.enum'
import { treatmentService } from '~/services/treatment.service'
import { useTreatmentsStore } from '~/stores/treatments.store'
import { useTreatmentSessionHistory } from '~/composables/useTreatmentSessionHistory'
import type {
  ITreatmentLinkedAppointmentItem,
  ITreatmentPlanWithRelations,
} from '~/types/models/treatment.types'
import TreatmentHeader from '~/features/treatments/components/TreatmentHeader.vue'
import TreatmentFilterBar from '~/features/treatments/components/TreatmentFilterBar.vue'
import TreatmentPlanCard from '~/features/treatments/components/TreatmentPlanCard.vue'
import TreatmentCreateDialog from '~/features/treatments/components/TreatmentCreateDialog.vue'

definePageMeta({ layout: 'protected' })

useHead({ title: 'Treatments' })

const supabase = useSupabaseClient()
const { activeMembership } = useAuth()
const route = useRoute()
const treatmentsStore = useTreatmentsStore()
const { byClinic } = storeToRefs(treatmentsStore)
const { historyByPlan, loadingByPlan, errorByPlan, loadHistory } = useTreatmentSessionHistory()

// --- State ---

const isLoading = ref(true)
const filter = ref<TreatmentStatus | 'all'>(TreatmentStatus.ACTIVE)
const showCreateDialog = ref(route.query.action === 'new')
const createDialogRef = ref<InstanceType<typeof TreatmentCreateDialog> | null>(null)

const linkedByPlan = ref<Record<string, ITreatmentLinkedAppointmentItem[]>>({})
const linkedLoadingByPlan = ref<Record<string, boolean>>({})
const linkedErrorByPlan = ref<Record<string, string | null>>({})
let linkedFetchToken = 0

// --- Computed ---

const plans = computed<ITreatmentPlanWithRelations[]>(() => {
  if (!activeMembership.value?.clinic_id) return []
  return byClinic.value[activeMembership.value.clinic_id] ?? []
})

const filteredPlans = computed(() => {
  if (filter.value === 'all') return plans.value
  return plans.value.filter((p) => p.status === filter.value)
})

const filteredPlanIds = computed(() => filteredPlans.value.map((p) => p.id))

// --- Data Loading ---

async function loadPlans() {
  if (!activeMembership.value?.clinic_id) return
  isLoading.value = true
  try {
    await treatmentsStore.fetchList(activeMembership.value.clinic_id)
  } catch (err: unknown) {
    toast.error(err instanceof Error ? err.message : 'Failed to load treatment plans')
  } finally {
    isLoading.value = false
  }
}

async function loadLinkedAppointments(clinicId: string, planIds: string[]) {
  const token = ++linkedFetchToken
  for (const planId of planIds) {
    linkedLoadingByPlan.value[planId] = true
    linkedErrorByPlan.value[planId] = null
  }

  try {
    const map = await treatmentService(supabase).fetchLinkedAppointments(clinicId, planIds, 3)
    if (token !== linkedFetchToken) return
    for (const planId of planIds) {
      linkedByPlan.value[planId] = map.get(planId) ?? []
      linkedLoadingByPlan.value[planId] = false
      linkedErrorByPlan.value[planId] = null
    }
  } catch (err: unknown) {
    if (token !== linkedFetchToken) return
    const message = err instanceof Error ? err.message : 'Failed to load linked appointments'
    for (const planId of planIds) {
      linkedByPlan.value[planId] = []
      linkedLoadingByPlan.value[planId] = false
      linkedErrorByPlan.value[planId] = message
    }
  }
}

// --- Interactions ---

function openLinkedAppointment(plan: ITreatmentPlanWithRelations) {
  void navigateTo({
    path: '/appointments',
    query: { action: 'new', patientId: plan.patient_id, treatmentPlanId: plan.id },
  })
}

// --- Write Orchestration ---

async function handleCreatePlan(payload: {
  patientId: string
  therapistId: string | null
  name: string
  diagnosis: string | null
  treatmentType: string | null
  totalSessions: number
  pricePerSession: number | null
  packagePrice: number | null
  notes: string | null
}) {
  if (!activeMembership.value?.clinic_id) return
  try {
    await treatmentService(supabase).create({
      clinic_id: activeMembership.value.clinic_id,
      patient_id: payload.patientId,
      therapist_id: payload.therapistId,
      name: payload.name,
      diagnosis: payload.diagnosis,
      treatment_type: payload.treatmentType,
      total_sessions: payload.totalSessions,
      price_per_session: payload.pricePerSession,
      package_price: payload.packagePrice,
      notes: payload.notes,
    })
    toast.success('Treatment plan created')
    treatmentsStore.invalidate(activeMembership.value.clinic_id)
    await loadPlans()
    showCreateDialog.value = false
  } catch (err: unknown) {
    toast.error(err instanceof Error ? err.message : 'Failed to create treatment plan')
  } finally {
    createDialogRef.value?.markSubmitted()
  }
}

// --- Lifecycle ---

watch(
  filteredPlanIds,
  async (ids) => {
    if (!activeMembership.value?.clinic_id || ids.length === 0) return
    await Promise.all([
      loadHistory(activeMembership.value.clinic_id, ids),
      loadLinkedAppointments(activeMembership.value.clinic_id, ids),
    ])
  },
  { immediate: true },
)

onMounted(loadPlans)
</script>
