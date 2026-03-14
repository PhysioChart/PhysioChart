<template>
  <Card>
    <!-- Tier 1: Identity -->
    <CardHeader class="pb-3 max-sm:px-4">
      <div class="flex items-start justify-between gap-2">
        <div class="min-w-0 flex-1">
          <CardTitle class="truncate text-base leading-tight font-semibold">
            {{ plan.name }}
          </CardTitle>
          <div class="mt-1 flex items-center gap-1.5">
            <User class="text-muted-foreground h-3.5 w-3.5 shrink-0" />
            <span class="text-muted-foreground truncate text-sm">
              {{ plan.patient?.full_name ?? 'Unknown' }}
            </span>
          </div>
        </div>
        <Badge :class="getStatusColor(plan.status)" variant="secondary" class="shrink-0">
          {{ TREATMENT_STATUS_LABELS[plan.status] }}
        </Badge>
      </div>
      <Badge v-if="plan.treatment_type" variant="outline" class="mt-1.5 w-fit text-xs">
        {{ plan.treatment_type }}
      </Badge>
    </CardHeader>

    <CardContent class="max-sm:px-4">
      <!-- Tier 2: Progress -->
      <div class="space-y-1">
        <div class="flex items-baseline justify-between">
          <span class="text-sm font-medium">
            <template v-if="plan.total_sessions !== null">
              {{ plan.derived_completed_sessions }}/{{ plan.total_sessions }} sessions
            </template>
            <template v-else> {{ plan.derived_completed_sessions }} sessions completed </template>
          </span>
          <span v-if="plan.total_sessions !== null" class="text-muted-foreground text-xs">
            {{ progressPercent(plan.derived_completed_sessions, plan.total_sessions) }}%
          </span>
        </div>
        <p
          v-if="
            plan.total_sessions !== null && plan.derived_completed_sessions > plan.total_sessions
          "
          class="text-[11px] text-amber-500"
        >
          Extended
        </p>
        <div class="bg-muted h-2 w-full rounded-full">
          <div
            class="bg-primary h-full rounded-full transition-all duration-300"
            :style="{
              width: `${progressPercent(plan.derived_completed_sessions, plan.total_sessions)}%`,
            }"
          />
        </div>
      </div>

      <!-- Tier 3: Supporting Context -->
      <div class="mt-3 space-y-1.5">
        <div v-if="plan.diagnosis" class="flex items-start gap-1.5">
          <Stethoscope class="text-muted-foreground mt-0.5 h-3.5 w-3.5 shrink-0" />
          <span class="text-muted-foreground line-clamp-2 text-sm">{{ plan.diagnosis }}</span>
        </div>
        <div v-if="plan.package_price || plan.price_per_session" class="flex items-center gap-1.5">
          <IndianRupee class="text-muted-foreground h-3.5 w-3.5 shrink-0" />
          <span class="text-muted-foreground text-sm">
            <template v-if="plan.package_price">
              Package: {{ formatCurrency(plan.package_price) }}
            </template>
            <template v-else-if="plan.price_per_session">
              {{ formatCurrency(plan.price_per_session) }}/session
            </template>
          </span>
        </div>
        <div v-if="plan.therapist" class="flex items-center gap-1.5">
          <UserCheck class="text-muted-foreground h-3.5 w-3.5 shrink-0" />
          <span class="text-muted-foreground text-sm">{{ plan.therapist.full_name }}</span>
        </div>
      </div>

      <!-- Separator between tiers 1-3 and tier 4 -->
      <Separator class="my-3" />

      <!-- Tier 4: Collapsible Detail Sections -->
      <div class="-mx-6 space-y-2 max-sm:-mx-4">
        <!-- Session History -->
        <Collapsible v-model:open="sessionHistoryOpen">
          <CollapsibleTrigger
            class="hover:bg-muted/50 flex h-9 w-full items-center gap-2 px-6 text-sm max-sm:px-4"
          >
            <FileText class="text-muted-foreground h-3.5 w-3.5 shrink-0" />
            <span class="font-medium">Session notes</span>
            <Badge variant="secondary" class="ml-auto h-5 px-1.5 text-[10px]">
              {{ history.length }}
            </Badge>
            <ChevronDown
              class="text-muted-foreground h-4 w-4 shrink-0 transition-transform duration-200"
              :class="{ 'rotate-180': sessionHistoryOpen }"
            />
          </CollapsibleTrigger>
          <CollapsibleContent>
            <div class="px-6 pt-2 pb-1 max-sm:px-4">
              <TreatmentSessionHistory
                :history="history"
                :loading="historyLoading"
                :error="historyError"
              />
            </div>
          </CollapsibleContent>
        </Collapsible>

        <!-- Linked Appointments -->
        <div class="border-border/50 border-t">
          <Collapsible v-model:open="appointmentsOpen">
            <div class="flex items-center px-6 max-sm:px-4">
              <CollapsibleTrigger
                class="hover:bg-muted/50 flex h-9 flex-1 items-center gap-2 text-sm"
              >
                <CalendarDays class="text-muted-foreground h-3.5 w-3.5 shrink-0" />
                <span class="font-medium">Appointments</span>
                <Badge variant="secondary" class="ml-auto h-5 px-1.5 text-[10px]">
                  {{ linkedAppointments.length }}
                </Badge>
                <ChevronDown
                  class="text-muted-foreground h-4 w-4 shrink-0 transition-transform duration-200"
                  :class="{ 'rotate-180': appointmentsOpen }"
                />
              </CollapsibleTrigger>
              <Button
                v-if="plan.status === TreatmentStatus.ACTIVE"
                size="sm"
                variant="outline"
                class="ml-2 h-7 shrink-0"
                @click.stop="emit('createLinkedAppointment', plan)"
              >
                <CalendarPlus class="mr-1 h-3.5 w-3.5" />
                Create
              </Button>
            </div>
            <CollapsibleContent>
              <div class="px-6 pt-2 pb-1 max-sm:px-4">
                <p v-if="linkedLoading" class="text-muted-foreground text-xs">
                  Loading linked appointments...
                </p>
                <p v-else-if="linkedError" class="text-xs text-amber-600">
                  {{ linkedError }}
                </p>
                <p
                  v-else-if="linkedAppointments.length === 0"
                  class="text-muted-foreground text-xs"
                >
                  No linked appointments yet
                </p>
                <ul v-else class="space-y-1">
                  <li
                    v-for="appointment in linkedAppointments"
                    :key="appointment.id"
                    class="flex items-center justify-between gap-2 text-xs"
                  >
                    <span>
                      {{ formatDateWithYear(appointment.startTime) }} &middot;
                      {{ formatTime(appointment.startTime) }} -
                      {{ formatTime(appointment.endTime) }}
                    </span>
                    <Badge :class="getStatusColor(appointment.status)" variant="secondary">
                      {{ APPOINTMENT_STATUS_LABELS[appointment.status] }}
                    </Badge>
                  </li>
                </ul>
              </div>
            </CollapsibleContent>
          </Collapsible>
        </div>
      </div>
    </CardContent>
  </Card>
</template>

<script setup lang="ts">
import { ref } from 'vue'
import {
  CalendarDays,
  CalendarPlus,
  ChevronDown,
  FileText,
  IndianRupee,
  Stethoscope,
  User,
  UserCheck,
} from 'lucide-vue-next'
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from '~/components/ui/collapsible'
import { Separator } from '~/components/ui/separator'
import TreatmentSessionHistory from '~/components/common/TreatmentSessionHistory.vue'
import { APPOINTMENT_STATUS_LABELS } from '~/enums/appointment.enum'
import { TreatmentStatus, TREATMENT_STATUS_LABELS } from '~/enums/treatment.enum'
import {
  formatCurrency,
  formatDateWithYear,
  formatTime,
  getStatusColor,
  progressPercent,
} from '~/lib/formatters'
import type {
  ITreatmentLinkedAppointmentItem,
  ITreatmentPlanWithRelations,
  ITreatmentSessionHistoryItem,
} from '~/types/models/treatment.types'

defineProps<{
  plan: ITreatmentPlanWithRelations
  history: ITreatmentSessionHistoryItem[]
  historyLoading: boolean | undefined
  historyError: string | null | undefined
  linkedAppointments: ITreatmentLinkedAppointmentItem[]
  linkedLoading: boolean | undefined
  linkedError: string | null | undefined
}>()

const emit = defineEmits<{
  createLinkedAppointment: [plan: ITreatmentPlanWithRelations]
}>()

const sessionHistoryOpen = ref(false)
const appointmentsOpen = ref(false)
</script>
