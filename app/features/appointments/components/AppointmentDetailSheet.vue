<template>
  <Sheet v-model:open="open">
    <SheetContent>
      <SheetHeader>
        <SheetTitle>Appointment Details</SheetTitle>
        <SheetDescription v-if="appointment">
          {{ formatDateTime(appointment.start_time) }}
        </SheetDescription>
      </SheetHeader>

      <div v-if="appointment" class="mt-6 space-y-4">
        <div class="flex items-center gap-3">
          <User class="text-muted-foreground h-4 w-4" />
          <div>
            <p class="text-sm font-medium">{{ appointment.patient?.full_name ?? 'Unknown' }}</p>
            <p class="text-muted-foreground text-xs">Patient</p>
          </div>
        </div>

        <div v-if="appointment.therapist" class="flex items-center gap-3">
          <Stethoscope class="text-muted-foreground h-4 w-4" />
          <div>
            <p class="text-sm font-medium">{{ appointment.therapist.full_name }}</p>
            <p class="text-muted-foreground text-xs">Therapist</p>
          </div>
        </div>

        <div class="flex items-center gap-3">
          <Clock class="text-muted-foreground h-4 w-4" />
          <p class="text-sm font-medium">
            {{ formatDateTime(appointment.start_time) }} – {{ formatTime(appointment.end_time) }}
          </p>
        </div>

        <StatusChip :status="appointment.status" />

        <div v-if="appointment.series_id" class="text-muted-foreground text-xs">
          Part of a recurring series (session {{ appointment.series_index }})
        </div>

        <div v-if="appointment.treatment_plan" class="flex items-center gap-3">
          <ClipboardList class="text-muted-foreground h-4 w-4" />
          <div>
            <p class="text-sm font-medium">{{ appointment.treatment_plan.name }}</p>
            <p class="text-muted-foreground text-xs">
              Status: {{ TREATMENT_STATUS_LABELS[appointment.treatment_plan.status] }}
            </p>
            <p v-if="appointment.treatment_plan.diagnosis" class="text-muted-foreground text-xs">
              Diagnosis: {{ appointment.treatment_plan.diagnosis }}
            </p>
            <p
              v-if="appointment.treatment_plan.treatment_type"
              class="text-muted-foreground text-xs"
            >
              Type: {{ appointment.treatment_plan.treatment_type }}
            </p>
            <p class="text-muted-foreground text-xs">
              <span v-if="appointment.treatment_plan.total_sessions !== null">
                Plan ({{ appointment.treatment_plan.derived_completed_sessions }}/{{
                  appointment.treatment_plan.total_sessions
                }}
                sessions)
              </span>
              <span v-else>
                {{ appointment.treatment_plan.derived_completed_sessions }} sessions completed
              </span>
              <span
                v-if="
                  appointment.treatment_plan.total_sessions !== null &&
                  appointment.treatment_plan.derived_completed_sessions >
                    appointment.treatment_plan.total_sessions
                "
              >
                (Extended)
              </span>
            </p>
          </div>
        </div>

        <div v-if="appointment.notes" class="bg-muted rounded-md p-3">
          <p class="text-muted-foreground mb-1 text-xs">Notes</p>
          <p class="text-sm">{{ appointment.notes }}</p>
        </div>

        <Separator />

        <div class="space-y-2">
          <Button v-if="reminderHref" as-child variant="outline" class="w-full justify-start">
            <a :href="reminderHref" target="_blank" rel="noopener noreferrer">
              <MessageCircle class="mr-2 h-4 w-4" />
              Send WhatsApp Reminder
            </a>
          </Button>

          <template
            v-if="
              appointment.status === AppointmentStatus.SCHEDULED ||
              appointment.status === AppointmentStatus.CHECKED_IN
            "
          >
            <Button
              variant="outline"
              class="w-full justify-start"
              @click="emit('requestComplete', appointment)"
            >
              Mark Completed
            </Button>
            <Button
              variant="outline"
              class="w-full justify-start"
              @click="emit('updateStatus', appointment.id, AppointmentStatus.CANCELLED)"
            >
              Mark Cancelled
            </Button>
            <Button
              variant="outline"
              class="w-full justify-start"
              @click="emit('updateStatus', appointment.id, AppointmentStatus.NO_SHOW)"
            >
              Mark No-Show
            </Button>
          </template>
          <Button
            v-else-if="appointment.status === AppointmentStatus.COMPLETED"
            variant="outline"
            class="w-full justify-start"
            :disabled="!canReopen"
            @click="emit('requestReopen', appointment.id)"
          >
            Reopen Appointment
          </Button>
        </div>
      </div>
    </SheetContent>
  </Sheet>
</template>

<script setup lang="ts">
import { ClipboardList, Clock, MessageCircle, Stethoscope, User } from 'lucide-vue-next'
import type { CalendarAppointment } from '~/composables/useCalendar'
import { AppointmentStatus } from '~/enums/appointment.enum'
import { TREATMENT_STATUS_LABELS } from '~/enums/treatment.enum'
import { formatDateTime, formatTime, getAppointmentWhatsAppLink } from '~/lib/formatters'

const props = defineProps<{
  appointment: CalendarAppointment | null
  clinicName: string | null
  canReopen: boolean
}>()

const reminderHref = computed(() => {
  if (!props.appointment) return null
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

const open = defineModel<boolean>('open', { required: true })

const emit = defineEmits<{
  requestComplete: [appointment: CalendarAppointment]
  requestReopen: [appointmentId: string]
  updateStatus: [id: string, status: AppointmentStatus]
}>()
</script>
