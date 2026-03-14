<template>
  <ResponsiveFormOverlay :open="open" @update:open="emit('update:open', $event)">
    <form class="flex min-h-0 flex-1 flex-col" @submit.prevent="handleSubmit">
      <DialogHeader
        class="bg-background shrink-0 border-b px-4 py-4 [padding-top:max(1rem,env(safe-area-inset-top))] text-left sm:px-6"
      >
        <DialogTitle>Book Appointment</DialogTitle>
        <DialogDescription>Schedule a new appointment for a patient.</DialogDescription>
      </DialogHeader>

      <div class="min-h-0 flex-1 overflow-y-auto overscroll-contain px-4 py-4 sm:px-6">
        <div class="space-y-4">
          <p v-if="linkedBookingContext" class="text-xs text-blue-600">
            Linked booking: {{ linkedBookingContext.treatmentName }} (patient and treatment are
            locked)
          </p>

          <div class="space-y-2">
            <Label>Booking Type</Label>
            <div class="flex gap-2">
              <Button
                type="button"
                size="sm"
                :variant="bookingMode === 'single' ? 'default' : 'outline'"
                @click="bookingMode = 'single'"
              >
                Single
              </Button>
              <Button
                type="button"
                size="sm"
                :variant="bookingMode === 'series' ? 'default' : 'outline'"
                @click="bookingMode = 'series'"
              >
                Series
              </Button>
            </div>
          </div>

          <div class="grid gap-4 sm:grid-cols-2">
            <div class="space-y-2">
              <Label>Patient *</Label>
              <Select v-model="form.patient_id" :disabled="lockPatientSelection">
                <SelectTrigger class="w-full">
                  <SelectValue placeholder="Select patient" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem v-for="p in patients" :key="p.id" :value="p.id">
                    {{ p.full_name }} ({{ formatPhoneDisplay(p.phone, phoneCountryCode) }})
                  </SelectItem>
                </SelectContent>
              </Select>
            </div>

            <div class="space-y-2">
              <Label>Doctor *</Label>
              <Select v-model="form.therapist_id">
                <SelectTrigger class="w-full">
                  <SelectValue placeholder="Select doctor" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem v-for="t in therapists" :key="t.id" :value="t.id">
                    {{ t.full_name }}
                  </SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>

          <div class="grid gap-4 sm:grid-cols-2">
            <div class="space-y-2">
              <Label>Treatment Plan (Optional)</Label>
              <Select
                v-model="form.treatment_plan_id"
                :disabled="!canSelectTreatment || lockTreatmentPlanSelection"
              >
                <SelectTrigger class="w-full">
                  <SelectValue :placeholder="treatmentSelectPlaceholder" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem :value="NO_TREATMENT_PLAN_VALUE">No linked plan</SelectItem>
                  <SelectItem v-for="plan in activeTreatmentPlans" :key="plan.id" :value="plan.id">
                    <span v-if="plan.total_sessions !== null">
                      {{ plan.name }} ({{ plan.derived_completed_sessions }}/{{
                        plan.total_sessions
                      }})
                    </span>
                    <span v-else
                      >{{ plan.name }} ({{ plan.derived_completed_sessions }} sessions)</span
                    >
                  </SelectItem>
                </SelectContent>
              </Select>
            </div>

            <div class="space-y-2">
              <Label>{{ bookingMode === 'series' ? 'Start Date *' : 'Date *' }}</Label>
              <Popover v-model:open="datePickerOpen" modal>
                <PopoverTrigger as-child>
                  <Button
                    type="button"
                    variant="outline"
                    :class="
                      cn(
                        'w-full justify-start text-left font-normal',
                        !form.date && 'text-muted-foreground',
                      )
                    "
                  >
                    <CalendarIcon class="mr-2 size-4" />
                    {{ formattedDate || 'Pick a date' }}
                  </Button>
                </PopoverTrigger>
                <PopoverContent class="w-auto p-0" align="start">
                  <Calendar v-model="calendarValue" />
                </PopoverContent>
              </Popover>
            </div>
          </div>

          <div class="grid gap-4 sm:grid-cols-2">
            <div class="space-y-2">
              <Label>Time *</Label>
              <Select v-model="form.start_time" :disabled="!isDoctorSelected">
                <SelectTrigger class="w-full">
                  <SelectValue placeholder="Select time" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem
                    v-for="option in timeOptions"
                    :key="option.value"
                    :value="option.value"
                    :disabled="option.disabled"
                  >
                    {{ option.label }}
                    <span v-if="option.disabledReason" class="text-muted-foreground ml-2 text-xs">
                      ({{ option.disabledReason }})
                    </span>
                  </SelectItem>
                </SelectContent>
              </Select>
              <p v-if="!isDoctorSelected" class="text-muted-foreground text-xs">
                Choose a doctor to view available time slots.
              </p>
            </div>
            <div class="space-y-2">
              <Label>Duration</Label>
              <Select v-model="form.duration">
                <SelectTrigger class="w-full">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="15">15 min</SelectItem>
                  <SelectItem value="30">30 min</SelectItem>
                  <SelectItem value="45">45 min</SelectItem>
                  <SelectItem value="60">1 hour</SelectItem>
                  <SelectItem value="90">1.5 hours</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>

          <template v-if="bookingMode === 'series'">
            <div class="space-y-2">
              <Label>Total Sessions *</Label>
              <NumberInput v-model="seriesConfig.totalSessions" :min="2" :max="60" />
            </div>

            <div class="space-y-2">
              <Label>Days of Week *</Label>
              <div class="flex flex-wrap gap-1.5">
                <Button
                  v-for="(dayName, dayIndex) in DAY_NAMES"
                  :key="dayIndex"
                  type="button"
                  size="sm"
                  :variant="seriesConfig.days.includes(dayIndex) ? 'default' : 'outline'"
                  class="h-8 w-11 text-xs"
                  @click="toggleDay(dayIndex)"
                >
                  {{ dayName }}
                </Button>
              </div>
            </div>

            <div v-if="seriesDates.length > 0" class="rounded-md border p-3">
              <div class="flex items-start justify-between gap-3">
                <div>
                  <p class="text-sm font-medium">{{ seriesDates.length }} sessions scheduled</p>
                  <p v-if="formattedTime" class="text-muted-foreground text-xs">
                    Starting {{ formatSeriesDate(seriesDates[0]!) }} at {{ formattedTime }}
                  </p>
                </div>
                <Badge
                  v-if="seriesConflicts.size === 0"
                  variant="secondary"
                  class="shrink-0 text-[10px]"
                >
                  Ready
                </Badge>
              </div>

              <div class="mt-3 flex flex-wrap gap-2">
                <Badge
                  v-for="date in seriesDates"
                  :key="date"
                  variant="outline"
                  class="px-2 py-1 text-[10px]"
                >
                  {{ formatSeriesDate(date)
                  }}<template v-if="formattedTime"> at {{ formattedTime }}</template>
                </Badge>
              </div>

              <p v-if="seriesConflicts.size > 0" class="mt-3 text-xs text-amber-600">
                {{ seriesConflicts.size }} slot(s) have conflicts. Resolve them before booking.
              </p>
            </div>
          </template>

          <p v-if="hasSelectedSlotConflict && selectedSlotConflict" class="text-sm text-red-600">
            This doctor is already booked from
            {{ formatTime(selectedSlotConflict.start_time) }} to
            {{ formatTime(selectedSlotConflict.end_time) }}.
          </p>

          <div class="space-y-2">
            <Label>Notes</Label>
            <Textarea v-model="form.notes" placeholder="Optional notes" rows="2" />
          </div>
        </div>
      </div>

      <DialogFooter
        class="bg-background shrink-0 border-t px-4 py-4 [padding-bottom:max(1rem,env(safe-area-inset-bottom))] sm:px-6"
      >
        <Button type="button" variant="outline" @click="emit('update:open', false)">
          Cancel
        </Button>
        <Button
          type="submit"
          :disabled="
            isSubmitting ||
            !form.patient_id ||
            !form.therapist_id ||
            !form.date ||
            !form.start_time ||
            (bookingMode === 'single' && hasSelectedSlotConflict) ||
            (bookingMode === 'series' && seriesConflicts.size > 0) ||
            (bookingMode === 'series' && seriesConfig.days.length === 0) ||
            (bookingMode === 'series' && seriesDates.length === 0)
          "
        >
          {{
            isSubmitting
              ? 'Booking...'
              : bookingMode === 'series'
                ? `Book ${seriesDates.length} Appointments`
                : 'Book Appointment'
          }}
        </Button>
      </DialogFooter>
    </form>
  </ResponsiveFormOverlay>
</template>

<script setup lang="ts">
import type { DateValue } from 'reka-ui'
import { CalendarDate } from '@internationalized/date'
import { CalendarIcon } from 'lucide-vue-next'
import { toast } from 'vue-sonner'
import { storeToRefs } from 'pinia'
import { Calendar } from '~/components/ui/calendar'
import { NumberInput } from '~/components/ui/input'
import { Popover, PopoverContent, PopoverTrigger } from '~/components/ui/popover'
import type { Tables } from '~/types/database'
import type { IClinicStaffMember } from '~/services/staff.service'
import type { ITreatmentPlanWithRelations } from '~/types/models/treatment.types'
import type {
  AppointmentBookingMode,
  AppointmentFormState,
  IBookAppointmentPayload,
  SeriesConfigState,
} from '~/features/appointments/types'
import type { IAppointmentBlockingInterval } from '~/types/models/appointment.types'
import {
  NO_TREATMENT_PLAN_VALUE,
  DAY_NAMES,
  MAX_APPOINTMENT_DURATION_MINUTES,
} from '~/features/appointments/constants'
import {
  useBookingAvailability,
  overlapsInterval,
} from '~/features/appointments/composables/useBookingAvailability'
import { useSeriesConflicts } from '~/features/appointments/composables/useSeriesConflicts'
import { cn } from '~/lib/utils'
import { formatSeriesDate, formatTime } from '~/lib/formatters'
import { toDateInputValue, toLocalDateKey } from '~/lib/date'
import { generateIdempotencyKey } from '~/lib/idempotency'
import { appointmentService } from '~/services/appointment.service'
import { AppointmentConflictError } from '~/lib/errors/appointment-conflict.error'
import { TreatmentStatus } from '~/enums/treatment.enum'
import { useTreatmentsStore } from '~/stores/treatments.store'
import { formatPhoneDisplay } from '~/lib/phone'

const phoneCountryCode = useRuntimeConfig().public.phoneCountryCode as string

const props = defineProps<{
  open: boolean
  patients: Tables<'patients'>[]
  therapists: IClinicStaffMember[]
  initialPatientId?: string | null
  initialTherapistId?: string | null
  initialTreatmentPlanId?: string | null
  initialDate?: string | null
  initialStartTime?: string | null
  initialLinkedContext?: {
    patientId: string
    treatmentPlanId: string
    treatmentName: string
  } | null
}>()

const emit = defineEmits<{
  'update:open': [value: boolean]
  submit: [payload: IBookAppointmentPayload]
}>()

const supabase = useSupabaseClient()
const { activeMembership } = useAuth()
const treatmentsStore = useTreatmentsStore()
const { byPatientByClinic: treatmentsByPatientByClinic } = storeToRefs(treatmentsStore)

// --- Form State (owned by dialog) ---

const form = ref<AppointmentFormState>(createDefaultForm())
const bookingMode = ref<AppointmentBookingMode>('single')
const seriesConfig = ref<SeriesConfigState>({ days: [], totalSessions: 10 })
const isSubmitting = ref(false)
const isLoadingTreatmentPlans = ref(false)
const linkedBookingContext = ref<{
  patientId: string
  treatmentPlanId: string
  treatmentName: string
} | null>(null)

const singleIdempotencyKey = ref(generateIdempotencyKey('appt-single'))
const seriesIdempotencyKey = ref(generateIdempotencyKey('appt-series'))
const linkedIdempotencyKey = ref(generateIdempotencyKey('appt'))

let treatmentFetchToken = 0
const datePickerOpen = ref(false)

// --- Composables ---

const clinicId = computed(() => activeMembership.value?.clinic_id)

const { blockedIntervals, isDoctorSelected, timeOptions } = useBookingAvailability(
  computed(() => form.value.therapist_id),
  computed(() => form.value.date),
  computed(() => form.value.duration),
  clinicId,
)

const seriesDates = computed(() => {
  if (bookingMode.value !== 'series') return []
  if (seriesConfig.value.days.length === 0) return []
  if (!form.value.date) return []

  const dates: string[] = []
  const current = new Date(form.value.date + 'T00:00:00')
  const total = seriesConfig.value.totalSessions
  let safety = 0

  while (dates.length < total && safety < 365) {
    if (seriesConfig.value.days.includes(current.getDay())) {
      dates.push(toLocalDateKey(current))
    }
    current.setDate(current.getDate() + 1)
    safety++
  }

  return dates
})

const { conflicts: seriesConflicts } = useSeriesConflicts(
  seriesDates,
  computed(() => form.value.therapist_id),
  computed(() => form.value.start_time),
  computed(() => form.value.duration),
  clinicId,
)

// --- Treatment Plans ---

const selectedPatientTreatmentPlans = computed<ITreatmentPlanWithRelations[]>(() => {
  if (!clinicId.value || !form.value.patient_id) return []
  return treatmentsByPatientByClinic.value[clinicId.value]?.[form.value.patient_id] ?? []
})

const activeTreatmentPlans = computed(() =>
  selectedPatientTreatmentPlans.value.filter((plan) => plan.status === TreatmentStatus.ACTIVE),
)

const canSelectTreatment = computed(() => Boolean(form.value.patient_id))
const lockPatientSelection = computed(() => Boolean(linkedBookingContext.value))
const lockTreatmentPlanSelection = computed(() => Boolean(linkedBookingContext.value))

const treatmentSelectPlaceholder = computed(() => {
  if (!form.value.patient_id) return 'Select patient first'
  if (isLoadingTreatmentPlans.value) return 'Loading treatment plans...'
  if (activeTreatmentPlans.value.length === 0) return 'No active plans available'
  return 'Select treatment plan (optional)'
})

// --- Slot Conflict ---

const selectedDateTimeRange = computed(() => {
  if (bookingMode.value !== 'single') return null
  if (!form.value.date || !form.value.start_time) return null

  const durationMin = Number.parseInt(form.value.duration, 10)
  if (!Number.isFinite(durationMin) || durationMin <= 0) return null

  const startDateTime = `${form.value.date}T${form.value.start_time}:00`
  const start = new Date(startDateTime)
  const end = new Date(startDateTime)
  end.setMinutes(end.getMinutes() + durationMin)

  if (end <= start) return null

  return {
    startIso: start.toISOString(),
    endIso: end.toISOString(),
  }
})

const selectedSlotConflict = computed<IAppointmentBlockingInterval | null>(() => {
  if (!isDoctorSelected.value) return null
  if (!selectedDateTimeRange.value) return null

  return (
    blockedIntervals.value.find((interval) =>
      overlapsInterval(
        selectedDateTimeRange.value!.startIso,
        selectedDateTimeRange.value!.endIso,
        interval,
      ),
    ) ?? null
  )
})

const hasSelectedSlotConflict = computed(() => Boolean(selectedSlotConflict.value))

// --- Calendar Binding ---

const calendarValue = computed<DateValue | undefined>({
  get() {
    if (!form.value.date) return undefined
    const [year, month, day] = form.value.date.split('-').map(Number) as [number, number, number]
    return new CalendarDate(year, month, day)
  },
  set(val: DateValue | undefined) {
    if (val) {
      const y = String(val.year).padStart(4, '0')
      const m = String(val.month).padStart(2, '0')
      const d = String(val.day).padStart(2, '0')
      form.value.date = `${y}-${m}-${d}`
    } else {
      form.value.date = ''
    }
    datePickerOpen.value = false
  },
})

const formattedDate = computed(() => {
  if (!form.value.date) return ''
  return new Date(form.value.date + 'T00:00:00').toLocaleDateString('en-IN', {
    weekday: 'short',
    day: 'numeric',
    month: 'short',
    year: 'numeric',
  })
})

const formattedTime = computed(() => {
  if (!form.value.start_time) return ''
  return new Date(`2000-01-01T${form.value.start_time}:00`).toLocaleTimeString('en-IN', {
    hour: '2-digit',
    minute: '2-digit',
    hour12: true,
  })
})

// --- Watchers ---

watch(
  () => form.value.patient_id,
  async (patientId, prevPatientId) => {
    if (
      patientId !== prevPatientId &&
      (!linkedBookingContext.value || patientId !== linkedBookingContext.value.patientId)
    ) {
      form.value.treatment_plan_id = NO_TREATMENT_PLAN_VALUE
    }

    if (!clinicId.value || !patientId) {
      isLoadingTreatmentPlans.value = false
      return
    }

    const token = ++treatmentFetchToken
    isLoadingTreatmentPlans.value = true
    try {
      await treatmentsStore.fetchByPatient(clinicId.value, patientId)
    } catch {
      if (token === treatmentFetchToken) {
        toast.error('Failed to load treatment plans')
      }
    } finally {
      if (token === treatmentFetchToken) {
        isLoadingTreatmentPlans.value = false
      }
    }
  },
)

watch(
  () => form.value.therapist_id,
  (therapistId, previousTherapistId) => {
    if (!therapistId) {
      form.value.start_time = ''
      return
    }

    if (!previousTherapistId) return

    const stillAvailable = timeOptions.value.some(
      (option) => option.value === form.value.start_time && !option.disabled,
    )

    if (!stillAvailable) {
      form.value.start_time = ''
    }
  },
)

// --- Dialog open/close ---

watch(
  () => props.open,
  (isOpen) => {
    if (isOpen) {
      applyInitialState()
    } else {
      resetForm()
    }
  },
)

// --- Helpers ---

function createDefaultForm(): AppointmentFormState {
  return {
    patient_id: '',
    therapist_id: '',
    treatment_plan_id: NO_TREATMENT_PLAN_VALUE,
    date: toDateInputValue(),
    start_time: '',
    duration: '30',
    notes: '',
  }
}

function resetForm() {
  form.value = createDefaultForm()
  bookingMode.value = 'single'
  seriesConfig.value = { days: [], totalSessions: 10 }
  linkedBookingContext.value = null
  isSubmitting.value = false
  singleIdempotencyKey.value = generateIdempotencyKey('appt-single')
  seriesIdempotencyKey.value = generateIdempotencyKey('appt-series')
  linkedIdempotencyKey.value = generateIdempotencyKey('appt')
}

function applyInitialState() {
  if (props.initialDate) {
    form.value.date = props.initialDate
  }
  if (props.initialStartTime) {
    form.value.start_time = props.initialStartTime
    bookingMode.value = 'single'
  }
  if (props.initialPatientId) {
    form.value.patient_id = props.initialPatientId
  }
  if (props.initialTherapistId) {
    form.value.therapist_id = props.initialTherapistId
  }
  if (props.initialTreatmentPlanId) {
    form.value.treatment_plan_id = props.initialTreatmentPlanId
  }
  if (props.initialLinkedContext) {
    linkedBookingContext.value = { ...props.initialLinkedContext }
    form.value.patient_id = props.initialLinkedContext.patientId
    form.value.treatment_plan_id = props.initialLinkedContext.treatmentPlanId
  }
}

function toggleDay(day: number) {
  const currentDays = seriesConfig.value.days
  const nextDays = currentDays.includes(day)
    ? currentDays.filter((value) => value !== day)
    : [...currentDays, day].sort((a, b) => a - b)

  seriesConfig.value = {
    ...seriesConfig.value,
    days: nextDays,
  }
}

function markSubmitted() {
  isSubmitting.value = false
}

// --- Submit ---

async function handleSubmit() {
  if (!form.value.patient_id || !form.value.therapist_id) return

  // Validate treatment plan is still active
  if (
    form.value.treatment_plan_id !== NO_TREATMENT_PLAN_VALUE &&
    !activeTreatmentPlans.value.some((plan) => plan.id === form.value.treatment_plan_id)
  ) {
    toast.error('Selected treatment plan is no longer active for this patient')
    return
  }

  const treatmentPlanId =
    form.value.treatment_plan_id === NO_TREATMENT_PLAN_VALUE ? null : form.value.treatment_plan_id

  if (bookingMode.value === 'single') {
    const durationMin = Number.parseInt(form.value.duration, 10)
    if (!Number.isFinite(durationMin) || durationMin <= 0) {
      toast.error('Appointment duration must be greater than 0 minutes')
      return
    }
    if (durationMin > MAX_APPOINTMENT_DURATION_MINUTES) {
      toast.error('Appointment duration cannot exceed 12 hours')
      return
    }

    const startDateTime = `${form.value.date}T${form.value.start_time}:00`
    const endDate = new Date(startDateTime)
    endDate.setMinutes(endDate.getMinutes() + durationMin)

    if (endDate <= new Date(startDateTime)) {
      toast.error('Appointment end time must be after start time')
      return
    }

    // Check local conflict
    if (selectedSlotConflict.value) {
      toast.error('This doctor already has an appointment during this time.')
      return
    }

    // Server-side conflict double-check
    isSubmitting.value = true
    try {
      const startIso = new Date(startDateTime).toISOString()
      const endIso = endDate.toISOString()

      if (clinicId.value) {
        const overlap = await appointmentService(supabase).findDoctorConflicts(
          clinicId.value,
          form.value.therapist_id,
          startIso,
          endIso,
        )
        if (overlap) {
          throw new AppointmentConflictError(
            'This doctor already has an appointment during this time.',
            { conflict: overlap },
          )
        }
      }

      emit('submit', {
        mode: 'single',
        patientId: form.value.patient_id,
        therapistId: form.value.therapist_id,
        treatmentPlanId,
        notes: form.value.notes || null,
        startTime: startIso,
        endTime: endIso,
        singleIdempotencyKey: singleIdempotencyKey.value,
        linkedIdempotencyKey: linkedIdempotencyKey.value,
      })
    } catch (err: unknown) {
      if (err instanceof AppointmentConflictError && err.conflict) {
        const start = new Date(err.conflict.conflictingStartTime).toLocaleTimeString('en-IN', {
          hour: '2-digit',
          minute: '2-digit',
          hour12: true,
        })
        const end = new Date(err.conflict.conflictingEndTime).toLocaleTimeString('en-IN', {
          hour: '2-digit',
          minute: '2-digit',
          hour12: true,
        })
        toast.error(`This doctor is booked from ${start} to ${end}`)
      } else {
        toast.error(err instanceof Error ? err.message : 'Failed to check availability')
      }
      isSubmitting.value = false
    }
  } else {
    // Series mode
    if (seriesConfig.value.days.length === 0) {
      toast.error('Select at least one day for a series booking')
      return
    }

    const durationMin = Number.parseInt(form.value.duration, 10)
    if (!Number.isFinite(durationMin) || durationMin <= 0) {
      toast.error('Appointment duration must be greater than 0 minutes')
      return
    }
    if (durationMin > MAX_APPOINTMENT_DURATION_MINUTES) {
      toast.error('Appointment duration cannot exceed 12 hours')
      return
    }

    const occurrences = seriesDates.value.map((dateStr, index) => {
      const startDateTime = `${dateStr}T${form.value.start_time}:00`
      const endDate = new Date(startDateTime)
      endDate.setMinutes(endDate.getMinutes() + durationMin)

      return {
        start_time: new Date(startDateTime).toISOString(),
        end_time: endDate.toISOString(),
        series_index: index + 1,
      }
    })

    if (occurrences.length === 0) {
      toast.error('No valid series sessions were generated')
      return
    }

    isSubmitting.value = true
    emit('submit', {
      mode: 'series',
      patientId: form.value.patient_id,
      therapistId: form.value.therapist_id,
      treatmentPlanId,
      notes: form.value.notes || null,
      occurrences,
      seriesIdempotencyKey: seriesIdempotencyKey.value,
    })
  }
}

defineExpose({ markSubmitted })
</script>
