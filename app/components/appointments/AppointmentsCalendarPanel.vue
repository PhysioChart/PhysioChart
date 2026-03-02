<template>
  <Card v-if="viewMode === 'day'">
    <CardContent class="p-0">
      <CalendarDayView
        :appointments="appointments"
        :date-str="currentDayDateStr"
        :color-map="colorMap"
        @click-slot="(date, time) => emit('click-slot', date, time)"
        @click-appointment="emit('click-appointment', $event)"
      />
    </CardContent>
  </Card>

  <Card v-else-if="viewMode === 'week'">
    <CardContent class="p-0">
      <CalendarWeekView
        :appointments="appointments"
        :week-days="weekDays"
        :color-map="colorMap"
        @click-slot="(date, time) => emit('click-slot', date, time)"
        @click-appointment="emit('click-appointment', $event)"
      />
    </CardContent>
  </Card>
</template>

<script setup lang="ts">
import type { TherapistColor, CalendarDay } from '~/composables/useCalendar'
import type { AppointmentsViewMode } from '~/features/appointments/types'
import type { IAppointmentWithRelations } from '~/types/models/appointment.types'

defineProps<{
  viewMode: AppointmentsViewMode
  appointments: IAppointmentWithRelations[]
  weekDays: CalendarDay[]
  currentDayDateStr: string
  colorMap: Map<string, TherapistColor>
}>()

const emit = defineEmits<{
  (e: 'click-slot', date: string, time: string): void
  (e: 'click-appointment', appointment: IAppointmentWithRelations): void
}>()
</script>
