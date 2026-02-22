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

        <Badge :class="getStatusColor(appointment.status)" variant="secondary">
          {{ APPOINTMENT_STATUS_LABELS[appointment.status] }}
        </Badge>

        <div v-if="appointment.series_id" class="text-muted-foreground text-xs">
          Part of a recurring series (session {{ appointment.series_index }})
        </div>

        <div v-if="appointment.notes" class="bg-muted rounded-md p-3">
          <p class="text-muted-foreground mb-1 text-xs">Notes</p>
          <p class="text-sm">{{ appointment.notes }}</p>
        </div>

        <Separator />

        <div class="space-y-2">
          <Button
            v-if="appointment.patient"
            variant="outline"
            class="w-full justify-start"
            as="a"
            :href="getWhatsAppLink(appointment.patient, appointment.start_time)"
            target="_blank"
          >
            <MessageCircle class="mr-2 h-4 w-4" />
            Send WhatsApp Reminder
          </Button>

          <template v-if="appointment.status === AppointmentStatus.SCHEDULED">
            <Button
              variant="outline"
              class="w-full justify-start"
              @click="emit('updateStatus', appointment.id, AppointmentStatus.COMPLETED)"
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
        </div>
      </div>
    </SheetContent>
  </Sheet>
</template>

<script setup lang="ts">
import { Clock, MessageCircle, Stethoscope, User } from 'lucide-vue-next'
import type { CalendarAppointment } from '~/composables/useCalendar'
import { AppointmentStatus, APPOINTMENT_STATUS_LABELS } from '~/enums/appointment.enum'
import { formatDateTime, formatTime, getStatusColor, getWhatsAppLink } from '~/lib/formatters'

defineProps<{
  appointment: CalendarAppointment | null
}>()

const open = defineModel<boolean>('open', { required: true })

const emit = defineEmits<{
  updateStatus: [id: string, status: AppointmentStatus]
}>()
</script>
