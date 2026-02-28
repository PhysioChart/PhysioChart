<template>
  <div>
    <Card v-if="isLoadingAppointments">
      <CardContent class="space-y-3 p-6">
        <Skeleton v-for="i in 3" :key="i" class="h-24 w-full" />
      </CardContent>
    </Card>

    <Card v-else-if="appointments.length === 0">
      <CardContent class="flex flex-col items-center justify-center py-12 text-center">
        <Calendar class="text-muted-foreground/50 mb-3 h-10 w-10" />
        <p class="text-muted-foreground text-sm">No appointments for this patient yet</p>
        <Button variant="outline" class="mt-3" @click="navigateTo('/appointments?action=new')">
          Book an appointment
        </Button>
      </CardContent>
    </Card>

    <div v-else class="space-y-6">
      <div class="space-y-3">
        <div class="flex items-center justify-between">
          <p class="text-muted-foreground text-sm font-medium">Upcoming</p>
          <Button
            size="sm"
            variant="outline"
            @click="navigateTo('/appointments?action=new&patientId=' + patientId)"
          >
            + Book
          </Button>
        </div>

        <p v-if="upcomingAppointments.length === 0" class="text-muted-foreground text-sm">
          No upcoming appointments
        </p>

        <Card v-for="appt in upcomingAppointments" v-else :key="appt.id">
          <CardContent class="space-y-2 p-4">
            <div class="flex items-start justify-between gap-3">
              <div>
                <p class="font-medium">{{ formatDateLong(appt.start_time) }}</p>
                <p class="text-muted-foreground text-sm">
                  {{ formatTime(appt.start_time) }} - {{ formatTime(appt.end_time) }}
                </p>
              </div>
              <Badge :class="getAppointmentStatusBadgeClass(appt.status)" variant="secondary">
                {{ APPOINTMENT_STATUS_LABELS[appt.status] }}
              </Badge>
            </div>

            <p class="text-muted-foreground text-sm">
              Therapist: {{ appt.therapist?.full_name ?? 'Unassigned' }}
            </p>

            <p v-if="appt.treatment_plan" class="text-muted-foreground text-sm">
              Plan: {{ appt.treatment_plan.name }} ({{ appt.treatment_plan.completed_sessions }}/{{
                appt.treatment_plan.total_sessions
              }}
              sessions)
            </p>

            <p v-if="appt.notes" class="text-sm">{{ appt.notes }}</p>
          </CardContent>
        </Card>
      </div>

      <div v-if="pastAppointments.length > 0" class="space-y-3">
        <p class="text-muted-foreground text-sm font-medium">Past</p>

        <Card v-for="appt in visiblePastAppointments" :key="appt.id">
          <CardContent class="space-y-2 p-4">
            <div class="flex items-start justify-between gap-3">
              <div>
                <p class="font-medium">{{ formatDateLong(appt.start_time) }}</p>
                <p class="text-muted-foreground text-sm">
                  {{ formatTime(appt.start_time) }} - {{ formatTime(appt.end_time) }}
                </p>
              </div>
              <Badge :class="getAppointmentStatusBadgeClass(appt.status)" variant="secondary">
                {{ APPOINTMENT_STATUS_LABELS[appt.status] }}
              </Badge>
            </div>

            <p class="text-muted-foreground text-sm">
              Therapist: {{ appt.therapist?.full_name ?? 'Unassigned' }}
            </p>

            <p v-if="appt.treatment_plan" class="text-muted-foreground text-sm">
              Plan: {{ appt.treatment_plan.name }} ({{ appt.treatment_plan.completed_sessions }}/{{
                appt.treatment_plan.total_sessions
              }}
              sessions)
            </p>

            <p v-if="appt.notes" class="text-sm">{{ appt.notes }}</p>
          </CardContent>
        </Card>

        <Button
          v-if="pastAppointments.length > 10 && !showAllPast"
          variant="ghost"
          class="text-muted-foreground h-auto px-0 py-1 text-sm"
          @click="emit('show-more-past')"
        >
          Show {{ remainingPastCount }} more
        </Button>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { Calendar } from 'lucide-vue-next'
import type { IAppointmentWithRelations } from '~/types/models/appointment.types'
import { APPOINTMENT_STATUS_LABELS } from '~/enums/appointment.enum'
import { formatDateLong, formatTime } from '~/lib/formatters'

defineProps<{
  patientId: string
  appointments: IAppointmentWithRelations[]
  upcomingAppointments: IAppointmentWithRelations[]
  pastAppointments: IAppointmentWithRelations[]
  visiblePastAppointments: IAppointmentWithRelations[]
  remainingPastCount: number
  showAllPast: boolean
  isLoadingAppointments: boolean
  getAppointmentStatusBadgeClass: (status: string) => string
}>()

const emit = defineEmits<{
  (e: 'show-more-past'): void
}>()
</script>
