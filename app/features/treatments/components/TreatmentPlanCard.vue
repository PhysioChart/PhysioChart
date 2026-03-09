<template>
  <Card>
    <CardHeader class="pb-2">
      <div class="flex items-start justify-between">
        <div>
          <CardTitle class="text-base">{{ plan.name }}</CardTitle>
          <CardDescription>
            {{ plan.patient?.full_name ?? 'Unknown' }}
            <template v-if="plan.therapist"> &middot; {{ plan.therapist.full_name }}</template>
          </CardDescription>
        </div>
        <Badge :class="getStatusColor(plan.status)" variant="secondary">
          {{ TREATMENT_STATUS_LABELS[plan.status] }}
        </Badge>
      </div>
    </CardHeader>
    <CardContent>
      <div v-if="plan.diagnosis" class="text-muted-foreground mb-2 text-sm">
        {{ plan.diagnosis }}
      </div>

      <!-- Progress bar -->
      <div class="space-y-1">
        <div class="flex justify-between text-xs">
          <span v-if="plan.total_sessions !== null">
            {{ plan.derived_completed_sessions }}/{{ plan.total_sessions }} sessions
          </span>
          <span v-else>{{ plan.derived_completed_sessions }} sessions completed</span>
          <span v-if="plan.total_sessions !== null">
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
            class="bg-primary h-full rounded-full transition-all"
            :style="{
              width: `${progressPercent(plan.derived_completed_sessions, plan.total_sessions)}%`,
            }"
          />
        </div>
      </div>

      <div
        v-if="plan.package_price || plan.price_per_session"
        class="text-muted-foreground mt-2 text-sm"
      >
        <span v-if="plan.package_price">Package: {{ formatCurrency(plan.package_price) }}</span>
        <span v-else-if="plan.price_per_session">
          {{ formatCurrency(plan.price_per_session) }}/session
        </span>
      </div>

      <div class="mt-3">
        <TreatmentSessionHistory
          :history="history"
          :loading="historyLoading"
          :error="historyError"
        />
      </div>

      <div class="mt-3 border-t pt-3">
        <div class="mb-2 flex items-center justify-between">
          <p class="text-muted-foreground text-xs font-medium">Linked appointments</p>
          <Button
            v-if="plan.status === TreatmentStatus.ACTIVE"
            size="sm"
            variant="outline"
            @click="emit('createLinkedAppointment', plan)"
          >
            <CalendarPlus class="mr-1 h-3.5 w-3.5" />
            Create appointment
          </Button>
        </div>

        <p v-if="linkedLoading" class="text-muted-foreground text-xs">
          Loading linked appointments...
        </p>
        <p v-else-if="linkedError" class="text-xs text-amber-600">
          {{ linkedError }}
        </p>
        <p v-else-if="linkedAppointments.length === 0" class="text-muted-foreground text-xs">
          No linked appointments yet
        </p>
        <ul v-else class="space-y-1">
          <li
            v-for="appointment in linkedAppointments"
            :key="appointment.id"
            class="flex items-center justify-between gap-2 text-xs"
          >
            <span>
              {{ formatDateWithYear(appointment.startTime) }} ·
              {{ formatTime(appointment.startTime) }} - {{ formatTime(appointment.endTime) }}
            </span>
            <Badge :class="getStatusColor(appointment.status)" variant="secondary">
              {{ APPOINTMENT_STATUS_LABELS[appointment.status] }}
            </Badge>
          </li>
        </ul>
      </div>
    </CardContent>
  </Card>
</template>

<script setup lang="ts">
import { CalendarPlus } from 'lucide-vue-next'
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
</script>
