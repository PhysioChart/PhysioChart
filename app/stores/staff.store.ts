import type { Tables } from '~/types/database'
import { staffService } from '~/services/staff.service'
import {
  createClinicCacheMeta,
  isExpired,
  type IClinicCacheMeta,
} from '~/stores/_shared/clinic-cache'

const TTL_MS = 60_000

export const useStaffStore = defineStore('staff', () => {
  const byClinic = ref<Record<string, Tables<'profiles'>[]>>({})
  const activeByClinic = ref<Record<string, Tables<'profiles'>[]>>({})
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

  async function refreshList(clinicId: string): Promise<Tables<'profiles'>[]> {
    const supabase = useSupabase()
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

  async function refreshActive(clinicId: string): Promise<Tables<'profiles'>[]> {
    const supabase = useSupabase()
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

  async function fetchList(
    clinicId: string,
    options?: { force?: boolean },
  ): Promise<Tables<'profiles'>[]> {
    const current = byClinic.value[clinicId] ?? []
    const meta = getListMeta(clinicId)
    const stale = isExpired(meta.loadedAt, TTL_MS)

    if (options?.force) return refreshList(clinicId)
    if (current.length === 0) return refreshList(clinicId)

    if (stale && !meta.isLoading) {
      void refreshList(clinicId)
    }

    return current
  }

  async function fetchActiveList(
    clinicId: string,
    options?: { force?: boolean },
  ): Promise<Tables<'profiles'>[]> {
    const current = activeByClinic.value[clinicId] ?? []
    const meta = getActiveMeta(clinicId)
    const stale = isExpired(meta.loadedAt, TTL_MS)

    if (options?.force) return refreshActive(clinicId)
    if (current.length === 0) return refreshActive(clinicId)

    if (stale && !meta.isLoading) {
      void refreshActive(clinicId)
    }

    return current
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
    listMetaByClinic,
    activeMetaByClinic,
    fetchList,
    fetchActiveList,
    refreshList,
    refreshActive,
    invalidate,
  }
})
