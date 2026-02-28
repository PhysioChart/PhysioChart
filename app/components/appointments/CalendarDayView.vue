<template>
  <div class="flex overflow-y-auto" style="max-height: calc(100vh - 280px)">
    <!-- Time gutter -->
    <div class="bg-background sticky left-0 z-20 w-16 flex-shrink-0 border-r">
      <div
        v-for="slot in timeSlots"
        :key="`${slot.hour}-${slot.minute}`"
        class="text-muted-foreground flex items-start justify-end pr-2 text-[11px]"
        :style="{ height: `${SLOT_HEIGHT_PX}px` }"
      >
        <span v-if="slot.minute === 0" class="-mt-2">{{ slot.label }}</span>
      </div>
    </div>

    <!-- Grid area -->
    <div class="relative flex-1">
      <!-- Slot rows -->
      <div
        v-for="slot in timeSlots"
        :key="`row-${slot.hour}-${slot.minute}`"
        role="button"
        tabindex="0"
        :aria-label="slotLabel(slot)"
        :class="[
          'hover:bg-muted/50 cursor-pointer border-b transition-colors',
          slot.minute === 0 ? 'border-border' : 'border-border/30',
        ]"
        :style="{ height: `${SLOT_HEIGHT_PX}px` }"
        @click="handleSlotClick(slot.hour, slot.minute)"
        @keydown.enter="handleSlotClick(slot.hour, slot.minute)"
      />

      <!-- Current time indicator -->
      <div
        v-if="dateStr === todayStr"
        class="pointer-events-none absolute right-0 left-0 z-30 border-t-2 border-red-500"
        :style="{ top: `${getCurrentTimeTop()}px` }"
      >
        <div class="absolute -top-1.5 -left-1.5 h-3 w-3 rounded-full bg-red-500" />
      </div>

      <!-- Appointment blocks -->
      <CalendarAppointmentBlock
        v-for="{ appt, position, color } in positionedAppointments"
        :key="appt.id"
        :appointment="appt"
        :top="position.top"
        :height="position.height"
        :color="color"
        @click="emit('clickAppointment', $event)"
      />
    </div>
  </div>
</template>

<script setup lang="ts">
import type { CalendarAppointment, TherapistColor } from '~/composables/useCalendar'
import { toLocalDateKey } from '~/lib/date'

const props = defineProps<{
  appointments: CalendarAppointment[]
  dateStr: string
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

const dayAppointments = computed(() => appointmentsForDate(props.appointments, props.dateStr))

const positionedAppointments = computed(() =>
  dayAppointments.value.map((appt) => ({
    appt,
    position: getAppointmentPosition(appt.start_time, appt.end_time),
    color: getTherapistColor(appt.therapist_id, props.colorMap),
  })),
)

const todayStr = toLocalDateKey(new Date())

function handleSlotClick(hour: number, minute: number) {
  emit('clickSlot', props.dateStr, timeFromSlot(hour, minute))
}

function slotLabel(slot: { hour: number; minute: number; label: string }) {
  return `Book appointment at ${slot.label}`
}
</script>
