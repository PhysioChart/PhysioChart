import { storeToRefs } from 'pinia'
import { toast } from 'vue-sonner'
import type { ITreatmentPlanWithRelations } from '~/types/models/treatment.types'
import { TreatmentStatus } from '~/enums/treatment.enum'
import { treatmentService } from '~/services/treatment.service'
import { usePatientsStore } from '~/stores/patients.store'
import { useStaffStore } from '~/stores/staff.store'
import { useTreatmentsStore } from '~/stores/treatments.store'

export function useTreatmentsPage() {
  const supabase = useSupabaseClient()
  const { activeMembership } = useAuth()
  const route = useRoute()
  const patientsStore = usePatientsStore()
  const staffStore = useStaffStore()
  const treatmentsStore = useTreatmentsStore()

  const { dropdownByClinic } = storeToRefs(patientsStore)
  const { activeByClinic } = storeToRefs(staffStore)
  const { byClinic } = storeToRefs(treatmentsStore)

  const isLoading = ref(true)
  const showNewDialog = ref(route.query.action === 'new')
  const filter = ref<TreatmentStatus | 'all'>(TreatmentStatus.ACTIVE)

  const patients = computed(() => {
    if (!activeMembership.value?.clinic_id) return []
    return dropdownByClinic.value[activeMembership.value.clinic_id] ?? []
  })

  const therapists = computed(() => {
    if (!activeMembership.value?.clinic_id) return []
    return activeByClinic.value[activeMembership.value.clinic_id] ?? []
  })

  const plans = computed<ITreatmentPlanWithRelations[]>(() => {
    if (!activeMembership.value?.clinic_id) return []
    return byClinic.value[activeMembership.value.clinic_id] ?? []
  })

  const newPlan = ref({
    patient_id: '',
    therapist_id: '',
    name: '',
    diagnosis: '',
    treatment_type: '',
    total_sessions: 10,
    pricing_mode: 'per_session' as 'per_session' | 'package',
    price_per_session: 0,
    package_price: 0,
    notes: '',
  })
  const isSubmitting = ref(false)
  let dropdownsLoaded = false

  const filteredPlans = computed(() => {
    if (filter.value === 'all') return plans.value
    return plans.value.filter((p) => p.status === filter.value)
  })

  async function loadPlans(): Promise<void> {
    if (!activeMembership.value?.clinic_id) return
    isLoading.value = true

    try {
      await treatmentsStore.fetchList(activeMembership.value.clinic_id)
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : 'Failed to load treatment plans'
      toast.error(message)
    } finally {
      isLoading.value = false
    }
  }

  async function loadDropdowns(): Promise<void> {
    if (dropdownsLoaded || !activeMembership.value?.clinic_id) return
    dropdownsLoaded = true

    try {
      const clinicId = activeMembership.value.clinic_id

      await Promise.all([
        patientsStore.fetchDropdown(clinicId),
        staffStore.fetchActiveList(clinicId),
      ])
    } catch {
      dropdownsLoaded = false
    }
  }

  function openDialog(): void {
    void loadDropdowns()
    showNewDialog.value = true
  }

  async function createPlan(): Promise<void> {
    if (!activeMembership.value?.clinic_id || !newPlan.value.patient_id || !newPlan.value.name)
      return
    isSubmitting.value = true

    try {
      await treatmentService(supabase).create({
        clinic_id: activeMembership.value.clinic_id,
        patient_id: newPlan.value.patient_id,
        therapist_id: newPlan.value.therapist_id || null,
        name: newPlan.value.name,
        diagnosis: newPlan.value.diagnosis || null,
        treatment_type: newPlan.value.treatment_type || null,
        total_sessions: newPlan.value.total_sessions,
        price_per_session:
          newPlan.value.pricing_mode === 'per_session'
            ? newPlan.value.price_per_session || null
            : null,
        package_price:
          newPlan.value.pricing_mode === 'package' ? newPlan.value.package_price || null : null,
        notes: newPlan.value.notes || null,
      })

      toast.success('Treatment plan created')
      treatmentsStore.invalidate(activeMembership.value.clinic_id)
      await loadPlans()
      showNewDialog.value = false
      newPlan.value = {
        patient_id: '',
        therapist_id: '',
        name: '',
        diagnosis: '',
        treatment_type: '',
        total_sessions: 10,
        pricing_mode: 'per_session',
        price_per_session: 0,
        package_price: 0,
        notes: '',
      }
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : 'Failed to create treatment plan'
      toast.error(message)
    } finally {
      isSubmitting.value = false
    }
  }

  onMounted(loadPlans)

  return {
    isLoading,
    showNewDialog,
    filter,
    patients,
    therapists,
    filteredPlans,
    newPlan,
    isSubmitting,
    openDialog,
    createPlan,
  }
}
