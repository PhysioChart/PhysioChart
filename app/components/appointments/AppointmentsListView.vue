<template>
  <Card>
    <CardContent class="p-0">
      <div
        v-if="appointments.length === 0"
        class="flex flex-col items-center justify-center py-12 text-center"
      >
        <CalendarDays class="text-muted-foreground/50 mb-3 h-10 w-10" />
        <p class="text-muted-foreground text-sm">
          {{ listFilter === 'today' ? 'No appointments today' : 'No appointments yet' }}
        </p>
        <Button variant="outline" class="mt-3" @click="emit('open-booking')"
          >Book an appointment</Button
        >
      </div>

      <div v-else class="divide-y">
        <AppointmentsListRow
          v-for="appt in appointments"
          :key="appt.id"
          :appointment="appt"
          :series-total="appt.series_id ? getSeriesTotal(appt.series_id) : 0"
          @update-status="(id, status) => emit('update-status', id, status)"
          @cancel-series="emit('cancel-series', $event)"
        />
      </div>
    </CardContent>
  </Card>
</template>

<script setup lang="ts">
import { CalendarDays } from 'lucide-vue-next'
import type { AppointmentsListFilter } from '~/features/appointments/types'
import type { AppointmentStatus } from '~/enums/appointment.enum'
import type { IAppointmentWithRelations } from '~/types/models/appointment.types'

defineProps<{
  appointments: IAppointmentWithRelations[]
  listFilter: AppointmentsListFilter
  getSeriesTotal: (seriesId: string) => number
}>()

const emit = defineEmits<{
  (e: 'open-booking'): void
  (e: 'update-status', id: string, status: AppointmentStatus): void
  (e: 'cancel-series', seriesId: string): void
}>()
</script>
