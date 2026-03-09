import { storeToRefs } from 'pinia'
import { toast } from 'vue-sonner'
import { toLocalDateKey } from '~/lib/date'
import type { IAppointmentWithRelations } from '~/types/models/appointment.types'
import { useAppointmentsStore } from '~/stores/appointments.store'
import { usePatientsStore } from '~/stores/patients.store'
import { useStaffStore } from '~/stores/staff.store'
import type {
  AppointmentsListFilter,
  AppointmentsViewMode,
  TherapistLegendItem,
} from '~/features/appointments/types'

export const useAppointmentsPageStore = defineStore('appointmentsPage', () => {
  const { activeMembership, isAdmin } = useAuth()

  const patientsStore = usePatientsStore()
  const staffStore = useStaffStore()
  const appointmentsStore = useAppointmentsStore()

  const { dropdownByClinic } = storeToRefs(patientsStore)
  const { activeByClinic } = storeToRefs(staffStore)
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
  const viewMode = ref<AppointmentsViewMode>('list')
  const listFilter = ref<AppointmentsListFilter>('today')

  const showDetailSheet = ref(false)
  const selectedAppointment = ref<IAppointmentWithRelations | null>(null)

  const dropdownsLoadedByClinic = new Set<string>()

  const patients = computed(() => {
    if (!activeMembership.value?.clinic_id) return []
    return dropdownByClinic.value[activeMembership.value.clinic_id] ?? []
  })

  const therapists = computed(() => {
    if (!activeMembership.value?.clinic_id) return []
    return activeByClinic.value[activeMembership.value.clinic_id] ?? []
  })

  const appointments = computed<IAppointmentWithRelations[]>(() => {
    if (!activeMembership.value?.clinic_id) return []
    return byClinic.value[activeMembership.value.clinic_id] ?? []
  })

  const therapistColorMap = computed(() => buildTherapistColorMap(therapists.value))
  const therapistLegend = computed<TherapistLegendItem[]>(() =>
    therapists.value.map((therapist) => ({
      id: therapist.id,
      name: therapist.full_name,
      color: getTherapistColor(therapist.id, therapistColorMap.value),
    })),
  )

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

  watch(
    () => viewMode.value,
    (mode) => {
      if (mode !== 'list') void loadDropdowns()
    },
  )

  async function loadAppointments() {
    if (!activeMembership.value?.clinic_id) return
    isLoading.value = true

    try {
      await appointmentsStore.fetchList(activeMembership.value.clinic_id)
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : 'Failed to load appointments'
      toast.error(message)
    } finally {
      isLoading.value = false
    }
  }

  async function loadDropdowns() {
    if (!activeMembership.value?.clinic_id) return
    const clinicId = activeMembership.value.clinic_id
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

  function getSeriesTotal(seriesId: string): number {
    return seriesTotals.value.get(seriesId) ?? 0
  }

  function handleAppointmentClick(appt: IAppointmentWithRelations) {
    selectedAppointment.value = appt
    showDetailSheet.value = true
  }

  function canReopenAppointment(appt: IAppointmentWithRelations): boolean {
    if (isAdmin.value) return true
    if (!appt.completed_at) return false
    return Date.now() - new Date(appt.completed_at).getTime() <= 24 * 60 * 60 * 1000
  }

  return {
    isLoading,
    viewMode,
    listFilter,
    showDetailSheet,
    selectedAppointment,
    weekDays,
    currentDay,
    dayViewLabel,
    weekViewLabel,
    patients,
    therapists,
    appointments,
    therapistColorMap,
    therapistLegend,
    seriesTotals,
    filteredAppointments,
    goToToday,
    goToPrevDay,
    goToNextDay,
    goToPrevWeek,
    goToNextWeek,
    loadAppointments,
    loadDropdowns,
    getSeriesTotal,
    handleAppointmentClick,
    canReopenAppointment,
  }
})
