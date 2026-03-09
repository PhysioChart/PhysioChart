<template>
  <div>
    <Card v-if="isLoadingTreatments">
      <CardContent class="space-y-3 p-6">
        <Skeleton v-for="i in 2" :key="i" class="h-24 w-full" />
      </CardContent>
    </Card>

    <Card v-else-if="treatments.length === 0">
      <CardContent class="flex flex-col items-center justify-center py-12 text-center">
        <ClipboardList class="text-muted-foreground/50 mb-3 h-10 w-10" />
        <p class="text-muted-foreground text-sm">No treatment plans for this patient yet</p>
        <Button variant="outline" class="mt-3" @click="navigateTo('/treatments?action=new')">
          Create a treatment plan
        </Button>
      </CardContent>
    </Card>

    <div v-else class="space-y-6">
      <div>
        <div class="mb-3 flex items-center justify-between">
          <p class="text-muted-foreground text-sm font-medium">Active</p>
          <Button
            size="sm"
            variant="outline"
            @click="navigateTo('/treatments?action=new&patientId=' + patientId)"
          >
            + New Plan
          </Button>
        </div>

        <p v-if="activeTreatments.length === 0" class="text-muted-foreground text-sm">
          No active treatment plans
        </p>

        <div v-else class="space-y-2">
          <Card v-for="plan in activeTreatments" :key="plan.id">
            <CardContent class="space-y-2 px-4 py-3">
              <div class="flex items-center justify-between gap-3">
                <p class="font-medium">{{ plan.name }}</p>
                <Badge :class="getTreatmentStatusBadgeClass(plan.status)" variant="secondary">
                  {{ TREATMENT_STATUS_LABELS[plan.status] }}
                </Badge>
              </div>

              <p class="text-muted-foreground text-sm">
                Therapist: {{ plan.therapist?.full_name ?? 'Unassigned' }}
              </p>

              <div>
                <div class="flex items-center justify-between text-sm">
                  <span v-if="plan.total_sessions !== null" class="text-muted-foreground">
                    Session {{ plan.derived_completed_sessions }} of {{ plan.total_sessions }}
                    <span v-if="plan.derived_completed_sessions > plan.total_sessions">
                      (Extended)
                    </span>
                  </span>
                  <span v-else class="text-muted-foreground">
                    {{ plan.derived_completed_sessions }} sessions completed
                  </span>
                  <span class="text-muted-foreground">{{ treatmentProgress(plan) }}%</span>
                </div>
                <div class="bg-secondary mt-1 h-2 w-full rounded-full">
                  <div
                    class="bg-primary h-2 rounded-full"
                    :style="{ width: treatmentProgress(plan) + '%' }"
                  />
                </div>
              </div>

              <p v-if="plan.diagnosis" class="text-muted-foreground/70 mt-1 text-xs">
                Diagnosis: {{ plan.diagnosis }}
              </p>

              <p v-if="plan.package_price" class="text-muted-foreground/70 text-xs">
                Package: {{ formatCurrency(plan.package_price) }}
              </p>
              <p v-else-if="plan.price_per_session" class="text-muted-foreground/70 text-xs">
                {{ formatCurrency(plan.price_per_session) }}/session
              </p>

              <div class="mt-2">
                <TreatmentSessionHistory
                  :history="historyByPlan[plan.id] || []"
                  :loading="loadingByPlan[plan.id]"
                  :error="errorByPlan[plan.id]"
                />
              </div>
            </CardContent>
          </Card>
        </div>
      </div>

      <div v-if="completedTreatments.length > 0">
        <p class="text-muted-foreground mb-3 text-sm font-medium">Completed</p>

        <div class="space-y-2">
          <Card v-for="plan in completedTreatments" :key="plan.id">
            <CardContent class="space-y-2 px-4 py-3">
              <div class="flex items-center justify-between gap-3">
                <p class="font-medium">{{ plan.name }}</p>
                <Badge :class="getTreatmentStatusBadgeClass(plan.status)" variant="secondary">
                  {{ TREATMENT_STATUS_LABELS[plan.status] }}
                </Badge>
              </div>

              <p class="text-muted-foreground text-sm">
                Therapist: {{ plan.therapist?.full_name ?? 'Unassigned' }}
              </p>

              <div>
                <div class="flex items-center justify-between text-sm">
                  <span v-if="plan.total_sessions !== null" class="text-muted-foreground">
                    Session {{ plan.derived_completed_sessions }} of {{ plan.total_sessions }}
                    <span v-if="plan.derived_completed_sessions > plan.total_sessions">
                      (Extended)
                    </span>
                  </span>
                  <span v-else class="text-muted-foreground">
                    {{ plan.derived_completed_sessions }} sessions completed
                  </span>
                  <span class="text-muted-foreground">{{ treatmentProgress(plan) }}%</span>
                </div>
                <div class="bg-secondary mt-1 h-2 w-full rounded-full">
                  <div
                    class="bg-primary h-2 rounded-full"
                    :style="{ width: treatmentProgress(plan) + '%' }"
                  />
                </div>
              </div>

              <p v-if="plan.diagnosis" class="text-muted-foreground/70 mt-1 text-xs">
                Diagnosis: {{ plan.diagnosis }}
              </p>

              <p v-if="plan.package_price" class="text-muted-foreground/70 text-xs">
                Package: {{ formatCurrency(plan.package_price) }}
              </p>
              <p v-else-if="plan.price_per_session" class="text-muted-foreground/70 text-xs">
                {{ formatCurrency(plan.price_per_session) }}/session
              </p>

              <div class="mt-2">
                <TreatmentSessionHistory
                  :history="historyByPlan[plan.id] || []"
                  :loading="loadingByPlan[plan.id]"
                  :error="errorByPlan[plan.id]"
                />
              </div>
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { computed, toRefs, watch } from 'vue'
import { ClipboardList } from 'lucide-vue-next'
import TreatmentSessionHistory from '~/components/common/TreatmentSessionHistory.vue'
import { useTreatmentSessionHistory } from '~/composables/useTreatmentSessionHistory'
import type { ITreatmentPlanWithRelations } from '~/types/models/treatment.types'
import type { TreatmentStatus } from '~/enums/treatment.enum'
import { TREATMENT_STATUS_LABELS } from '~/enums/treatment.enum'
import { formatCurrency } from '~/lib/formatters'

const props = defineProps<{
  patientId: string
  isLoadingTreatments: boolean
  treatments: ITreatmentPlanWithRelations[]
  activeTreatments: ITreatmentPlanWithRelations[]
  completedTreatments: ITreatmentPlanWithRelations[]
  getTreatmentStatusBadgeClass: (status: TreatmentStatus) => string
  treatmentProgress: (plan: ITreatmentPlanWithRelations) => number
}>()

const {
  activeTreatments,
  completedTreatments,
  treatments,
  isLoadingTreatments,
  patientId,
  getTreatmentStatusBadgeClass,
  treatmentProgress,
} = toRefs(props)

const { activeMembership } = useAuth()
const { historyByPlan, loadingByPlan, errorByPlan, loadHistory } = useTreatmentSessionHistory()

const planIds = computed(() => {
  return [...activeTreatments.value, ...completedTreatments.value].map((p) => p.id)
})

watch(
  planIds,
  async (ids) => {
    if (!activeMembership.value?.clinic_id || ids.length === 0) return
    await loadHistory(activeMembership.value.clinic_id, ids)
  },
  { immediate: true },
)
</script>
