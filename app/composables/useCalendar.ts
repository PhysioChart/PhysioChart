import type { Tables } from '~/types/database'
import type { IAppointmentWithRelations } from '~/types/models/appointment.types'

export type CalendarAppointment = IAppointmentWithRelations

const THERAPIST_COLORS = [
  { bg: 'bg-blue-500/15', border: 'border-l-blue-500', text: 'text-blue-700 dark:text-blue-300' },
  {
    bg: 'bg-emerald-500/15',
    border: 'border-l-emerald-500',
    text: 'text-emerald-700 dark:text-emerald-300',
  },
  {
    bg: 'bg-violet-500/15',
    border: 'border-l-violet-500',
    text: 'text-violet-700 dark:text-violet-300',
  },
  {
    bg: 'bg-amber-500/15',
    border: 'border-l-amber-500',
    text: 'text-amber-700 dark:text-amber-300',
  },
  { bg: 'bg-rose-500/15', border: 'border-l-rose-500', text: 'text-rose-700 dark:text-rose-300' },
  { bg: 'bg-cyan-500/15', border: 'border-l-cyan-500', text: 'text-cyan-700 dark:text-cyan-300' },
  {
    bg: 'bg-orange-500/15',
    border: 'border-l-orange-500',
    text: 'text-orange-700 dark:text-orange-300',
  },
  { bg: 'bg-pink-500/15', border: 'border-l-pink-500', text: 'text-pink-700 dark:text-pink-300' },
] as const

const UNASSIGNED_COLOR = {
  bg: 'bg-zinc-500/15',
  border: 'border-l-zinc-400',
  text: 'text-muted-foreground',
}

export type TherapistColor = (typeof THERAPIST_COLORS)[number] | typeof UNASSIGNED_COLOR

export interface TimeSlot {
  hour: number
  minute: number
  label: string
}

export interface CalendarDay {
  date: Date
  dateStr: string
  isToday: boolean
  dayLabel: string
  dayNumber: number
}

export function useCalendar() {
  const DAY_START_HOUR = 8
  const DAY_END_HOUR = 20
  const SLOT_MINUTES = 30
  const SLOT_HEIGHT_PX = 48

  const selectedDate = ref(new Date())

  const timeSlots = computed<TimeSlot[]>(() => {
    const slots: TimeSlot[] = []
    for (let h = DAY_START_HOUR; h < DAY_END_HOUR; h++) {
      for (let m = 0; m < 60; m += SLOT_MINUTES) {
        const d = new Date(2000, 0, 1, h, m)
        slots.push({
          hour: h,
          minute: m,
          label: d.toLocaleTimeString('en-IN', {
            hour: 'numeric',
            minute: '2-digit',
            hour12: true,
          }),
        })
      }
    }
    return slots
  })

  function goToToday() {
    selectedDate.value = new Date()
  }
  function goToPrevDay() {
    const d = new Date(selectedDate.value)
    d.setDate(d.getDate() - 1)
    selectedDate.value = d
  }
  function goToNextDay() {
    const d = new Date(selectedDate.value)
    d.setDate(d.getDate() + 1)
    selectedDate.value = d
  }
  function goToPrevWeek() {
    const d = new Date(selectedDate.value)
    d.setDate(d.getDate() - 7)
    selectedDate.value = d
  }
  function goToNextWeek() {
    const d = new Date(selectedDate.value)
    d.setDate(d.getDate() + 7)
    selectedDate.value = d
  }

  const weekDays = computed<CalendarDay[]>(() => {
    const d = new Date(selectedDate.value)
    const dayOfWeek = d.getDay()
    const monday = new Date(d)
    monday.setDate(d.getDate() - ((dayOfWeek + 6) % 7))

    const todayStr = new Date().toLocaleDateString('en-CA')
    const days: CalendarDay[] = []
    for (let i = 0; i < 7; i++) {
      const day = new Date(monday)
      day.setDate(monday.getDate() + i)
      const dateStr = day.toLocaleDateString('en-CA')
      days.push({
        date: day,
        dateStr,
        isToday: dateStr === todayStr,
        dayLabel: day.toLocaleDateString('en-IN', { weekday: 'short' }),
        dayNumber: day.getDate(),
      })
    }
    return days
  })

  const currentDay = computed<CalendarDay>(() => {
    const d = selectedDate.value
    const dateStr = d.toLocaleDateString('en-CA')
    const todayStr = new Date().toLocaleDateString('en-CA')
    return {
      date: d,
      dateStr,
      isToday: dateStr === todayStr,
      dayLabel: d.toLocaleDateString('en-IN', { weekday: 'long' }),
      dayNumber: d.getDate(),
    }
  })

  const dayViewLabel = computed(() =>
    selectedDate.value.toLocaleDateString('en-IN', {
      weekday: 'long',
      day: 'numeric',
      month: 'short',
      year: 'numeric',
    }),
  )

  const weekViewLabel = computed(() => {
    const days = weekDays.value
    const start = days[0]!.date
    const end = days[6]!.date
    const fmt = (d: Date) => d.toLocaleDateString('en-IN', { day: 'numeric', month: 'short' })
    return `${fmt(start)} – ${fmt(end)} ${end.getFullYear()}`
  })

  function buildTherapistColorMap(therapists: Tables<'profiles'>[]): Map<string, TherapistColor> {
    const sorted = [...therapists].sort((a, b) => a.id.localeCompare(b.id))
    const map = new Map<string, TherapistColor>()
    sorted.forEach((t, i) => {
      map.set(t.id, THERAPIST_COLORS[i % THERAPIST_COLORS.length]!)
    })
    return map
  }

  function getTherapistColor(
    therapistId: string | null,
    colorMap: Map<string, TherapistColor>,
  ): TherapistColor {
    if (!therapistId) return UNASSIGNED_COLOR
    return colorMap.get(therapistId) ?? UNASSIGNED_COLOR
  }

  const totalGridMinutes = (DAY_END_HOUR - DAY_START_HOUR) * 60
  const pxPerMinute = SLOT_HEIGHT_PX / SLOT_MINUTES

  function getAppointmentPosition(startTime: string, endTime: string) {
    const start = new Date(startTime)
    const end = new Date(endTime)

    const startMinutes = (start.getHours() - DAY_START_HOUR) * 60 + start.getMinutes()
    const endMinutes = (end.getHours() - DAY_START_HOUR) * 60 + end.getMinutes()

    // Clamp to grid bounds
    const clampedStart = Math.max(0, Math.min(totalGridMinutes, startMinutes))
    const clampedEnd = Math.max(0, Math.min(totalGridMinutes, endMinutes))
    const duration = clampedEnd - clampedStart

    const top = clampedStart * pxPerMinute
    const height = Math.max(SLOT_HEIGHT_PX / 2, duration * pxPerMinute)

    return { top, height }
  }

  function appointmentsForDate(appointments: CalendarAppointment[], dateStr: string) {
    return appointments.filter((a) => {
      const localDate = new Date(a.start_time).toLocaleDateString('en-CA')
      return localDate === dateStr
    })
  }

  function timeFromSlot(hour: number, minute: number): string {
    return `${String(hour).padStart(2, '0')}:${String(minute).padStart(2, '0')}`
  }

  function getCurrentTimeTop(): number {
    const now = new Date()
    const minutes = (now.getHours() - DAY_START_HOUR) * 60 + now.getMinutes()
    if (minutes < 0) return 0
    return minutes * pxPerMinute
  }

  return {
    selectedDate,
    timeSlots,
    weekDays,
    currentDay,
    dayViewLabel,
    weekViewLabel,
    goToToday,
    goToPrevDay,
    goToNextDay,
    goToPrevWeek,
    goToNextWeek,
    buildTherapistColorMap,
    getTherapistColor,
    getAppointmentPosition,
    appointmentsForDate,
    timeFromSlot,
    getCurrentTimeTop,
    SLOT_HEIGHT_PX,
    DAY_START_HOUR,
    DAY_END_HOUR,
  }
}
