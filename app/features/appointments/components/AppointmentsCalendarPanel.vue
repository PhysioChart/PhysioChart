<template>
  <Card class="gap-0 overflow-hidden py-0">
    <CardContent class="p-0">
      <ClientOnly>
        <AppointmentsScheduleX
          :appointments="appointments"
          :view-mode="calendarViewMode"
          :selected-date="selectedDate"
          :therapists="therapists"
          @click-slot="(date, time) => emit('click-slot', date, time)"
          @click-appointment="(appt) => emit('click-appointment', appt)"
        />
      </ClientOnly>
    </CardContent>
  </Card>
</template>

<script setup lang="ts">
import AppointmentsScheduleX from '~/features/appointments/components/AppointmentsScheduleX.vue'
import type { AppointmentsViewMode } from '~/features/appointments/types'
import type { IAppointmentWithRelations } from '~/types/models/appointment.types'

const props = defineProps<{
  viewMode: AppointmentsViewMode
  appointments: IAppointmentWithRelations[]
  selectedDate: string
  therapists: Array<{ id: string }>
}>()

const emit = defineEmits<{
  (e: 'click-slot', date: string, time: string): void
  (e: 'click-appointment', appointment: IAppointmentWithRelations): void
}>()

const calendarViewMode = computed(() =>
  props.viewMode === 'week' ? ('week' as const) : ('day' as const),
)
</script>
