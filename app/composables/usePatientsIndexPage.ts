import { storeToRefs } from 'pinia'
import { toast } from 'vue-sonner'
import type { Gender } from '~/enums/gender.enum'
import { isValidIndianPhone, normalizeIndianPhone } from '~/lib/phone'
import { patientService } from '~/services/patient.service'
import { usePatientsStore } from '~/stores/patients.store'

export function usePatientsIndexPage() {
  const supabase = useSupabaseClient()
  const { activeMembership } = useAuth()
  const route = useRoute()
  const patientsStore = usePatientsStore()
  const { byClinic } = storeToRefs(patientsStore)

  const searchQuery = ref('')
  const isLoading = ref(true)
  const showNewPatientDialog = ref(route.query.action === 'new')
  const isSubmitting = ref(false)

  const patients = computed(() => {
    if (!activeMembership.value?.clinic_id) return []
    return byClinic.value[activeMembership.value.clinic_id] ?? []
  })

  const newPatient = ref({
    full_name: '',
    phone: '',
    email: '',
    date_of_birth: '',
    gender: '' as '' | 'male' | 'female' | 'other',
    address: '',
    emergency_contact_name: '',
    emergency_contact_phone: '',
    notes: '',
    medical_history: {
      past_surgeries: [] as string[],
      current_medications: [] as string[],
      allergies: [] as string[],
      conditions: [] as string[],
      notes: '',
    },
  })

  const filteredPatients = computed(() => {
    if (!searchQuery.value) return patients.value
    const q = searchQuery.value.toLowerCase()
    return patients.value.filter(
      (p) => p.full_name.toLowerCase().includes(q) || p.phone.includes(q),
    )
  })

  const canSubmitNewPatient = computed(() => {
    if (!newPatient.value.full_name.trim()) return false
    if (!isValidIndianPhone(newPatient.value.phone)) return false

    return (
      !newPatient.value.emergency_contact_phone ||
      isValidIndianPhone(newPatient.value.emergency_contact_phone)
    )
  })

  async function loadPatients() {
    if (!activeMembership.value?.clinic_id) return
    isLoading.value = true

    try {
      await patientsStore.fetchList(activeMembership.value.clinic_id)
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : 'Failed to load patients'
      toast.error(message)
    } finally {
      isLoading.value = false
    }
  }

  async function createPatient() {
    const phone = normalizeIndianPhone(newPatient.value.phone)
    const emergencyContactPhone = normalizeIndianPhone(newPatient.value.emergency_contact_phone)

    if (!activeMembership.value?.clinic_id || !newPatient.value.full_name.trim()) return
    if (!isValidIndianPhone(newPatient.value.phone)) {
      toast.error('Enter a valid 10-digit Indian mobile number')
      return
    }
    if (
      newPatient.value.emergency_contact_phone &&
      !isValidIndianPhone(newPatient.value.emergency_contact_phone)
    ) {
      toast.error('Enter a valid emergency contact mobile number')
      return
    }
    isSubmitting.value = true

    try {
      const created = await patientService(supabase).create({
        clinic_id: activeMembership.value.clinic_id,
        full_name: newPatient.value.full_name,
        phone,
        email: newPatient.value.email || null,
        date_of_birth: newPatient.value.date_of_birth || null,
        gender: (newPatient.value.gender as Gender) || null,
        address: newPatient.value.address || null,
        emergency_contact_name: newPatient.value.emergency_contact_name || null,
        emergency_contact_phone: emergencyContactPhone || null,
        notes: newPatient.value.notes || null,
        medical_history: newPatient.value.medical_history,
      })

      patientsStore.upsertPatient(activeMembership.value.clinic_id, created)
      patientsStore.invalidate(activeMembership.value.clinic_id)
      toast.success('Patient registered successfully')
      await loadPatients()
      showNewPatientDialog.value = false
      resetForm()
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : 'Failed to create patient'
      toast.error(message)
    } finally {
      isSubmitting.value = false
    }
  }

  function resetForm() {
    newPatient.value = {
      full_name: '',
      phone: '',
      email: '',
      date_of_birth: '',
      gender: '',
      address: '',
      emergency_contact_name: '',
      emergency_contact_phone: '',
      notes: '',
      medical_history: {
        past_surgeries: [],
        current_medications: [],
        allergies: [],
        conditions: [],
        notes: '',
      },
    }
  }

  onMounted(loadPatients)

  return {
    searchQuery,
    isLoading,
    showNewPatientDialog,
    newPatient,
    isSubmitting,
    canSubmitNewPatient,
    filteredPatients,
    createPatient,
  }
}
