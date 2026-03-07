import type { IClinicStaffMember } from '~/services/staff.service'
import { staffService } from '~/services/staff.service'
import { createClinicCacheMeta, type IClinicCacheMeta } from '~/stores/_shared/clinic-cache'

export const useStaffStore = defineStore('staff', () => {
  const byClinic = ref<Record<string, IClinicStaffMember[]>>({})
  const activeByClinic = ref<Record<string, IClinicStaffMember[]>>({})
  const listMetaByClinic = ref<Record<string, IClinicCacheMeta>>({})
  const activeMetaByClinic = ref<Record<string, IClinicCacheMeta>>({})

  function getListMeta(clinicId: string): IClinicCacheMeta {
    if (!listMetaByClinic.value[clinicId]) {
      listMetaByClinic.value[clinicId] = createClinicCacheMeta()
    }
    return listMetaByClinic.value[clinicId]!
  }

  function getActiveMeta(clinicId: string): IClinicCacheMeta {
    if (!activeMetaByClinic.value[clinicId]) {
      activeMetaByClinic.value[clinicId] = createClinicCacheMeta()
    }
    return activeMetaByClinic.value[clinicId]!
  }

  async function refreshList(clinicId: string): Promise<IClinicStaffMember[]> {
    const supabase = useSupabaseClient()
    const meta = getListMeta(clinicId)
    meta.isLoading = true
    meta.error = null

    try {
      const data = await staffService(supabase).list(clinicId)
      byClinic.value[clinicId] = data
      meta.loadedAt = Date.now()
      return data
    } catch (err: unknown) {
      meta.error = err instanceof Error ? err.message : 'Failed to load staff'
      throw err
    } finally {
      meta.isLoading = false
    }
  }

  async function refreshActive(clinicId: string): Promise<IClinicStaffMember[]> {
    const supabase = useSupabaseClient()
    const meta = getActiveMeta(clinicId)
    meta.isLoading = true
    meta.error = null

    try {
      const data = await staffService(supabase).listActive(clinicId)
      activeByClinic.value[clinicId] = data
      meta.loadedAt = Date.now()
      return data
    } catch (err: unknown) {
      meta.error = err instanceof Error ? err.message : 'Failed to load staff'
      throw err
    } finally {
      meta.isLoading = false
    }
  }

  async function fetchList(clinicId: string): Promise<IClinicStaffMember[]> {
    return refreshList(clinicId)
  }

  async function fetchActiveList(clinicId: string): Promise<IClinicStaffMember[]> {
    return refreshActive(clinicId)
  }

  function invalidate(clinicId?: string) {
    if (clinicId) {
      listMetaByClinic.value[clinicId] = createClinicCacheMeta()
      activeMetaByClinic.value[clinicId] = createClinicCacheMeta()
      return
    }

    byClinic.value = {}
    activeByClinic.value = {}
    listMetaByClinic.value = {}
    activeMetaByClinic.value = {}
  }

  return {
    byClinic,
    activeByClinic,
    fetchList,
    fetchActiveList,
    refreshList,
    refreshActive,
    invalidate,
  }
})
