import { storeToRefs } from 'pinia'
import { toast } from 'vue-sonner'
import type { IInvoiceWithRelations } from '~/types/models/invoice.types'
import { InvoiceStatus } from '~/enums/invoice.enum'
import { invoiceService } from '~/services/invoice.service'
import { useInvoicesStore } from '~/stores/invoices.store'
import { usePatientsStore } from '~/stores/patients.store'

export function useBillingPage() {
  const supabase = useSupabase()
  const { profile } = useAuth()
  const route = useRoute()

  const patientsStore = usePatientsStore()
  const invoicesStore = useInvoicesStore()
  const { dropdownByClinic } = storeToRefs(patientsStore)
  const { byClinic } = storeToRefs(invoicesStore)

  const isLoading = ref(true)
  const showNewDialog = ref(route.query.action === 'new')
  const filter = ref<'all' | 'pending' | 'paid' | 'overdue'>('all')

  const patients = computed(() => {
    if (!profile.value) return []
    return dropdownByClinic.value[profile.value.clinic_id] ?? []
  })

  const invoices = computed<IInvoiceWithRelations[]>(() => {
    if (!profile.value) return []
    return byClinic.value[profile.value.clinic_id] ?? []
  })

  const newInvoice = ref({
    patient_id: '',
    items: [{ description: '', quantity: 1, unit_price: 0, total: 0 }],
    notes: '',
    due_date: '',
  })
  const isSubmitting = ref(false)

  let dropdownsLoaded = false

  const PENDING_STATUSES: InvoiceStatus[] = [
    InvoiceStatus.DRAFT,
    InvoiceStatus.SENT,
    InvoiceStatus.PARTIALLY_PAID,
  ]

  const OUTSTANDING_STATUSES: InvoiceStatus[] = [
    InvoiceStatus.DRAFT,
    InvoiceStatus.SENT,
    InvoiceStatus.PARTIALLY_PAID,
    InvoiceStatus.OVERDUE,
  ]

  const filteredInvoices = computed(() => {
    if (filter.value === 'all') return invoices.value
    if (filter.value === 'pending')
      return invoices.value.filter((i) => PENDING_STATUSES.includes(i.status))
    if (filter.value === 'paid')
      return invoices.value.filter((i) => i.status === InvoiceStatus.PAID)
    if (filter.value === 'overdue')
      return invoices.value.filter((i) => i.status === InvoiceStatus.OVERDUE)
    return invoices.value
  })

  const totalOutstanding = computed(() => {
    return invoices.value
      .filter((i) => OUTSTANDING_STATUSES.includes(i.status))
      .reduce((sum, i) => sum + (i.total - i.amount_paid), 0)
  })

  const invoiceTotal = computed(() =>
    newInvoice.value.items.reduce((sum, item) => sum + item.total, 0),
  )

  async function loadInvoices() {
    if (!profile.value) return
    isLoading.value = true

    try {
      await invoicesStore.fetchList(profile.value.clinic_id)
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : 'Failed to load invoices'
      toast.error(message)
    } finally {
      isLoading.value = false
    }
  }

  async function loadPatients() {
    if (!profile.value || dropdownsLoaded) return

    try {
      await patientsStore.fetchDropdown(profile.value.clinic_id)
      dropdownsLoaded = true
    } catch {
      // Allow retry on next dialog open
    }
  }

  async function createInvoice() {
    if (!profile.value || !newInvoice.value.patient_id) return
    isSubmitting.value = true

    try {
      const service = invoiceService(supabase)
      const invoiceNumber = await service.nextInvoiceNumber(profile.value.clinic_id)

      await service.create({
        clinic_id: profile.value.clinic_id,
        patient_id: newInvoice.value.patient_id,
        invoice_number: invoiceNumber,
        line_items: newInvoice.value.items,
        subtotal: invoiceTotal.value,
        total: invoiceTotal.value,
        due_date: newInvoice.value.due_date || null,
        notes: newInvoice.value.notes || null,
      })

      toast.success('Invoice created')
      invoicesStore.invalidate(profile.value.clinic_id)
      await loadInvoices()
      showNewDialog.value = false
      newInvoice.value = {
        patient_id: '',
        items: [{ description: '', quantity: 1, unit_price: 0, total: 0 }],
        notes: '',
        due_date: '',
      }
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : 'Failed to create invoice'
      toast.error(message)
    } finally {
      isSubmitting.value = false
    }
  }

  function updateLineItem(index: number) {
    const item = newInvoice.value.items[index]
    if (!item) return
    item.total = item.quantity * item.unit_price
  }

  function addLineItem() {
    newInvoice.value.items.push({ description: '', quantity: 1, unit_price: 0, total: 0 })
  }

  function removeLineItem(index: number) {
    if (newInvoice.value.items.length > 1) {
      newInvoice.value.items.splice(index, 1)
    }
  }

  function openDialog() {
    void loadPatients()
    showNewDialog.value = true
  }

  watch(showNewDialog, (isOpen) => {
    if (isOpen) {
      void loadPatients()
    }
  })

  onMounted(loadInvoices)

  return {
    isLoading,
    showNewDialog,
    filter,
    patients,
    filteredInvoices,
    totalOutstanding,
    newInvoice,
    isSubmitting,
    invoiceTotal,
    openDialog,
    createInvoice,
    updateLineItem,
    addLineItem,
    removeLineItem,
  }
}
