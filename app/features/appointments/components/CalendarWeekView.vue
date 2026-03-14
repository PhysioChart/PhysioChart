<template>
  <div>
    <!-- Week header -->
    <div class="flex border-b">
      <div class="w-14 flex-shrink-0 border-r sm:w-16" />
      <div
        v-for="day in weekDays"
        :key="day.dateStr"
        :class="[
          'flex flex-1 flex-col items-center justify-center py-2 text-sm',
          day.isToday ? 'font-bold' : 'text-muted-foreground',
        ]"
      >
        <span class="text-xs uppercase">{{ day.dayLabel }}</span>
        <span
          :class="[
            'flex h-7 w-7 items-center justify-center rounded-full text-sm',
            day.isToday ? 'bg-primary text-primary-foreground' : '',
          ]"
        >
          {{ day.dayNumber }}
        </span>
      </div>
    </div>

    <!-- Scrollable grid -->
    <div ref="scrollContainer" class="flex overflow-y-auto" style="max-height: calc(100vh - 280px)">
      <!-- Time gutter -->
      <div class="bg-card border-border sticky left-0 z-20 w-14 flex-shrink-0 border-r sm:w-16">
        <div
          v-for="slot in timeSlots"
          :key="`${slot.hour}-${slot.minute}`"
          class="text-muted-foreground flex items-start justify-end pr-2 text-[11px]"
          :style="{ height: `${SLOT_HEIGHT_PX}px` }"
        >
          <span v-if="slot.minute === 0" class="-mt-2">{{ slot.label }}</span>
        </div>
      </div>

      <!-- Day columns -->
      <div
        v-for="day in weekDays"
        :key="day.dateStr"
        class="border-border/50 relative flex-1 border-r last:border-r-0"
      >
        <!-- Slot rows -->
        <div
          v-for="slot in timeSlots"
          :key="`${day.dateStr}-${slot.hour}-${slot.minute}`"
          role="button"
          tabindex="0"
          :aria-label="slotLabel(day, slot)"
          :class="[
            'hover:bg-muted/50 cursor-pointer border-b transition-colors',
            slot.minute === 0 ? 'border-border/70' : 'border-border/40',
          ]"
          :style="{ height: `${SLOT_HEIGHT_PX}px` }"
          @click="emit('clickSlot', day.dateStr, timeFromSlot(slot.hour, slot.minute))"
          @keydown.enter="emit('clickSlot', day.dateStr, timeFromSlot(slot.hour, slot.minute))"
        />

        <!-- Appointment blocks -->
        <CalendarAppointmentBlock
          v-for="{ appt, position, color } in positionedAppointments(day.dateStr)"
          :key="appt.id"
          :appointment="appt"
          :top="position.top"
          :height="position.height"
          :color="color"
          :compact="true"
          @click="emit('clickAppointment', $event)"
        />

        <!-- Current time indicator (today's column only) -->
        <div
          v-if="day.isToday"
          class="pointer-events-none absolute right-0 left-0 z-30 border-t-2 border-red-500"
          :style="{ top: `${getCurrentTimeTop()}px` }"
        >
          <div class="absolute -top-1.5 -left-1.5 h-3 w-3 rounded-full bg-red-500" />
        </div>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { nextTick, onMounted, ref } from 'vue'
import CalendarAppointmentBlock from '~/features/appointments/components/CalendarAppointmentBlock.vue'
import type { CalendarAppointment, CalendarDay, TherapistColor } from '~/composables/useCalendar'

const props = defineProps<{
  appointments: CalendarAppointment[]
  weekDays: CalendarDay[]
  colorMap: Map<string, TherapistColor>
}>()

const emit = defineEmits<{
  clickSlot: [date: string, time: string]
  clickAppointment: [appointment: CalendarAppointment]
}>()

const {
  timeSlots,
  getTherapistColor,
  getAppointmentPosition,
  appointmentsForDate,
  timeFromSlot,
  getCurrentTimeTop,
  SLOT_HEIGHT_PX,
} = useCalendar()

const scrollContainer = ref<HTMLElement | null>(null)

onMounted(() => {
  nextTick(() => {
    if (!scrollContainer.value) return
    scrollContainer.value.scrollTop = Math.max(0, getCurrentTimeTop() - 60)
  })
})

function positionedAppointments(dateStr: string) {
  return appointmentsForDate(props.appointments, dateStr).map((appt) => ({
    appt,
    position: getAppointmentPosition(appt.start_time, appt.end_time),
    color: getTherapistColor(appt.therapist_id, props.colorMap),
  }))
}

function slotLabel(day: CalendarDay, slot: { label: string }) {
  return `Book appointment on ${day.dayLabel} at ${slot.label}`
}
</script>
