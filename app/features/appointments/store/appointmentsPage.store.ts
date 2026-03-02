import { watchDebounced } from '@vueuse/core'
import { storeToRefs } from 'pinia'
import { toast } from 'vue-sonner'
import { APPOINTMENT_STATUS_LABELS, type AppointmentStatus } from '~/enums/appointment.enum'
import { TreatmentStatus } from '~/enums/treatment.enum'
import { toLocalDateKey } from '~/lib/date'
import { appointmentService } from '~/services/appointment.service'
import { useAppointmentsStore } from '~/stores/appointments.store'
import { usePatientsStore } from '~/stores/patients.store'
import { useStaffStore } from '~/stores/staff.store'
import { useTreatmentsStore } from '~/stores/treatments.store'
import type { IAppointmentWithRelations } from '~/types/models/appointment.types'
import type { ITreatmentPlanWithRelations } from '~/types/models/treatment.types'
import type {
  AppointmentBookingMode,
  AppointmentFormState,
  AppointmentsListFilter,
  AppointmentsViewMode,
  SeriesConfigState,
  TherapistLegendItem,
} from '~/features/appointments/types'

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

  const newAppointment = ref<AppointmentFormState>(
    createDefaultAppointmentForm(NO_TREATMENT_PLAN_VALUE),
  )
  const isSubmitting = ref(false)

  const bookingMode = ref<AppointmentBookingMode>('single')
  const seriesConfig = ref<SeriesConfigState>(createDefaultSeriesConfig())
  const DAY_NAMES = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat']

  const conflicts = ref<Set<string>>(new Set())
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

  const treatmentSelectPlaceholder = computed(() => {
    if (!newAppointment.value.patient_id) return 'Select patient first'
    if (isLoadingTreatmentPlans.value) return 'Loading treatment plans...'
    if (activeTreatmentPlansForSelectedPatient.value.length === 0)
      return 'No active plans available'
    return 'Select treatment plan (optional)'
  })

  watchDebounced(
    [seriesDates, () => newAppointment.value.therapist_id],
    async () => {
      if (seriesDates.value.length === 0 || !newAppointment.value.therapist_id || !profile.value) {
        conflicts.value = new Set()
        return
      }

      const firstDate = seriesDates.value[0]!
      const lastDate = seriesDates.value[seriesDates.value.length - 1]!

      const data = await appointmentService(supabase).findConflicts(
        profile.value.clinic_id,
        newAppointment.value.therapist_id,
        firstDate,
        lastDate,
      )

      const existing = new Set(
        data
          .filter((startTime) => {
            const d = new Date(startTime)
            const t = `${String(d.getHours()).padStart(2, '0')}:${String(d.getMinutes()).padStart(2, '0')}`
            return t === newAppointment.value.start_time
          })
          .map((startTime) => toLocalDateKey(startTime)),
      )

      conflicts.value = existing
    },
    { debounce: 300 },
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
      if (patientId !== prevPatientId) {
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
    newAppointment.value = createDefaultAppointmentForm(NO_TREATMENT_PLAN_VALUE)
  }

  async function createAppointment() {
    if (!profile.value || !newAppointment.value.patient_id) return

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
        endDate.setMinutes(endDate.getMinutes() + parseInt(newAppointment.value.duration))

        await service.create({
          clinic_id: profile.value.clinic_id,
          patient_id: newAppointment.value.patient_id,
          therapist_id: newAppointment.value.therapist_id || null,
          treatment_plan_id: treatmentPlanId,
          start_time: new Date(startDateTime).toISOString(),
          end_time: endDate.toISOString(),
          notes: newAppointment.value.notes || null,
        })

        toast.success('Appointment booked')
      } else {
        const seriesId = crypto.randomUUID()
        const durationMin = parseInt(newAppointment.value.duration)

        const rows = seriesDates.value.map((dateStr, index) => {
          const startDateTime = `${dateStr}T${newAppointment.value.start_time}:00`
          const endDate = new Date(startDateTime)
          endDate.setMinutes(endDate.getMinutes() + durationMin)

          return {
            clinic_id: profile.value!.clinic_id,
            patient_id: newAppointment.value.patient_id,
            therapist_id: newAppointment.value.therapist_id || null,
            treatment_plan_id: treatmentPlanId,
            start_time: new Date(startDateTime).toISOString(),
            end_time: endDate.toISOString(),
            notes: newAppointment.value.notes || null,
            series_id: seriesId,
            series_index: index + 1,
          }
        })

        await service.createSeries(rows)
        toast.success(`${rows.length} appointments booked`)
      }

      await loadAppointments()
      resetBookingForm()
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : 'Failed to book appointment'
      toast.error(message)
    } finally {
      isSubmitting.value = false
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
    await loadAppointments()
    await loadDropdowns()

    const patientIdParam = routeQuery.patientId
    const patientId = Array.isArray(patientIdParam) ? patientIdParam[0] : patientIdParam
    if (typeof patientId === 'string' && patients.value.some((p) => p.id === patientId)) {
      newAppointment.value.patient_id = patientId
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
    newAppointment,
    isSubmitting,
    bookingMode,
    seriesConfig,
    conflicts,
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
    resetBookingForm,
    createAppointment,
    updateStatus,
    cancelRemainingSeries,
    initialize,
  }
})
