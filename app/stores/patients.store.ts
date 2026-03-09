import type { Tables } from '~/types/database'
import { patientService } from '~/services/patient.service'
import { createClinicCacheMeta, type IClinicCacheMeta } from '~/stores/_shared/clinic-cache'

export const usePatientsStore = defineStore('patients', () => {
  const byClinic = ref<Record<string, Tables<'patients'>[]>>({})
  const dropdownByClinic = ref<Record<string, Tables<'patients'>[]>>({})
  const listMetaByClinic = ref<Record<string, IClinicCacheMeta>>({})
  const dropdownMetaByClinic = ref<Record<string, IClinicCacheMeta>>({})

  function getListMeta(clinicId: string): IClinicCacheMeta {
    if (!listMetaByClinic.value[clinicId]) {
      listMetaByClinic.value[clinicId] = createClinicCacheMeta()
    }
    return listMetaByClinic.value[clinicId]!
  }

  function getDropdownMeta(clinicId: string): IClinicCacheMeta {
    if (!dropdownMetaByClinic.value[clinicId]) {
      dropdownMetaByClinic.value[clinicId] = createClinicCacheMeta()
    }
    return dropdownMetaByClinic.value[clinicId]!
  }

  async function refreshList(clinicId: string): Promise<Tables<'patients'>[]> {
    const supabase = useSupabaseClient()
    const meta = getListMeta(clinicId)
    meta.isLoading = true
    meta.error = null

    try {
      const data = await patientService(supabase).list(clinicId)
      byClinic.value[clinicId] = data
      meta.loadedAt = Date.now()
      return data
    } catch (err: unknown) {
      meta.error = err instanceof Error ? err.message : 'Failed to load patients'
      throw err
    } finally {
      meta.isLoading = false
    }
  }

  async function refreshDropdown(clinicId: string): Promise<Tables<'patients'>[]> {
    const supabase = useSupabaseClient()
    const meta = getDropdownMeta(clinicId)
    meta.isLoading = true
    meta.error = null

    try {
      const data = await patientService(supabase).listForDropdown(clinicId)
      dropdownByClinic.value[clinicId] = data
      meta.loadedAt = Date.now()
      return data
    } catch (err: unknown) {
      meta.error = err instanceof Error ? err.message : 'Failed to load patients'
      throw err
    } finally {
      meta.isLoading = false
    }
  }

  async function fetchList(clinicId: string): Promise<Tables<'patients'>[]> {
    return refreshList(clinicId)
  }

  async function fetchDropdown(clinicId: string): Promise<Tables<'patients'>[]> {
    return refreshDropdown(clinicId)
  }

  function upsertPatient(clinicId: string, patient: Tables<'patients'>) {
    const list = byClinic.value[clinicId] ?? []
    const dropdown = dropdownByClinic.value[clinicId] ?? []

    const nextList = [...list]
    const listIndex = nextList.findIndex((p) => p.id === patient.id)
    if (listIndex === -1) nextList.unshift(patient)
    else nextList[listIndex] = patient
    byClinic.value[clinicId] = nextList

    const nextDropdown = [...dropdown]
    const dropdownIndex = nextDropdown.findIndex((p) => p.id === patient.id)
    if (patient.is_archived) {
      dropdownByClinic.value[clinicId] = nextDropdown.filter((p) => p.id !== patient.id)
    } else {
      if (dropdownIndex === -1) nextDropdown.push(patient)
      else nextDropdown[dropdownIndex] = patient
      nextDropdown.sort((a, b) => a.full_name.localeCompare(b.full_name))
      dropdownByClinic.value[clinicId] = nextDropdown
    }
  }

  function archivePatient(clinicId: string, patientId: string) {
    const list = byClinic.value[clinicId] ?? []
    const dropdown = dropdownByClinic.value[clinicId] ?? []

    byClinic.value[clinicId] = list.map((p) =>
      p.id === patientId ? { ...p, is_archived: true } : p,
    )
    dropdownByClinic.value[clinicId] = dropdown.filter((p) => p.id !== patientId)
  }

  function invalidate(clinicId?: string) {
    if (clinicId) {
      listMetaByClinic.value[clinicId] = createClinicCacheMeta()
      dropdownMetaByClinic.value[clinicId] = createClinicCacheMeta()
      return
    }

    byClinic.value = {}
    dropdownByClinic.value = {}
    listMetaByClinic.value = {}
    dropdownMetaByClinic.value = {}
  }

  return {
    byClinic,
    dropdownByClinic,
    fetchList,
    fetchDropdown,
    refreshList,
    refreshDropdown,
    upsertPatient,
    archivePatient,
    invalidate,
  }
})
