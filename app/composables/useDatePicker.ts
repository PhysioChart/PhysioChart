import type { DateValue } from 'reka-ui'
import { CalendarDate } from '@internationalized/date'

/**
 * Bidirectional adapter between a YYYY-MM-DD string ref and a CalendarDate
 * for use with shadcn-vue Calendar / DatePicker components.
 */
export function useDatePicker(dateString: Ref<string>) {
  const calendarValue = computed<DateValue | undefined>({
    get() {
      if (!dateString.value) return undefined
      const [year, month, day] = dateString.value.split('-').map(Number) as [number, number, number]
      return new CalendarDate(year, month, day)
    },
    set(val: DateValue | undefined) {
      if (val) {
        const y = String(val.year).padStart(4, '0')
        const m = String(val.month).padStart(2, '0')
        const d = String(val.day).padStart(2, '0')
        dateString.value = `${y}-${m}-${d}`
      } else {
        dateString.value = ''
      }
    },
  })

  const formatted = computed(() => {
    if (!dateString.value) return ''
    return new Date(dateString.value + 'T00:00:00').toLocaleDateString('en-IN', {
      weekday: 'short',
      day: 'numeric',
      month: 'short',
      year: 'numeric',
    })
  })

  const isOpen = ref(false)

  function close() {
    isOpen.value = false
  }

  return {
    calendarValue,
    formatted,
    isOpen,
    close,
  }
}

export function todayCalendarDate(): CalendarDate {
  const now = new Date()
  return new CalendarDate(now.getFullYear(), now.getMonth() + 1, now.getDate())
}
