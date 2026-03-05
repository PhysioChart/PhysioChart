import { watchDebounced } from '@vueuse/core'
import { storeToRefs } from 'pinia'
import { toast } from 'vue-sonner'
import { APPOINTMENT_STATUS_LABELS, type AppointmentStatus } from '~/enums/appointment.enum'
import { AppointmentErrorCode } from '~/enums/appointment-error.enum'
import { TreatmentStatus } from '~/enums/treatment.enum'
import { toLocalDateKey } from '~/lib/date'
import {
  AppointmentConflictError,
  appointmentService,
  type IAppointmentBlockingInterval,
} from '~/services/appointment.service'
import { useAppointmentsStore } from '~/stores/appointments.store'
import { usePatientsStore } from '~/stores/patients.store'
import { useStaffStore } from '~/stores/staff.store'
import { useTreatmentsStore } from '~/stores/treatments.store'
import type { IAppointmentWithRelations } from '~/types/models/appointment.types'
import type { ITreatmentPlanWithRelations } from '~/types/models/treatment.types'
import type {
  AppointmentBookingMode,
  AppointmentFormState,
  AppointmentTimeOption,
  AppointmentsListFilter,
  AppointmentsViewMode,
  SeriesConfigState,
  TherapistLegendItem,
} from '~/features/appointments/types'

const SLOT_STEP_MINUTES = 15
const MAX_APPOINTMENT_DURATION_MINUTES = 12 * 60
const START_HOUR = 6
const END_HOUR = 22

function getAppointmentErrorMessage(codeOrMessage: string): string {
  switch (codeOrMessage) {
    case AppointmentErrorCode.INVALID_CLINIC_ID:
      return 'Clinic context is missing. Please refresh and try again.'
    case AppointmentErrorCode.CLINIC_SCOPE_MISMATCH:
      return 'You are not allowed to access this clinic.'
    case AppointmentErrorCode.APPOINTMENT_NOT_FOUND:
      return 'Appointment not found or inaccessible.'
    case AppointmentErrorCode.INVALID_APPOINTMENT_RANGE:
      return 'Appointment start and end time are invalid.'
    case AppointmentErrorCode.INVALID_STATUS_TRANSITION:
      return 'Only scheduled or checked-in appointments can be completed.'
    case AppointmentErrorCode.APPOINTMENT_ALREADY_CREATED:
      return 'Appointment already created for this request.'
    case AppointmentErrorCode.IDEMPOTENCY_KEY_REQUIRED:
      return 'Please retry the booking request.'
    case AppointmentErrorCode.TREATMENT_PLAN_NOT_FOUND:
      return 'Treatment plan not found.'
    case AppointmentErrorCode.TREATMENT_PLAN_NOT_ACTIVE:
      return 'Only active treatment plans can be linked to new appointments.'
    case AppointmentErrorCode.PATIENT_NOT_FOUND:
      return 'Patient not found.'
    case AppointmentErrorCode.PATIENT_CLINIC_MISMATCH:
      return 'Selected patient does not belong to this clinic.'
    case AppointmentErrorCode.THERAPIST_NOT_FOUND:
      return 'Therapist not found.'
    case AppointmentErrorCode.THERAPIST_CLINIC_MISMATCH:
      return 'Selected therapist does not belong to this clinic.'
    case AppointmentErrorCode.TREATMENT_PLAN_CLINIC_MISMATCH:
      return 'Selected treatment plan does not belong to this clinic.'
    case AppointmentErrorCode.PATIENT_PLAN_MISMATCH:
      return 'The linked treatment plan does not match this patient.'
    case AppointmentErrorCode.NOTE_TOO_LONG:
      return 'Session note must be 1000 characters or fewer.'
    case AppointmentErrorCode.REOPEN_WINDOW_EXPIRED:
      return 'This appointment can now only be reopened by an admin.'
    case AppointmentErrorCode.FORBIDDEN_REOPEN:
      return 'You do not have permission to reopen this appointment.'
    case AppointmentErrorCode.NOT_COMPLETED:
      return 'Only completed appointments can be reopened.'
    case AppointmentErrorCode.REOPEN_NO_ACTIVE_SESSION:
      return 'Appointment reopened. No active session was found.'
    case AppointmentErrorCode.PRACTITIONER_REQUIRED:
      return 'Assign a therapist before completing this appointment.'
    default:
      return codeOrMessage
  }
}

function createDefaultAppointmentForm(noTreatmentPlanValue: string): AppointmentFormState {
  return {
    patient_id: '',
    therapist_id: '',
    treatment_plan_id: noTreatmentPlanValue,
    date: new Date().toISOString().split('T')[0] ?? '',
    start_time: '09:00',
    duration: '30',
    notes: '',
  }
}

function createDefaultSeriesConfig(): SeriesConfigState {
  return { days: [], totalSessions: 10 }
}

function toTimeLabel(time: string): string {
  return new Date(`2000-01-01T${time}:00`).toLocaleTimeString('en-IN', {
    hour: '2-digit',
    minute: '2-digit',
    hour12: true,
  })
}

function overlapsInterval(
  startIso: string,
  endIso: string,
  interval: IAppointmentBlockingInterval,
): boolean {
  return startIso < interval.end_time && endIso > interval.start_time
}

function generateIdempotencyKey(prefix: string): string {
  if (typeof crypto !== 'undefined' && typeof crypto.randomUUID === 'function') {
    return `${prefix}-${crypto.randomUUID()}`
  }
  return `${prefix}-${Date.now()}-${Math.random().toString(16).slice(2)}`
}

export const useAppointmentsPageStore = defineStore('appointmentsPage', () => {
  const NO_TREATMENT_PLAN_VALUE = '__none__'

  const supabase = useSupabase()
  const { profile } = useAuth()

  const patientsStore = usePatientsStore()
  const staffStore = useStaffStore()
  const treatmentsStore = useTreatmentsStore()
  const appointmentsStore = useAppointmentsStore()

  const { dropdownByClinic } = storeToRefs(patientsStore)
  const { activeByClinic } = storeToRefs(staffStore)
  const { byPatientByClinic: treatmentsByPatientByClinic } = storeToRefs(treatmentsStore)
  const { byClinic } = storeToRefs(appointmentsStore)

  const {
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
  } = useCalendar()

  const isLoading = ref(true)
  const showBookingDialog = ref(false)
  const viewMode = ref<AppointmentsViewMode>('list')
  const listFilter = ref<AppointmentsListFilter>('today')

  const showDetailSheet = ref(false)
  const selectedAppointment = ref<IAppointmentWithRelations | null>(null)
  const showCompleteDialog = ref(false)
  const completeTargetAppointment = ref<IAppointmentWithRelations | null>(null)
  const completeSessionNote = ref('')

  const newAppointment = ref<AppointmentFormState>(
    createDefaultAppointmentForm(NO_TREATMENT_PLAN_VALUE),
  )
  const isSubmitting = ref(false)
  const isCompletingAppointment = ref(false)
  const isReopeningAppointment = ref(false)
  const linkedCreateIdempotencyKey = ref(generateIdempotencyKey('appt'))
  const linkedBookingContext = ref<{
    patientId: string
    treatmentPlanId: string
    treatmentName: string
  } | null>(null)

  const bookingMode = ref<AppointmentBookingMode>('single')
  const seriesConfig = ref<SeriesConfigState>(createDefaultSeriesConfig())
  const DAY_NAMES = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat']

  const conflicts = ref<Set<string>>(new Set())
  const blockedIntervals = ref<IAppointmentBlockingInterval[]>([])
  const isLoadingAvailability = ref(false)
  const isUpdatingStatus = ref(false)
  const isCancellingSeries = ref(false)
  const isLoadingTreatmentPlans = ref(false)

  const dropdownsLoadedByClinic = new Set<string>()
  let treatmentFetchToken = 0

  const patients = computed(() => {
    if (!profile.value) return []
    return dropdownByClinic.value[profile.value.clinic_id] ?? []
  })

  const therapists = computed(() => {
    if (!profile.value) return []
    return activeByClinic.value[profile.value.clinic_id] ?? []
  })

  const appointments = computed<IAppointmentWithRelations[]>(() => {
    if (!profile.value) return []
    return byClinic.value[profile.value.clinic_id] ?? []
  })

  const therapistColorMap = computed(() => buildTherapistColorMap(therapists.value))
  const therapistLegend = computed<TherapistLegendItem[]>(() =>
    therapists.value.map((therapist) => ({
      id: therapist.id,
      name: therapist.full_name,
      color: getTherapistColor(therapist.id, therapistColorMap.value),
    })),
  )

  const seriesDates = computed(() => {
    if (bookingMode.value !== 'series') return []
    if (seriesConfig.value.days.length === 0) return []
    if (!newAppointment.value.date) return []

    const dates: string[] = []
    const current = new Date(newAppointment.value.date + 'T00:00:00')
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

  const seriesTotals = computed(() => {
    const map = new Map<string, number>()
    for (const appt of appointments.value) {
      if (appt.series_id) {
        map.set(appt.series_id, (map.get(appt.series_id) ?? 0) + 1)
      }
    }
    return map
  })

  const filteredAppointments = computed(() => {
    if (listFilter.value === 'today') {
      const today = toLocalDateKey(new Date())
      return appointments.value.filter((appt) => toLocalDateKey(appt.start_time) === today)
    }
    return appointments.value
  })

  const selectedPatientTreatmentPlans = computed<ITreatmentPlanWithRelations[]>(() => {
    if (!profile.value || !newAppointment.value.patient_id) return []
    return (
      treatmentsByPatientByClinic.value[profile.value.clinic_id]?.[
        newAppointment.value.patient_id
      ] ?? []
    )
  })

  const activeTreatmentPlansForSelectedPatient = computed(() =>
    selectedPatientTreatmentPlans.value.filter((plan) => plan.status === TreatmentStatus.ACTIVE),
  )

  const canSelectTreatment = computed(() => Boolean(newAppointment.value.patient_id))
  const lockPatientSelection = computed(() => Boolean(linkedBookingContext.value))
  const lockTreatmentPlanSelection = computed(() => Boolean(linkedBookingContext.value))
  const linkedTreatmentName = computed(() => linkedBookingContext.value?.treatmentName ?? null)

  const treatmentSelectPlaceholder = computed(() => {
    if (!newAppointment.value.patient_id) return 'Select patient first'
    if (isLoadingTreatmentPlans.value) return 'Loading treatment plans...'
    if (activeTreatmentPlansForSelectedPatient.value.length === 0)
      return 'No active plans available'
    return 'Select treatment plan (optional)'
  })

  const isDoctorSelected = computed(() => Boolean(newAppointment.value.therapist_id))

  const selectedDateTimeRange = computed(() => {
    if (!newAppointment.value.date || !newAppointment.value.start_time) return null

    const durationMin = Number.parseInt(newAppointment.value.duration, 10)
    if (!Number.isFinite(durationMin) || durationMin <= 0) return null

    const startDateTime = `${newAppointment.value.date}T${newAppointment.value.start_time}:00`
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

  const timeOptions = computed<AppointmentTimeOption[]>(() => {
    const options: AppointmentTimeOption[] = []
    const durationMin = Number.parseInt(newAppointment.value.duration, 10)
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
        } else if (!newAppointment.value.date) {
          option.disabled = true
          option.disabledReason = 'Select date first'
        } else if (!hasValidDuration) {
          option.disabled = true
          option.disabledReason = 'Select a valid duration'
        } else {
          const startDateTime = `${newAppointment.value.date}T${value}:00`
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
    [() => newAppointment.value.therapist_id, () => newAppointment.value.date],
    async () => {
      if (!profile.value || !newAppointment.value.therapist_id || !newAppointment.value.date) {
        blockedIntervals.value = []
        return
      }

      isLoadingAvailability.value = true
      try {
        blockedIntervals.value = await appointmentService(supabase).listDoctorBlockedIntervals(
          profile.value.clinic_id,
          newAppointment.value.therapist_id,
          newAppointment.value.date,
        )
      } catch {
        blockedIntervals.value = []
      } finally {
        isLoadingAvailability.value = false
      }
    },
    { debounce: 200 },
  )

  watchDebounced(
    [
      seriesDates,
      () => newAppointment.value.therapist_id,
      () => newAppointment.value.start_time,
      () => newAppointment.value.duration,
    ],
    async () => {
      if (seriesDates.value.length === 0 || !newAppointment.value.therapist_id || !profile.value) {
        conflicts.value = new Set()
        return
      }

      const durationMin = Number.parseInt(newAppointment.value.duration, 10)
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
          profile.value.clinic_id,
          newAppointment.value.therapist_id,
          firstDate,
          lastDate,
        )

        const existing = new Set<string>()
        for (const dateStr of seriesDates.value) {
          const startDateTime = `${dateStr}T${newAppointment.value.start_time}:00`
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

  watch(
    () => viewMode.value,
    (mode) => {
      if (mode !== 'list') void loadDropdowns()
    },
  )

  watch(
    () => newAppointment.value.patient_id,
    async (patientId, prevPatientId) => {
      if (
        patientId !== prevPatientId &&
        (!linkedBookingContext.value || patientId !== linkedBookingContext.value.patientId)
      ) {
        newAppointment.value.treatment_plan_id = NO_TREATMENT_PLAN_VALUE
      }

      if (!profile.value || !patientId) {
        isLoadingTreatmentPlans.value = false
        return
      }

      const token = ++treatmentFetchToken
      isLoadingTreatmentPlans.value = true
      try {
        await treatmentsStore.fetchByPatient(profile.value.clinic_id, patientId)
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

  async function loadAppointments() {
    if (!profile.value) return
    isLoading.value = true

    try {
      await appointmentsStore.fetchList(profile.value.clinic_id)
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : 'Failed to load appointments'
      toast.error(message)
    } finally {
      isLoading.value = false
    }
  }

  async function loadDropdowns() {
    if (!profile.value) return
    const clinicId = profile.value.clinic_id
    if (dropdownsLoadedByClinic.has(clinicId)) return

    dropdownsLoadedByClinic.add(clinicId)
    try {
      await Promise.all([
        patientsStore.fetchDropdown(clinicId),
        staffStore.fetchActiveList(clinicId),
      ])
    } catch {
      dropdownsLoadedByClinic.delete(clinicId)
    }
  }

  function openBookingDialog() {
    void loadDropdowns()
    showBookingDialog.value = true
  }

  function closeBookingDialog() {
    resetBookingForm()
  }

  function toggleDay(day: number) {
    const idx = seriesConfig.value.days.indexOf(day)
    if (idx === -1) {
      seriesConfig.value.days.push(day)
      seriesConfig.value.days.sort()
    } else {
      seriesConfig.value.days.splice(idx, 1)
    }
  }

  function getSeriesTotal(seriesId: string): number {
    return seriesTotals.value.get(seriesId) ?? 0
  }

  function handleAppointmentClick(appt: IAppointmentWithRelations) {
    selectedAppointment.value = appt
    showDetailSheet.value = true
  }

  function openCompleteDialog(appt: IAppointmentWithRelations) {
    completeTargetAppointment.value = appt
    completeSessionNote.value = ''
    showCompleteDialog.value = true
  }

  function canReopenAppointment(appt: IAppointmentWithRelations): boolean {
    if (profile.value?.role === 'admin') return true
    if (!appt.completed_at) return false
    return Date.now() - new Date(appt.completed_at).getTime() <= 24 * 60 * 60 * 1000
  }

  function closeCompleteDialog() {
    showCompleteDialog.value = false
    completeTargetAppointment.value = null
    completeSessionNote.value = ''
  }

  function handleSlotClick(date: string, time: string) {
    newAppointment.value.date = date
    newAppointment.value.start_time = time
    bookingMode.value = 'single'
    openBookingDialog()
  }

  function resetBookingForm() {
    showBookingDialog.value = false
    bookingMode.value = 'single'
    seriesConfig.value = createDefaultSeriesConfig()
    conflicts.value = new Set()
    blockedIntervals.value = []
    newAppointment.value = createDefaultAppointmentForm(NO_TREATMENT_PLAN_VALUE)
    linkedBookingContext.value = null
    linkedCreateIdempotencyKey.value = generateIdempotencyKey('appt')
  }

  async function createAppointment() {
    if (!profile.value || !newAppointment.value.patient_id) return
    if (!newAppointment.value.therapist_id) {
      toast.error('Select a doctor before booking an appointment')
      return
    }

    if (
      newAppointment.value.treatment_plan_id !== NO_TREATMENT_PLAN_VALUE &&
      !activeTreatmentPlansForSelectedPatient.value.some(
        (plan) => plan.id === newAppointment.value.treatment_plan_id,
      )
    ) {
      toast.error('Selected treatment plan is no longer active for this patient')
      return
    }

    isSubmitting.value = true

    try {
      const service = appointmentService(supabase)
      const treatmentPlanId =
        newAppointment.value.treatment_plan_id === NO_TREATMENT_PLAN_VALUE
          ? null
          : newAppointment.value.treatment_plan_id

      if (bookingMode.value === 'single') {
        const startDateTime = `${newAppointment.value.date}T${newAppointment.value.start_time}:00`
        const endDate = new Date(startDateTime)
        const durationMin = Number.parseInt(newAppointment.value.duration, 10)
        if (!Number.isFinite(durationMin) || durationMin <= 0) {
          toast.error('Appointment duration must be greater than 0 minutes')
          return
        }
        if (durationMin > MAX_APPOINTMENT_DURATION_MINUTES) {
          toast.error('Appointment duration cannot exceed 12 hours')
          return
        }
        endDate.setMinutes(endDate.getMinutes() + durationMin)

        if (endDate <= new Date(startDateTime)) {
          toast.error('Appointment end time must be after start time')
          return
        }

        if (selectedSlotConflict.value) {
          throw new AppointmentConflictError(
            'This doctor already has an appointment during this time.',
            {
              conflict: {
                conflictingAppointmentId: selectedSlotConflict.value.id,
                conflictingStartTime: selectedSlotConflict.value.start_time,
                conflictingEndTime: selectedSlotConflict.value.end_time,
              },
            },
          )
        }

        const startIso = new Date(startDateTime).toISOString()
        const endIso = endDate.toISOString()
        const overlap = await service.findDoctorConflicts(
          profile.value.clinic_id,
          newAppointment.value.therapist_id,
          startIso,
          endIso,
        )
        if (overlap) {
          throw new AppointmentConflictError(
            'This doctor already has an appointment during this time.',
            {
              conflict: overlap,
            },
          )
        }

        if (treatmentPlanId) {
          const result = await service.createTreatmentLinkedAppointment({
            clinicId: profile.value.clinic_id,
            treatmentPlanId,
            therapistId: newAppointment.value.therapist_id,
            startTime: startIso,
            endTime: endIso,
            notes: newAppointment.value.notes || null,
            idempotencyKey: linkedCreateIdempotencyKey.value,
          })

          if (result.alreadyCreated) {
            toast.info('Appointment already booked for this request')
          } else {
            toast.success('Appointment booked')
          }
        } else {
          await service.create({
            clinic_id: profile.value.clinic_id,
            patient_id: newAppointment.value.patient_id,
            therapist_id: newAppointment.value.therapist_id,
            treatment_plan_id: null,
            start_time: startIso,
            end_time: endIso,
            notes: newAppointment.value.notes || null,
          })
          toast.success('Appointment booked')
        }
      } else {
        const durationMin = Number.parseInt(newAppointment.value.duration, 10)
        if (!Number.isFinite(durationMin) || durationMin <= 0) {
          toast.error('Appointment duration must be greater than 0 minutes')
          return
        }
        if (durationMin > MAX_APPOINTMENT_DURATION_MINUTES) {
          toast.error('Appointment duration cannot exceed 12 hours')
          return
        }

        const occurrences = seriesDates.value.map((dateStr, index) => {
          const startDateTime = `${dateStr}T${newAppointment.value.start_time}:00`
          const endDate = new Date(startDateTime)
          endDate.setMinutes(endDate.getMinutes() + durationMin)

          return {
            start_time: new Date(startDateTime).toISOString(),
            end_time: endDate.toISOString(),
            series_index: index + 1,
          }
        })

        await service.createSeries({
          clinicId: profile.value.clinic_id,
          patientId: newAppointment.value.patient_id,
          therapistId: newAppointment.value.therapist_id,
          treatmentPlanId,
          notes: newAppointment.value.notes || null,
          occurrences,
        })
        toast.success(`${occurrences.length} appointments booked`)
      }

      await loadAppointments()
      resetBookingForm()
    } catch (err: unknown) {
      if (err instanceof AppointmentConflictError) {
        if (err.conflict) {
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
        } else if (err.conflicts && err.conflicts.length > 0) {
          const first = err.conflicts[0]
          if (!first) {
            toast.error(err.message)
            return
          }
          const start = new Date(first.occurrenceStartTime).toLocaleString('en-IN', {
            day: 'numeric',
            month: 'short',
            hour: '2-digit',
            minute: '2-digit',
            hour12: true,
          })
          toast.error(`Series conflict at ${start}. Resolve conflicts and retry.`)
        } else {
          toast.error(err.message)
        }
      } else {
        const message = err instanceof Error ? err.message : 'Failed to book appointment'
        toast.error(getAppointmentErrorMessage(message))
      }
    } finally {
      isSubmitting.value = false
    }
  }

  async function completeAppointment(noteOverride?: string) {
    if (!profile.value || !completeTargetAppointment.value) return
    isCompletingAppointment.value = true

    const rawNote = noteOverride ?? completeSessionNote.value
    const trimmedNote = rawNote?.trim() ?? ''
    const noteToSend = trimmedNote.length > 0 ? trimmedNote : null

    try {
      const result = await appointmentService(supabase).completeWithSessionNote(
        profile.value.clinic_id,
        completeTargetAppointment.value.id,
        noteToSend,
      )

      if (result.message === AppointmentErrorCode.ALREADY_COMPLETED) {
        toast.info('Appointment already completed')
      } else {
        toast.success(
          noteToSend ? 'Appointment completed. Session note saved.' : 'Appointment completed.',
        )
      }

      if (result.planCompleted) {
        toast.success('Treatment plan completed')
      }

      if (completeTargetAppointment.value.treatment_plan?.id) {
        treatmentsStore.invalidate(profile.value.clinic_id)
      }

      await loadAppointments()
      closeCompleteDialog()
      showDetailSheet.value = false
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : 'Failed to complete appointment'
      toast.error(getAppointmentErrorMessage(message))
    } finally {
      isCompletingAppointment.value = false
    }
  }

  async function reopenAppointment(appointmentId: string) {
    if (!profile.value) return
    isReopeningAppointment.value = true

    try {
      const result = await appointmentService(supabase).reopenCompletedAppointment(
        profile.value.clinic_id,
        appointmentId,
      )
      toast.success(
        result.sessionVoided
          ? 'Appointment reopened.'
          : 'Appointment reopened (no active session was found).',
      )
      await loadAppointments()
      showDetailSheet.value = false
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : 'Failed to reopen appointment'
      toast.error(getAppointmentErrorMessage(message))
    } finally {
      isReopeningAppointment.value = false
    }
  }

  async function updateStatus(id: string, status: AppointmentStatus) {
    isUpdatingStatus.value = true

    try {
      if (!profile.value) return
      await appointmentService(supabase).updateStatus(profile.value.clinic_id, id, status)
      toast.success(`Appointment marked as ${APPOINTMENT_STATUS_LABELS[status]}`)
      showDetailSheet.value = false
      await loadAppointments()
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : 'Failed to update status'
      toast.error(message)
    } finally {
      isUpdatingStatus.value = false
    }
  }

  async function cancelRemainingSeries(seriesId: string) {
    isCancellingSeries.value = true

    try {
      if (!profile.value) return
      await appointmentService(supabase).cancelSeries(profile.value.clinic_id, seriesId)
      toast.success('Remaining appointments in series cancelled')
      await loadAppointments()
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : 'Failed to cancel series'
      toast.error(message)
    } finally {
      isCancellingSeries.value = false
    }
  }

  async function initialize(routeQuery: Record<string, unknown>) {
    resetBookingForm()
    await loadAppointments()
    await loadDropdowns()

    const patientIdParam = routeQuery.patientId
    const patientId = Array.isArray(patientIdParam) ? patientIdParam[0] : patientIdParam
    if (typeof patientId === 'string' && patients.value.some((p) => p.id === patientId)) {
      newAppointment.value.patient_id = patientId
    }

    const treatmentPlanIdParam = routeQuery.treatmentPlanId
    const treatmentPlanId = Array.isArray(treatmentPlanIdParam)
      ? treatmentPlanIdParam[0]
      : treatmentPlanIdParam

    if (
      profile.value &&
      typeof patientId === 'string' &&
      patientId &&
      typeof treatmentPlanId === 'string' &&
      treatmentPlanId
    ) {
      try {
        await treatmentsStore.fetchByPatient(profile.value.clinic_id, patientId)
        const linkedPlan =
          treatmentsByPatientByClinic.value[profile.value.clinic_id]?.[patientId]?.find(
            (plan) => plan.id === treatmentPlanId && plan.status === TreatmentStatus.ACTIVE,
          ) ?? null

        if (linkedPlan) {
          newAppointment.value.patient_id = linkedPlan.patient_id
          newAppointment.value.treatment_plan_id = linkedPlan.id
          if (linkedPlan.therapist_id) {
            newAppointment.value.therapist_id = linkedPlan.therapist_id
          }
          linkedBookingContext.value = {
            patientId: linkedPlan.patient_id,
            treatmentPlanId: linkedPlan.id,
            treatmentName: linkedPlan.name,
          }
        } else {
          toast.error('Linked treatment plan is unavailable. Please select another plan.')
        }
      } catch {
        toast.error('Failed to load linked treatment plan.')
      }
    }

    if (routeQuery.action === 'new') {
      openBookingDialog()
    }
  }

  return {
    NO_TREATMENT_PLAN_VALUE,
    DAY_NAMES,
    isLoading,
    showBookingDialog,
    viewMode,
    listFilter,
    showDetailSheet,
    selectedAppointment,
    showCompleteDialog,
    completeTargetAppointment,
    completeSessionNote,
    newAppointment,
    isSubmitting,
    isCompletingAppointment,
    isReopeningAppointment,
    bookingMode,
    seriesConfig,
    conflicts,
    blockedIntervals,
    isLoadingAvailability,
    isDoctorSelected,
    selectedSlotConflict,
    hasSelectedSlotConflict,
    timeOptions,
    isUpdatingStatus,
    isCancellingSeries,
    isLoadingTreatmentPlans,
    weekDays,
    currentDay,
    dayViewLabel,
    weekViewLabel,
    patients,
    therapists,
    appointments,
    therapistColorMap,
    therapistLegend,
    seriesDates,
    seriesTotals,
    filteredAppointments,
    activeTreatmentPlansForSelectedPatient,
    canSelectTreatment,
    lockPatientSelection,
    lockTreatmentPlanSelection,
    linkedTreatmentName,
    treatmentSelectPlaceholder,
    goToToday,
    goToPrevDay,
    goToNextDay,
    goToPrevWeek,
    goToNextWeek,
    loadAppointments,
    loadDropdowns,
    openBookingDialog,
    closeBookingDialog,
    toggleDay,
    getSeriesTotal,
    handleAppointmentClick,
    handleSlotClick,
    canReopenAppointment,
    openCompleteDialog,
    closeCompleteDialog,
    completeAppointment,
    reopenAppointment,
    resetBookingForm,
    createAppointment,
    updateStatus,
    cancelRemainingSeries,
    initialize,
  }
})
