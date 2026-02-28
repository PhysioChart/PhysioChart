import type { IInvoiceWithRelations } from '~/types/models/invoice.types'
import { invoiceService } from '~/services/invoice.service'
import { createClinicCacheMeta, type IClinicCacheMeta } from '~/stores/_shared/clinic-cache'

export const useInvoicesStore = defineStore('invoices', () => {
  const byClinic = ref<Record<string, IInvoiceWithRelations[]>>({})
  const byPatientByClinic = ref<Record<string, Record<string, IInvoiceWithRelations[]>>>({})
  const listMetaByClinic = ref<Record<string, IClinicCacheMeta>>({})
  const byPatientMetaByClinic = ref<Record<string, Record<string, IClinicCacheMeta>>>({})

  function getListMeta(clinicId: string): IClinicCacheMeta {
    if (!listMetaByClinic.value[clinicId]) {
      listMetaByClinic.value[clinicId] = createClinicCacheMeta()
    }
    return listMetaByClinic.value[clinicId]!
  }

  function getByPatientMeta(clinicId: string, patientId: string): IClinicCacheMeta {
    if (!byPatientMetaByClinic.value[clinicId]) {
      byPatientMetaByClinic.value[clinicId] = {}
    }
    if (!byPatientMetaByClinic.value[clinicId]?.[patientId]) {
      byPatientMetaByClinic.value[clinicId]![patientId] = createClinicCacheMeta()
    }
    return byPatientMetaByClinic.value[clinicId]![patientId]!
  }

  async function refreshList(clinicId: string): Promise<IInvoiceWithRelations[]> {
    const supabase = useSupabase()
    const meta = getListMeta(clinicId)
    meta.isLoading = true
    meta.error = null

    try {
      const data = await invoiceService(supabase).list(clinicId)
      byClinic.value[clinicId] = data
      meta.loadedAt = Date.now()
      return data
    } catch (err: unknown) {
      meta.error = err instanceof Error ? err.message : 'Failed to load invoices'
      throw err
    } finally {
      meta.isLoading = false
    }
  }

  async function refreshByPatient(
    clinicId: string,
    patientId: string,
  ): Promise<IInvoiceWithRelations[]> {
    const supabase = useSupabase()
    const meta = getByPatientMeta(clinicId, patientId)
    meta.isLoading = true
    meta.error = null

    if (!byPatientByClinic.value[clinicId]) {
      byPatientByClinic.value[clinicId] = {}
    }

    try {
      const data = await invoiceService(supabase).getByPatientId(clinicId, patientId)
      byPatientByClinic.value[clinicId]![patientId] = data
      meta.loadedAt = Date.now()
      return data
    } catch (err: unknown) {
      meta.error = err instanceof Error ? err.message : 'Failed to load invoices'
      throw err
    } finally {
      meta.isLoading = false
    }
  }

  async function fetchList(clinicId: string): Promise<IInvoiceWithRelations[]> {
    return refreshList(clinicId)
  }

  async function fetchByPatient(
    clinicId: string,
    patientId: string,
  ): Promise<IInvoiceWithRelations[]> {
    return refreshByPatient(clinicId, patientId)
  }

  function invalidate(clinicId?: string) {
    if (clinicId) {
      listMetaByClinic.value[clinicId] = createClinicCacheMeta()
      byPatientMetaByClinic.value[clinicId] = {}
      return
    }

    byClinic.value = {}
    byPatientByClinic.value = {}
    listMetaByClinic.value = {}
    byPatientMetaByClinic.value = {}
  }

  function invalidatePatient(clinicId: string, patientId: string) {
    if (byPatientMetaByClinic.value[clinicId]) {
      byPatientMetaByClinic.value[clinicId]![patientId] = createClinicCacheMeta()
    }
  }

  return {
    byClinic,
    byPatientByClinic,
    fetchList,
    refreshList,
    fetchByPatient,
    refreshByPatient,
    invalidate,
    invalidatePatient,
  }
})
