<template>
  <button
    :aria-label="ariaLabel"
    :class="[
      color.bg,
      color.text,
      color.border,
      'absolute inset-x-1 z-10 cursor-pointer overflow-hidden rounded-md border-l-[3px] px-2 py-0.5 text-left transition-opacity hover:opacity-80',
    ]"
    :style="{ top: `${top}px`, height: `${height}px` }"
    @click.stop="emit('click', appointment)"
  >
    <p class="truncate text-xs leading-tight font-semibold">
      {{ appointment.patient?.full_name ?? 'Unknown' }}
    </p>
    <p v-if="!compact && height > 36" class="truncate text-[10px] opacity-70">
      {{ formatTime(appointment.start_time) }} – {{ formatTime(appointment.end_time) }}
    </p>
    <p
      v-if="!compact && height > 52 && appointment.therapist"
      class="truncate text-[10px] opacity-60"
    >
      {{ appointment.therapist.full_name }}
    </p>
  </button>
</template>

<script setup lang="ts">
import type { CalendarAppointment, TherapistColor } from '~/composables/useCalendar'
import { formatTime } from '~/lib/formatters'

const props = defineProps<{
  appointment: CalendarAppointment
  top: number
  height: number
  color: TherapistColor
  compact?: boolean
}>()

const emit = defineEmits<{
  click: [appointment: CalendarAppointment]
}>()

const ariaLabel = computed(() => {
  const name = props.appointment.patient?.full_name ?? 'Unknown'
  const time = formatTime(props.appointment.start_time)
  const therapist = props.appointment.therapist?.full_name
  return therapist ? `${name} with ${therapist} at ${time}` : `${name} at ${time}`
})
</script>
