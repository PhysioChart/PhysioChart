<template>
  <Card class="gap-0 overflow-hidden py-0">
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

      <!-- Grouped by date (for "all" filter) -->
      <div v-else-if="listFilter === 'all'" class="divide-y">
        <div v-for="group in groupedByDate" :key="group.dateKey">
          <div class="bg-muted text-muted-foreground sticky top-0 px-4 py-1.5 text-xs font-medium">
            {{ group.label }}
          </div>
          <div class="divide-y">
            <AppointmentsListRow
              v-for="appt in group.appointments"
              :key="appt.id"
              :appointment="appt"
              :clinic-name="clinicName"
              :series-total="appt.series_id ? getSeriesTotal(appt.series_id) : 0"
              :can-reopen="canReopenAppointment(appt)"
              @request-complete="emit('request-complete', $event)"
              @request-reopen="emit('request-reopen', $event)"
              @update-status="handleUpdateStatus"
              @cancel-series="emit('cancel-series', $event)"
            />
          </div>
        </div>
      </div>

      <!-- Flat list (for "today" filter) -->
      <div v-else class="divide-y">
        <AppointmentsListRow
          v-for="appt in appointments"
          :key="appt.id"
          :appointment="appt"
          :clinic-name="clinicName"
          :series-total="appt.series_id ? getSeriesTotal(appt.series_id) : 0"
          :can-reopen="canReopenAppointment(appt)"
          @request-complete="emit('request-complete', $event)"
          @request-reopen="emit('request-reopen', $event)"
          @update-status="handleUpdateStatus"
          @cancel-series="emit('cancel-series', $event)"
        />
      </div>
    </CardContent>
  </Card>
</template>

<script setup lang="ts">
import { CalendarDays } from 'lucide-vue-next'
import AppointmentsListRow from '~/features/appointments/components/AppointmentsListRow.vue'
import type { AppointmentsListFilter } from '~/features/appointments/types'
import type { AppointmentStatus } from '~/enums/appointment.enum'
import type { IAppointmentWithRelations } from '~/types/models/appointment.types'
import { toLocalDateKey } from '~/lib/date'
import { formatDate } from '~/lib/formatters'

const props = defineProps<{
  appointments: IAppointmentWithRelations[]
  listFilter: AppointmentsListFilter
  clinicName: string | null
  getSeriesTotal: (seriesId: string) => number
  canReopenAppointment: (appointment: IAppointmentWithRelations) => boolean
}>()

const emit = defineEmits<{
  (e: 'open-booking'): void
  (e: 'request-complete', appointment: IAppointmentWithRelations): void
  (e: 'request-reopen' | 'cancel-series', id: string): void
  (e: 'update-status', id: string, status: AppointmentStatus): void
}>()

interface DateGroup {
  dateKey: string
  label: string
  appointments: IAppointmentWithRelations[]
}

const groupedByDate = computed(() => {
  const groups: DateGroup[] = []
  let currentKey = ''
  for (const appt of props.appointments) {
    const key = toLocalDateKey(appt.start_time)
    if (key !== currentKey) {
      currentKey = key
      groups.push({ dateKey: key, label: formatDate(appt.start_time), appointments: [appt] })
    } else {
      groups[groups.length - 1]!.appointments.push(appt)
    }
  }
  return groups
})

function handleUpdateStatus(id: string, status: AppointmentStatus) {
  emit('update-status', id, status)
}
</script>
