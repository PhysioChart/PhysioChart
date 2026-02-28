import { watchDebounced } from '@vueuse/core'
import { storeToRefs } from 'pinia'
import { toast } from 'vue-sonner'
import type { IAppointmentWithRelations } from '~/types/models/appointment.types'
import type { AppointmentStatus } from '~/enums/appointment.enum'
import { APPOINTMENT_STATUS_LABELS } from '~/enums/appointment.enum'
import { appointmentService } from '~/services/appointment.service'
import { useAppointmentsStore } from '~/stores/appointments.store'
import { usePatientsStore } from '~/stores/patients.store'
import { useStaffStore } from '~/stores/staff.store'
import { toLocalDateKey } from '~/lib/date'

export function useAppointmentsPage() {
  const supabase = useSupabase()
  const { profile } = useAuth()
  const route = useRoute()
  const patientsStore = usePatientsStore()
  const staffStore = useStaffStore()
  const appointmentsStore = useAppointmentsStore()
  const { dropdownByClinic } = storeToRefs(patientsStore)
  const { activeByClinic } = storeToRefs(staffStore)
  const { byClinic } = storeToRefs(appointmentsStore)

  const isLoading = ref(true)
  const showNewDialog = ref(false)
  const viewMode = ref<'list' | 'day' | 'week'>('list')
  const listFilter = ref<'today' | 'all'>('today')

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

  const therapistColorMap = computed(() => buildTherapistColorMap(therapists.value))
  const therapistLegend = computed(() =>
    therapists.value.map((therapist) => ({
      id: therapist.id,
      name: therapist.full_name,
      color: getTherapistColor(therapist.id, therapistColorMap.value),
    })),
  )

  const showDetailSheet = ref(false)
  const selectedAppointment = ref<IAppointmentWithRelations | null>(null)

  const newAppointment = ref({
    patient_id: '',
    therapist_id: '',
    date: new Date().toISOString().split('T')[0],
    start_time: '09:00',
    duration: '30',
    notes: '',
  })
  const isSubmitting = ref(false)

  const bookingMode = ref<'single' | 'series'>('single')
  const seriesConfig = ref({
    days: [] as number[],
    totalSessions: 10,
  })
  const DAY_NAMES = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat']

  const conflicts = ref<Set<string>>(new Set())
  const isUpdatingStatus = ref(false)
  const isCancellingSeries = ref(false)

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

  const seriesTotals = computed(() => {
    const map = new Map<string, number>()
    for (const a of appointments.value) {
      if (a.series_id) {
        map.set(a.series_id, (map.get(a.series_id) ?? 0) + 1)
      }
    }
    return map
  })

  const filteredAppointments = computed(() => {
    if (listFilter.value === 'today') {
      const today = toLocalDateKey(new Date())
      return appointments.value.filter((a) => toLocalDateKey(a.start_time) === today)
    }
    return appointments.value
  })

  let dropdownsLoaded = false

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
    if (dropdownsLoaded || !profile.value) return
    dropdownsLoaded = true
    const clinicId = profile.value.clinic_id

    try {
      await Promise.all([
        patientsStore.fetchDropdown(clinicId),
        staffStore.fetchActiveList(clinicId),
      ])
    } catch {
      dropdownsLoaded = false
    }
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

  function openBookingDialog() {
    void loadDropdowns()
    showNewDialog.value = true
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

  async function createAppointment() {
    if (!profile.value || !newAppointment.value.patient_id) return
    isSubmitting.value = true

    try {
      const service = appointmentService(supabase)

      if (bookingMode.value === 'single') {
        const startDateTime = `${newAppointment.value.date}T${newAppointment.value.start_time}:00`
        const endDate = new Date(startDateTime)
        endDate.setMinutes(endDate.getMinutes() + parseInt(newAppointment.value.duration))

        await service.create({
          clinic_id: profile.value.clinic_id,
          patient_id: newAppointment.value.patient_id,
          therapist_id: newAppointment.value.therapist_id || null,
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
      resetForm()
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : 'Failed to book appointment'
      toast.error(message)
    } finally {
      isSubmitting.value = false
    }
  }

  function resetForm() {
    showNewDialog.value = false
    bookingMode.value = 'single'
    seriesConfig.value = { days: [], totalSessions: 10 }
    conflicts.value = new Set()
    newAppointment.value = {
      patient_id: '',
      therapist_id: '',
      date: new Date().toISOString().split('T')[0],
      start_time: '09:00',
      duration: '30',
      notes: '',
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

  watch(viewMode, (mode) => {
    if (mode !== 'list') void loadDropdowns()
  })

  onMounted(async () => {
    await loadAppointments()
    if (route.query.action === 'new') openBookingDialog()
  })

  return {
    appointments,
    isLoading,
    showNewDialog,
    viewMode,
    listFilter,
    patients,
    therapists,
    weekDays,
    currentDay,
    dayViewLabel,
    weekViewLabel,
    goToToday,
    goToPrevDay,
    goToNextDay,
    goToPrevWeek,
    goToNextWeek,
    therapistColorMap,
    therapistLegend,
    showDetailSheet,
    selectedAppointment,
    newAppointment,
    isSubmitting,
    bookingMode,
    seriesConfig,
    DAY_NAMES,
    seriesDates,
    conflicts,
    filteredAppointments,
    handleAppointmentClick,
    handleSlotClick,
    openBookingDialog,
    toggleDay,
    getSeriesTotal,
    createAppointment,
    resetForm,
    updateStatus,
    cancelRemainingSeries,
  }
}
