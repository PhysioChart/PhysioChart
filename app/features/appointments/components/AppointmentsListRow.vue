<template>
  <div class="group relative flex flex-col gap-2 px-4 py-3 sm:flex-row sm:items-center sm:gap-4">
    <!-- ZONE 1: Time -->
    <div
      class="flex items-center gap-1.5 sm:w-[88px] sm:shrink-0 sm:flex-col sm:items-start sm:gap-0"
    >
      <span class="text-sm font-semibold tabular-nums">{{
        formatTime(appointment.start_time)
      }}</span>
      <span class="text-muted-foreground text-xs tabular-nums"
        >– {{ formatTime(appointment.end_time) }}</span
      >
    </div>

    <!-- ZONE 2: Content -->
    <div class="min-w-0 flex-1">
      <div class="flex items-center gap-2">
        <p class="truncate text-sm font-medium">
          {{ appointment.patient?.full_name ?? 'Unknown patient' }}
        </p>
        <StatusChip :status="appointment.status" class="shrink-0 text-[10px] leading-none" />
        <Badge
          v-if="appointment.series_id"
          variant="outline"
          class="shrink-0 text-[10px] leading-none"
        >
          {{ appointment.series_index ?? '?' }}/{{ seriesTotal }}
        </Badge>
      </div>
      <p class="text-muted-foreground mt-0.5 truncate text-xs">
        <span v-if="appointment.therapist">{{ appointment.therapist.full_name }}</span>
        <span v-if="appointment.treatment_plan">
          <span v-if="appointment.therapist"> &middot; </span>
          {{ appointment.treatment_plan.name }}
        </span>
        <span v-if="appointment.notes">
          <span v-if="appointment.therapist || appointment.treatment_plan"> &middot; </span>
          {{ appointment.notes }}
        </span>
      </p>
    </div>

    <!-- ZONE 3: Actions -->
    <div class="absolute top-3 right-3 sm:static sm:shrink-0">
      <DropdownMenu v-if="hasActions">
        <DropdownMenuTrigger as-child>
          <Button variant="ghost" size="icon" class="h-7 w-7 sm:h-9 sm:w-9">
            <MoreHorizontal class="h-3.5 w-3.5 sm:h-4 sm:w-4" />
            <span class="sr-only">Actions</span>
          </Button>
        </DropdownMenuTrigger>
        <DropdownMenuContent align="end" class="[&_[data-slot=dropdown-menu-item]]:cursor-pointer">
          <DropdownMenuItem v-if="reminderHref" as-child>
            <a :href="reminderHref" target="_blank" rel="noopener noreferrer">
              <MessageCircle class="mr-2 h-4 w-4" />
              Send WhatsApp Reminder
            </a>
          </DropdownMenuItem>
          <template v-if="appointment.status !== AppointmentStatus.COMPLETED">
            <DropdownMenuSeparator v-if="reminderHref" />
            <DropdownMenuItem @click="emit('request-complete', appointment)">
              Mark Completed
            </DropdownMenuItem>
            <DropdownMenuItem
              @click="emit('update-status', appointment.id, AppointmentStatus.CANCELLED)"
            >
              Mark Cancelled
            </DropdownMenuItem>
            <DropdownMenuItem
              @click="emit('update-status', appointment.id, AppointmentStatus.NO_SHOW)"
            >
              Mark No-Show
            </DropdownMenuItem>
            <template v-if="appointment.series_id">
              <DropdownMenuSeparator />
              <DropdownMenuItem
                class="text-destructive"
                @click="emit('cancel-series', appointment.series_id)"
              >
                Cancel Remaining in Series
              </DropdownMenuItem>
            </template>
          </template>
          <template v-else>
            <DropdownMenuSeparator v-if="reminderHref" />
            <DropdownMenuItem
              :disabled="!canReopen"
              @click="emit('request-reopen', appointment.id)"
            >
              Reopen Appointment
            </DropdownMenuItem>
          </template>
        </DropdownMenuContent>
      </DropdownMenu>
    </div>
  </div>
</template>

<script setup lang="ts">
import { MessageCircle, MoreHorizontal } from 'lucide-vue-next'
import { AppointmentStatus } from '~/enums/appointment.enum'
import { formatTime, getAppointmentWhatsAppLink } from '~/lib/formatters'
import type { IAppointmentWithRelations } from '~/types/models/appointment.types'

const props = defineProps<{
  appointment: IAppointmentWithRelations
  seriesTotal: number
  canReopen: boolean
  clinicName: string | null
}>()

const reminderHref = computed(() => {
  if (
    props.appointment.status !== AppointmentStatus.SCHEDULED &&
    props.appointment.status !== AppointmentStatus.CHECKED_IN
  ) {
    return null
  }

  return getAppointmentWhatsAppLink({
    patient: props.appointment.patient,
    startTime: props.appointment.start_time,
    therapistName: props.appointment.therapist?.full_name ?? null,
    clinicName: props.clinicName,
  })
})

const hasActions = computed(() => {
  const s = props.appointment.status
  return (
    s === AppointmentStatus.SCHEDULED ||
    s === AppointmentStatus.CHECKED_IN ||
    s === AppointmentStatus.COMPLETED
  )
})

const emit = defineEmits<{
  (e: 'request-complete', appointment: IAppointmentWithRelations): void
  (e: 'request-reopen' | 'cancel-series', id: string): void
  (e: 'update-status', id: string, status: AppointmentStatus): void
}>()
</script>
