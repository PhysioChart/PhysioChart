<template>
  <div class="schedule-x-calendar">
    <ScheduleXCalendar :calendar-app="calendarApp">
      <template #headerContent><span /></template>
      <template #timeGridEvent="{ calendarEvent }">
        <div
          class="h-full cursor-pointer rounded-sm border-l-[3px] px-1.5 py-0.5"
          :style="getEventStyle(calendarEvent)"
        >
          <p class="truncate text-xs leading-tight font-semibold">
            {{ calendarEvent._appointment?.patient?.full_name ?? 'Unknown' }}
          </p>
          <p class="truncate text-[10px] opacity-70">
            {{ formatTime(calendarEvent._appointment?.start_time) }} –
            {{ formatTime(calendarEvent._appointment?.end_time) }}
          </p>
          <p v-if="calendarEvent._appointment?.therapist" class="truncate text-[10px] opacity-60">
            {{ calendarEvent._appointment.therapist.full_name }}
          </p>
        </div>
      </template>
    </ScheduleXCalendar>
  </div>
</template>

<script setup lang="ts">
import 'temporal-polyfill/global'
import '@schedule-x/theme-shadcn/dist/index.css'
import { Temporal } from 'temporal-polyfill'
import { ScheduleXCalendar } from '@schedule-x/vue'
import { createCalendar, viewDay, viewWeek, type CalendarEventExternal } from '@schedule-x/calendar'
import { createEventsServicePlugin } from '@schedule-x/events-service'
import { createCalendarControlsPlugin } from '@schedule-x/calendar-controls'
import { createCurrentTimePlugin } from '@schedule-x/current-time'
import { createScrollControllerPlugin } from '@schedule-x/scroll-controller'
import { formatTime } from '~/lib/formatters'
import type { IAppointmentWithRelations } from '~/types/models/appointment.types'

const TIMEZONE = 'Asia/Kolkata'

const CALENDAR_COLORS = [
  // blue (matches THERAPIST_COLORS[0])
  {
    light: { main: '#3b82f6', container: '#dbeafe', onContainer: '#1e40af' },
    dark: { main: '#60a5fa', container: '#1e3a5f', onContainer: '#bfdbfe' },
  },
  // emerald (matches THERAPIST_COLORS[1])
  {
    light: { main: '#10b981', container: '#d1fae5', onContainer: '#065f46' },
    dark: { main: '#34d399', container: '#064e3b', onContainer: '#6ee7b7' },
  },
  // violet (matches THERAPIST_COLORS[2])
  {
    light: { main: '#8b5cf6', container: '#ede9fe', onContainer: '#5b21b6' },
    dark: { main: '#a78bfa', container: '#4c1d95', onContainer: '#c4b5fd' },
  },
  // amber (matches THERAPIST_COLORS[3])
  {
    light: { main: '#f59e0b', container: '#fef3c7', onContainer: '#92400e' },
    dark: { main: '#fbbf24', container: '#78350f', onContainer: '#fde68a' },
  },
  // rose (matches THERAPIST_COLORS[4])
  {
    light: { main: '#f43f5e', container: '#ffe4e6', onContainer: '#9f1239' },
    dark: { main: '#fb7185', container: '#881337', onContainer: '#fda4af' },
  },
  // cyan (matches THERAPIST_COLORS[5])
  {
    light: { main: '#06b6d4', container: '#cffafe', onContainer: '#155e75' },
    dark: { main: '#22d3ee', container: '#164e63', onContainer: '#67e8f9' },
  },
  // orange (matches THERAPIST_COLORS[6])
  {
    light: { main: '#f97316', container: '#ffedd5', onContainer: '#9a3412' },
    dark: { main: '#fb923c', container: '#7c2d12', onContainer: '#fdba74' },
  },
  // pink (matches THERAPIST_COLORS[7])
  {
    light: { main: '#ec4899', container: '#fce7f3', onContainer: '#9d174d' },
    dark: { main: '#f472b6', container: '#831843', onContainer: '#f9a8d4' },
  },
] as const

const props = defineProps<{
  appointments: IAppointmentWithRelations[]
  viewMode: 'day' | 'week'
  selectedDate: string
  therapists: Array<{ id: string }>
}>()

const emit = defineEmits<{
  (e: 'click-slot', date: string, time: string): void
  (e: 'click-appointment', appointment: IAppointmentWithRelations): void
}>()

function buildCalendarsConfig() {
  const calendars: Record<
    string,
    {
      colorName: string
      lightColors: { main: string; container: string; onContainer: string }
      darkColors: { main: string; container: string; onContainer: string }
    }
  > = {}
  CALENDAR_COLORS.forEach((color, i) => {
    calendars[`therapist-${i}`] = {
      colorName: `therapist-${i}`,
      lightColors: { ...color.light },
      darkColors: { ...color.dark },
    }
  })
  calendars['unassigned'] = {
    colorName: 'unassigned',
    lightColors: { main: '#71717a', container: '#f4f4f5', onContainer: '#3f3f46' },
    darkColors: { main: '#a1a1aa', container: '#27272a', onContainer: '#d4d4d8' },
  }
  return calendars
}

function buildTherapistCalendarIdMap(therapists: Array<{ id: string }>): Map<string, string> {
  const sorted = [...therapists].sort((a, b) => a.id.localeCompare(b.id))
  const map = new Map<string, string>()
  sorted.forEach((t, i) => {
    map.set(t.id, `therapist-${i % CALENDAR_COLORS.length}`)
  })
  return map
}

const calendarIdMap = computed(() => buildTherapistCalendarIdMap(props.therapists))

function toScheduleXEvents(
  appointments: IAppointmentWithRelations[],
  idMap: Map<string, string>,
): CalendarEventExternal[] {
  return appointments.map((appt) => ({
    id: appt.id,
    title: appt.patient?.full_name ?? 'Unknown',
    start: Temporal.Instant.from(appt.start_time).toZonedDateTimeISO(TIMEZONE),
    end: Temporal.Instant.from(appt.end_time).toZonedDateTimeISO(TIMEZONE),
    calendarId: appt.therapist_id ? (idMap.get(appt.therapist_id) ?? 'unassigned') : 'unassigned',
    _appointment: appt,
  }))
}

function getEventStyle(calendarEvent: CalendarEventExternal) {
  const calId = calendarEvent.calendarId ?? 'unassigned'
  return {
    backgroundColor: `var(--sx-color-${calId}-container)`,
    color: `var(--sx-color-on-${calId}-container)`,
    borderLeftColor: `var(--sx-color-${calId})`,
  }
}

const eventsService = createEventsServicePlugin()
const calendarControls = createCalendarControlsPlugin()

const calendarApp = createCalendar({
  views: [viewDay, viewWeek],
  defaultView: props.viewMode === 'day' ? viewDay.name : viewWeek.name,
  selectedDate: Temporal.PlainDate.from(props.selectedDate),
  locale: 'en-IN',
  timezone: TIMEZONE,
  theme: 'shadcn',
  isDark: document.documentElement.classList.contains('dark'),
  dayBoundaries: { start: '08:00', end: '20:00' },
  weekOptions: {
    gridHeight: 1200,
    nDays: 7,
    eventWidth: 95,
    gridStep: 60,
  },
  calendars: buildCalendarsConfig(),
  events: toScheduleXEvents(props.appointments, calendarIdMap.value),
  callbacks: {
    onEventClick(calendarEvent: CalendarEventExternal) {
      const appointment = calendarEvent._appointment as IAppointmentWithRelations | undefined
      if (appointment) {
        emit('click-appointment', appointment)
      }
    },
    onClickDateTime(dateTime: Temporal.ZonedDateTime) {
      const date = dateTime.toPlainDate().toString()
      const hour = String(dateTime.hour).padStart(2, '0')
      const minute = String(dateTime.minute).padStart(2, '0')
      emit('click-slot', date, `${hour}:${minute}`)
    },
  },
  plugins: [
    eventsService,
    calendarControls,
    createCurrentTimePlugin({ fullWeekWidth: false }),
    createScrollControllerPlugin({ initialScroll: '08:00' }),
  ],
})

// Sync dark mode with Schedule-X using its public API
let darkModeObserver: MutationObserver | null = null

function syncDarkMode() {
  const isDark = document.documentElement.classList.contains('dark')
  calendarApp.setTheme(isDark ? 'dark' : 'light')
}

onMounted(() => {
  syncDarkMode()
  darkModeObserver = new MutationObserver(syncDarkMode)
  darkModeObserver.observe(document.documentElement, {
    attributes: true,
    attributeFilter: ['class'],
  })
})

onBeforeUnmount(() => {
  darkModeObserver?.disconnect()
})

watch(
  () => props.appointments,
  (newAppts) => {
    eventsService.set(toScheduleXEvents(newAppts, calendarIdMap.value))
  },
)

watch(
  () => props.therapists,
  () => {
    eventsService.set(toScheduleXEvents(props.appointments, calendarIdMap.value))
  },
)

watch(
  () => props.selectedDate,
  (date) => {
    calendarControls.setDate(Temporal.PlainDate.from(date))
  },
)

watch(
  () => props.viewMode,
  (mode) => {
    calendarControls.setView(mode === 'day' ? viewDay.name : viewWeek.name)
  },
)
</script>

<style scoped>
.schedule-x-calendar {
  height: calc(100vh - 280px);
  min-height: 500px;

  /* Keep the sticky header below dialog/sheet overlays (shadcn uses z-index 50) */
  --sx-z-index-week-header: 10;

  /* Map Schedule-X design tokens to the app's shadcn CSS variables */
  --sx-color-primary: var(--primary);
  --sx-color-surface: var(--card);
  --sx-color-on-surface: var(--card-foreground);
  --sx-color-surface-dim: var(--muted);
  --sx-color-surface-container: var(--background);
}

/* Hide the built-in header (we use our own navigation) */
.schedule-x-calendar :deep(.sx__calendar-header) {
  display: none;
}

/* Remove the default border Schedule-X adds on overlapping events */
.schedule-x-calendar :deep(.sx__time-grid-event) {
  border: none !important;
}

/* Ensure the full height chain flows down to Schedule-X's scroll container */
.schedule-x-calendar :deep(.sx-vue-calendar-wrapper),
.schedule-x-calendar :deep(.sx__calendar-wrapper),
.schedule-x-calendar :deep(.sx__calendar),
.schedule-x-calendar :deep(.sx__view-container) {
  height: 100%;
}
</style>
