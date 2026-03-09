import { watchDebounced } from '@vueuse/core'
import type { Ref } from 'vue'
import type { IAppointmentBlockingInterval } from '~/types/models/appointment.types'
import { appointmentService } from '~/services/appointment.service'
import {
  SLOT_STEP_MINUTES,
  MAX_APPOINTMENT_DURATION_MINUTES,
  START_HOUR,
  END_HOUR,
} from '~/features/appointments/constants'
import type { AppointmentTimeOption } from '~/features/appointments/types'

export function toTimeLabel(time: string): string {
  return new Date(`2000-01-01T${time}:00`).toLocaleTimeString('en-IN', {
    hour: '2-digit',
    minute: '2-digit',
    hour12: true,
  })
}

export function overlapsInterval(
  startIso: string,
  endIso: string,
  interval: IAppointmentBlockingInterval,
): boolean {
  return startIso < interval.end_time && endIso > interval.start_time
}

export function useBookingAvailability(
  therapistId: Ref<string>,
  date: Ref<string>,
  duration: Ref<string>,
  clinicId: Ref<string | undefined>,
) {
  const supabase = useSupabaseClient()

  const blockedIntervals = ref<IAppointmentBlockingInterval[]>([])
  const isLoadingAvailability = ref(false)

  const isDoctorSelected = computed(() => Boolean(therapistId.value))

  const timeOptions = computed<AppointmentTimeOption[]>(() => {
    const options: AppointmentTimeOption[] = []
    const durationMin = Number.parseInt(duration.value, 10)
    const hasValidDuration =
      Number.isFinite(durationMin) &&
      durationMin > 0 &&
      durationMin <= MAX_APPOINTMENT_DURATION_MINUTES

    for (let hour = START_HOUR; hour < END_HOUR; hour++) {
      for (let minute = 0; minute < 60; minute += SLOT_STEP_MINUTES) {
        const value = `${String(hour).padStart(2, '0')}:${String(minute).padStart(2, '0')}`
        const option: AppointmentTimeOption = {
          value,
          label: toTimeLabel(value),
          disabled: false,
        }

        if (!isDoctorSelected.value) {
          option.disabled = true
          option.disabledReason = 'Select doctor first'
        } else if (!date.value) {
          option.disabled = true
          option.disabledReason = 'Select date first'
        } else if (!hasValidDuration) {
          option.disabled = true
          option.disabledReason = 'Select a valid duration'
        } else {
          const startDateTime = `${date.value}T${value}:00`
          const start = new Date(startDateTime)
          const end = new Date(startDateTime)
          end.setMinutes(end.getMinutes() + durationMin)
          const startIso = start.toISOString()
          const endIso = end.toISOString()

          const hasConflict = blockedIntervals.value.some((interval) =>
            overlapsInterval(startIso, endIso, interval),
          )
          if (hasConflict) {
            option.disabled = true
            option.disabledReason = 'Already booked'
          }
        }

        options.push(option)
      }
    }

    return options
  })

  watchDebounced(
    [therapistId, date],
    async () => {
      if (!clinicId.value || !therapistId.value || !date.value) {
        blockedIntervals.value = []
        return
      }

      isLoadingAvailability.value = true
      try {
        blockedIntervals.value = await appointmentService(supabase).listDoctorBlockedIntervals(
          clinicId.value,
          therapistId.value,
          date.value,
        )
      } catch {
        blockedIntervals.value = []
      } finally {
        isLoadingAvailability.value = false
      }
    },
    { debounce: 200 },
  )

  return {
    blockedIntervals,
    isLoadingAvailability,
    isDoctorSelected,
    timeOptions,
  }
}
