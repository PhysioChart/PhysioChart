<template>
  <div class="flex flex-col gap-3 p-4 sm:flex-row sm:items-center sm:gap-4">
    <div class="flex shrink-0 flex-col items-center text-center">
      <span class="text-muted-foreground text-xs">{{ formatDate(appointment.start_time) }}</span>
      <span class="text-sm font-semibold">{{ formatTime(appointment.start_time) }}</span>
      <span class="text-muted-foreground text-xs">{{ formatTime(appointment.end_time) }}</span>
    </div>

    <Separator orientation="vertical" class="hidden h-12 sm:block" />

    <div class="flex-1">
      <p class="font-medium">{{ appointment.patient?.full_name ?? 'Unknown patient' }}</p>
      <p class="text-muted-foreground text-xs">
        <span v-if="appointment.therapist">with {{ appointment.therapist.full_name }}</span>
        <span v-if="appointment.treatment_plan">
          &middot; Plan: {{ appointment.treatment_plan.name }}</span
        >
        <span v-if="appointment.notes"> &middot; {{ appointment.notes }}</span>
      </p>
    </div>

    <div class="flex items-center gap-2 sm:self-auto">
      <Badge :class="getStatusColor(appointment.status)" variant="secondary">
        {{ APPOINTMENT_STATUS_LABELS[appointment.status] }}
      </Badge>
      <Badge v-if="appointment.series_id" variant="outline" class="text-[10px]">
        {{ appointment.series_index }}/{{ seriesTotal }}
      </Badge>
    </div>

    <div class="flex w-full flex-wrap items-center gap-2 sm:w-auto sm:justify-end">
      <Button v-if="showProminentReminderCta && reminderHref" as-child size="sm">
        <a :href="reminderHref" target="_blank" rel="noopener noreferrer">
          <MessageCircle class="mr-2 h-4 w-4" />
          Send Reminder
        </a>
      </Button>

      <Tooltip v-else-if="reminderHref">
        <TooltipTrigger as-child>
          <Button as-child variant="ghost" size="icon" :aria-label="reminderAriaLabel">
            <a :href="reminderHref" target="_blank" rel="noopener noreferrer">
              <MessageCircle class="h-4 w-4" />
            </a>
          </Button>
        </TooltipTrigger>
        <TooltipContent>Send WhatsApp reminder</TooltipContent>
      </Tooltip>

      <DropdownMenu
        v-if="
          appointment.status === AppointmentStatus.SCHEDULED ||
          appointment.status === AppointmentStatus.CHECKED_IN ||
          appointment.status === AppointmentStatus.COMPLETED
        "
      >
        <DropdownMenuTrigger as-child>
          <Button variant="ghost" size="sm">
            {{ appointment.status === AppointmentStatus.COMPLETED ? 'Manage' : 'Update' }}
          </Button>
        </DropdownMenuTrigger>
        <DropdownMenuContent>
          <template v-if="appointment.status !== AppointmentStatus.COMPLETED">
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
          <DropdownMenuItem
            v-else
            :disabled="!canReopen"
            @click="emit('request-reopen', appointment.id)"
          >
            Reopen Appointment
          </DropdownMenuItem>
        </DropdownMenuContent>
      </DropdownMenu>
    </div>
  </div>
</template>

<script setup lang="ts">
import { MessageCircle } from 'lucide-vue-next'
import { APPOINTMENT_STATUS_LABELS, AppointmentStatus } from '~/enums/appointment.enum'
import {
  formatDate,
  formatTime,
  getAppointmentWhatsAppLink,
  getStatusColor,
} from '~/lib/formatters'
import type { IAppointmentWithRelations } from '~/types/models/appointment.types'

const props = defineProps<{
  appointment: IAppointmentWithRelations
  seriesTotal: number
  canReopen: boolean
  clinicName: string | null
  showProminentReminderCta: boolean
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

const reminderAriaLabel = computed(
  () => `Send WhatsApp reminder to ${props.appointment.patient?.full_name ?? 'patient'}`,
)

const emit = defineEmits<{
  (e: 'request-complete', appointment: IAppointmentWithRelations): void
  (e: 'request-reopen' | 'cancel-series', id: string): void
  (e: 'update-status', id: string, status: AppointmentStatus): void
}>()
</script>
