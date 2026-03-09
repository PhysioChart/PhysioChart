import type { IInvoiceWithRelations } from '~/types/models/invoice.types'
import { invoiceService } from '~/services/invoice.service'
import { createClinicCacheMeta, type IClinicCacheMeta } from '~/stores/_shared/clinic-cache'

export const useInvoicesStore = defineStore('invoices', () => {
  const byClinic = ref<Record<string, IInvoiceWithRelations[]>>({})
  const byPatientByClinic = ref<Record<string, Record<string, IInvoiceWithRelations[]>>>({})
  const listMetaByClinic = ref<Record<string, IClinicCacheMeta>>({})
  const byPatientMetaByClinic = ref<Record<string, Record<string, IClinicCacheMeta>>>({})

  function sortInvoices(list: IInvoiceWithRelations[]): IInvoiceWithRelations[] {
    return [...list].sort(
      (left, right) => new Date(right.created_at).getTime() - new Date(left.created_at).getTime(),
    )
  }

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
    const supabase = useSupabaseClient()
    const meta = getListMeta(clinicId)
    meta.isLoading = true
    meta.error = null

    try {
      const data = await invoiceService(supabase).list(clinicId)
      byClinic.value[clinicId] = sortInvoices(data)
      meta.loadedAt = Date.now()
      return byClinic.value[clinicId] ?? []
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
    const supabase = useSupabaseClient()
    const meta = getByPatientMeta(clinicId, patientId)
    meta.isLoading = true
    meta.error = null

    if (!byPatientByClinic.value[clinicId]) {
      byPatientByClinic.value[clinicId] = {}
    }

    try {
      const data = await invoiceService(supabase).getByPatientId(clinicId, patientId)
      byPatientByClinic.value[clinicId]![patientId] = sortInvoices(data)
      meta.loadedAt = Date.now()
      return byPatientByClinic.value[clinicId]?.[patientId] ?? []
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

  function upsertInvoice(clinicId: string, invoice: IInvoiceWithRelations) {
    const clinicInvoices = byClinic.value[clinicId] ?? []
    byClinic.value[clinicId] = sortInvoices([
      invoice,
      ...clinicInvoices.filter((row) => row.id !== invoice.id),
    ])

    const patientBuckets = byPatientByClinic.value[clinicId]
    if (!patientBuckets || !patientBuckets[invoice.patient_id]) return

    const patientInvoices = patientBuckets[invoice.patient_id] ?? []
    patientBuckets[invoice.patient_id] = sortInvoices([
      invoice,
      ...patientInvoices.filter((row) => row.id !== invoice.id),
    ])
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
    upsertInvoice,
  }
})
