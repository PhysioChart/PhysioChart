import { watchDebounced } from '@vueuse/core'
import type { Ref } from 'vue'
import { appointmentService } from '~/services/appointment.service'
import { overlapsInterval } from '~/features/appointments/composables/useBookingAvailability'
import { MAX_APPOINTMENT_DURATION_MINUTES } from '~/features/appointments/constants'

export function useSeriesConflicts(
  seriesDates: Ref<string[]>,
  therapistId: Ref<string>,
  startTime: Ref<string>,
  duration: Ref<string>,
  clinicId: Ref<string | undefined>,
) {
  const supabase = useSupabaseClient()

  const conflicts = ref<Set<string>>(new Set())

  watchDebounced(
    [seriesDates, therapistId, startTime, duration],
    async () => {
      if (seriesDates.value.length === 0 || !therapistId.value || !clinicId.value) {
        conflicts.value = new Set()
        return
      }

      const durationMin = Number.parseInt(duration.value, 10)
      if (
        !Number.isFinite(durationMin) ||
        durationMin <= 0 ||
        durationMin > MAX_APPOINTMENT_DURATION_MINUTES
      ) {
        conflicts.value = new Set()
        return
      }

      const firstDate = seriesDates.value[0]!
      const lastDate = seriesDates.value[seriesDates.value.length - 1]!
      try {
        const data = await appointmentService(supabase).findConflicts(
          clinicId.value,
          therapistId.value,
          firstDate,
          lastDate,
        )

        const existing = new Set<string>()
        for (const dateStr of seriesDates.value) {
          const startDateTime = `${dateStr}T${startTime.value}:00`
          const start = new Date(startDateTime).toISOString()
          const endDate = new Date(startDateTime)
          endDate.setMinutes(endDate.getMinutes() + durationMin)
          const end = endDate.toISOString()

          const hasConflict = data.some((interval) => overlapsInterval(start, end, interval))
          if (hasConflict) existing.add(dateStr)
        }

        conflicts.value = existing
      } catch {
        conflicts.value = new Set()
      }
    },
    { debounce: 250 },
  )

  return { conflicts }
}
