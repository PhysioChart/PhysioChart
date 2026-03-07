import { toast } from 'vue-sonner'
import { storeToRefs } from 'pinia'
import type { Tables, MedicalHistory } from '~/types/database'
import type { IAppointmentWithRelations } from '~/types/models/appointment.types'
import type { IInvoiceWithRelations } from '~/types/models/invoice.types'
import type { IPatientEditForm } from '~/types/models/patient.types'
import type { ITreatmentPlanWithRelations } from '~/types/models/treatment.types'
import { InvoiceStatus } from '~/enums/invoice.enum'
import { TreatmentStatus } from '~/enums/treatment.enum'
import { AppointmentStatus } from '~/enums/appointment.enum'
import { patientService } from '~/services/patient.service'
import { usePatientsStore } from '~/stores/patients.store'
import { useAppointmentsStore } from '~/stores/appointments.store'
import { useTreatmentsStore } from '~/stores/treatments.store'
import { useInvoicesStore } from '~/stores/invoices.store'
import { toLocalDateKey } from '~/lib/date'

export function usePatientDetailPage() {
  const route = useRoute()
  const supabase = useSupabaseClient()
  const { activeMembership, ensureBootstrapped } = useAuth()
  const patientsStore = usePatientsStore()
  const appointmentsStore = useAppointmentsStore()
  const treatmentsStore = useTreatmentsStore()
  const invoicesStore = useInvoicesStore()
  const { byPatientByClinic: appointmentsByPatientByClinic } = storeToRefs(appointmentsStore)
  const { byPatientByClinic: treatmentsByPatientByClinic } = storeToRefs(treatmentsStore)
  const { byPatientByClinic: invoicesByPatientByClinic } = storeToRefs(invoicesStore)

  const patient = ref<Tables<'patients'> | null>(null)
  const appointments = ref<IAppointmentWithRelations[]>([])
  const invoices = ref<IInvoiceWithRelations[]>([])
  const treatments = ref<ITreatmentPlanWithRelations[]>([])

  const isLoading = ref(true)
  const isLoadingAppointments = ref(false)
  const isLoadingTreatments = ref(false)
  const isLoadingInvoices = ref(false)

  const activeTab = ref('overview')
  const hasLoadedInvoices = ref(false)
  const showAllPast = ref(false)
  const isEditing = ref(false)
  const isSaving = ref(false)
  const isArchiving = ref(false)

  function getPatientId(): string {
    const { id } = route.params

    if (Array.isArray(id)) {
      return id[0] ?? ''
    }

    return typeof id === 'string' ? id : ''
  }

  function getRouteContext() {
    const clinicId = activeMembership.value?.clinic_id
    const patientId = getPatientId()

    if (!clinicId || !patientId) {
      return null
    }

    return { clinicId, patientId }
  }

  async function loadPatient(clinicId: string, patientId: string) {
    isLoading.value = true

    try {
      const data = await patientService(supabase).getById(clinicId, patientId)
      if (!data) {
        toast.error('Patient not found')
        await navigateTo('/patients')
        return
      }
      patient.value = data
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : 'Failed to load patient'
      toast.error(message)
      await navigateTo('/patients')
    } finally {
      isLoading.value = false
    }
  }

  async function loadAppointments(clinicId: string, patientId: string) {
    isLoadingAppointments.value = true
    showAllPast.value = false

    try {
      await appointmentsStore.fetchByPatient(clinicId, patientId)
      appointments.value = appointmentsByPatientByClinic.value[clinicId]?.[patientId] ?? []
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : 'Failed to load appointments'
      toast.error(message)
    } finally {
      isLoadingAppointments.value = false
    }
  }

  async function loadTreatments(clinicId: string, patientId: string) {
    isLoadingTreatments.value = true

    try {
      await treatmentsStore.fetchByPatient(clinicId, patientId)
      treatments.value = treatmentsByPatientByClinic.value[clinicId]?.[patientId] ?? []
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : 'Failed to load treatment plans'
      toast.error(message)
    } finally {
      isLoadingTreatments.value = false
    }
  }

  async function loadInvoices(clinicId: string, patientId: string) {
    isLoadingInvoices.value = true

    try {
      await invoicesStore.fetchByPatient(clinicId, patientId)
      invoices.value = invoicesByPatientByClinic.value[clinicId]?.[patientId] ?? []
      hasLoadedInvoices.value = true
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : 'Failed to load invoices'
      toast.error(message)
    } finally {
      isLoadingInvoices.value = false
    }
  }

  async function loadCoreData(clinicId: string, patientId: string) {
    await Promise.all([
      loadPatient(clinicId, patientId),
      loadAppointments(clinicId, patientId),
      loadTreatments(clinicId, patientId),
    ])
  }

  async function initialize() {
    await ensureBootstrapped()

    const context = getRouteContext()

    if (!context) {
      isLoading.value = false
      return
    }

    await loadCoreData(context.clinicId, context.patientId)
  }

  const todayDateKey = computed(() => toLocalDateKey(new Date()))

  const upcomingAppointments = computed(() => {
    return appointments.value
      .filter((appt) => {
        const apptDateKey = toLocalDateKey(appt.start_time)
        return appt.status === AppointmentStatus.SCHEDULED && apptDateKey >= todayDateKey.value
      })
      .slice()
      .sort((a, b) => new Date(a.start_time).getTime() - new Date(b.start_time).getTime())
  })

  const pastAppointments = computed(() => {
    return appointments.value
      .filter((appt) => {
        const apptDateKey = toLocalDateKey(appt.start_time)
        return appt.status !== AppointmentStatus.SCHEDULED || apptDateKey < todayDateKey.value
      })
      .slice()
      .sort((a, b) => new Date(b.start_time).getTime() - new Date(a.start_time).getTime())
  })

  const visiblePastAppointments = computed(() => {
    return showAllPast.value ? pastAppointments.value : pastAppointments.value.slice(0, 10)
  })

  const remainingPastCount = computed(() => Math.max(0, pastAppointments.value.length - 10))

  const activeTreatments = computed(() => {
    return treatments.value.filter((t) => t.status === TreatmentStatus.ACTIVE)
  })

  const completedTreatments = computed(() => {
    return treatments.value.filter(
      (t) => t.status === TreatmentStatus.COMPLETED || t.status === TreatmentStatus.CANCELLED,
    )
  })

  const unpaidPendingInvoices = computed(() => {
    return invoices.value.filter((inv) => inv.status !== InvoiceStatus.PAID)
  })

  const paidInvoices = computed(() => {
    return invoices.value.filter((inv) => inv.status === InvoiceStatus.PAID)
  })

  function getAppointmentStatusBadgeClass(status: AppointmentStatus): string {
    const base = 'rounded-full px-2.5 py-0.5 text-xs font-medium'

    switch (status) {
      case AppointmentStatus.SCHEDULED:
        return `${base} bg-yellow-100 text-yellow-800`
      case AppointmentStatus.COMPLETED:
        return `${base} bg-green-100 text-green-800`
      case AppointmentStatus.CANCELLED:
        return `${base} bg-gray-100 text-gray-800`
      case AppointmentStatus.NO_SHOW:
        return `${base} bg-red-100 text-red-800`
      default:
        return `${base} bg-gray-100 text-gray-800`
    }
  }

  function getTreatmentStatusBadgeClass(status: TreatmentStatus): string {
    const base = 'rounded-full px-2.5 py-0.5 text-xs font-medium'

    switch (status) {
      case TreatmentStatus.ACTIVE:
        return `${base} bg-green-100 text-green-800`
      case TreatmentStatus.COMPLETED:
        return `${base} bg-emerald-100 text-emerald-800`
      case TreatmentStatus.CANCELLED:
        return `${base} bg-slate-100 text-slate-600`
      default:
        return `${base} bg-gray-100 text-gray-800`
    }
  }

  function getInvoiceStatusBadgeClass(status: InvoiceStatus): string {
    switch (status) {
      case InvoiceStatus.PAID:
        return 'badge-paid'
      case InvoiceStatus.OVERDUE:
        return 'badge-overdue'
      case InvoiceStatus.CANCELLED:
        return 'badge-cancelled'
      case InvoiceStatus.DRAFT:
      case InvoiceStatus.SENT:
      case InvoiceStatus.PARTIALLY_PAID:
        return 'badge-pending'
      default:
        return 'badge-cancelled'
    }
  }

  function treatmentProgress(plan: ITreatmentPlanWithRelations): number {
    if (!plan.total_sessions || plan.total_sessions <= 0) return 0
    return Math.round((plan.derived_completed_sessions / plan.total_sessions) * 100)
  }

  function startEdit() {
    if (!patient.value) return
    isEditing.value = true
  }

  function buildEditForm(patientData: Tables<'patients'>): IPatientEditForm {
    return {
      full_name: patientData.full_name,
      phone: patientData.phone,
      email: patientData.email ?? '',
      date_of_birth: patientData.date_of_birth ?? '',
      gender: patientData.gender ?? '',
      address: patientData.address ?? '',
      emergency_contact_name: patientData.emergency_contact_name ?? '',
      emergency_contact_phone: patientData.emergency_contact_phone ?? '',
      notes: patientData.notes ?? '',
    }
  }

  async function saveEdit(form: IPatientEditForm) {
    if (!patient.value || !form.full_name) return
    isSaving.value = true

    try {
      if (!activeMembership.value?.clinic_id) return
      await patientService(supabase).update(activeMembership.value.clinic_id, patient.value.id, {
        full_name: form.full_name,
        phone: form.phone,
        email: form.email || null,
        date_of_birth: form.date_of_birth || null,
        gender: (form.gender || null) as Tables<'patients'>['gender'],
        address: form.address || null,
        emergency_contact_name: form.emergency_contact_name || null,
        emergency_contact_phone: form.emergency_contact_phone || null,
        notes: form.notes || null,
      })

      if (patient.value) {
        patientsStore.upsertPatient(activeMembership.value.clinic_id, {
          ...patient.value,
          full_name: form.full_name,
          phone: form.phone,
          email: form.email || null,
          date_of_birth: form.date_of_birth || null,
          gender: (form.gender || null) as Tables<'patients'>['gender'],
          address: form.address || null,
          emergency_contact_name: form.emergency_contact_name || null,
          emergency_contact_phone: form.emergency_contact_phone || null,
          notes: form.notes || null,
        })
        patientsStore.invalidate(activeMembership.value.clinic_id)
        appointmentsStore.invalidatePatient(activeMembership.value.clinic_id, patient.value.id)
        treatmentsStore.invalidatePatient(activeMembership.value.clinic_id, patient.value.id)
        invoicesStore.invalidatePatient(activeMembership.value.clinic_id, patient.value.id)
      }

      toast.success('Patient updated')
      const context = getRouteContext()
      if (context) {
        await loadPatient(context.clinicId, context.patientId)
      }
      isEditing.value = false
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : 'Failed to update patient'
      toast.error(message)
    } finally {
      isSaving.value = false
    }
  }

  async function archivePatient() {
    if (!patient.value) return
    isArchiving.value = true

    try {
      if (!activeMembership.value?.clinic_id) return
      await patientService(supabase).archive(activeMembership.value.clinic_id, patient.value.id)
      patientsStore.archivePatient(activeMembership.value.clinic_id, patient.value.id)
      patientsStore.invalidate(activeMembership.value.clinic_id)
      appointmentsStore.invalidatePatient(activeMembership.value.clinic_id, patient.value.id)
      treatmentsStore.invalidatePatient(activeMembership.value.clinic_id, patient.value.id)
      invoicesStore.invalidatePatient(activeMembership.value.clinic_id, patient.value.id)
      toast.success('Patient archived')
      navigateTo('/patients')
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : 'Failed to archive patient'
      toast.error(message)
    } finally {
      isArchiving.value = false
    }
  }

  const medicalHistory = computed(() => {
    return (patient.value?.medical_history as MedicalHistory) ?? {}
  })

  watch(
    [activeTab, () => activeMembership.value?.clinic_id, () => getPatientId()],
    ([tab, clinicId, patientId]) => {
      if (tab === 'billing' && clinicId && patientId && !hasLoadedInvoices.value) {
        void loadInvoices(clinicId, patientId)
      }
    },
    { immediate: true },
  )

  watch(
    [() => activeMembership.value?.clinic_id, () => getPatientId()],
    ([clinicId, patientId], [prevClinicId, prevPatientId]) => {
      if (!clinicId || !patientId) return
      if (clinicId === prevClinicId && patientId === prevPatientId) return

      patient.value = null
      appointments.value = []
      treatments.value = []
      invoices.value = []
      hasLoadedInvoices.value = false
      activeTab.value = 'overview'

      void loadCoreData(clinicId, patientId)
    },
  )

  return {
    patient,
    appointments,
    invoices,
    treatments,
    isLoading,
    isLoadingAppointments,
    isLoadingTreatments,
    isLoadingInvoices,
    activeTab,
    showAllPast,
    isEditing,
    isSaving,
    isArchiving,
    medicalHistory,
    upcomingAppointments,
    pastAppointments,
    visiblePastAppointments,
    remainingPastCount,
    activeTreatments,
    completedTreatments,
    unpaidPendingInvoices,
    paidInvoices,
    getAppointmentStatusBadgeClass,
    getTreatmentStatusBadgeClass,
    getInvoiceStatusBadgeClass,
    treatmentProgress,
    startEdit,
    buildEditForm,
    saveEdit,
    archivePatient,
    initialize,
  }
}
