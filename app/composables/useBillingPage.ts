import { storeToRefs } from 'pinia'
import { toast } from 'vue-sonner'
import type { Tables } from '~/types/database'
import type { IInvoiceWithRelations } from '~/types/models/invoice.types'
import { InvoiceStatus } from '~/enums/invoice.enum'
import { PaymentMethod } from '~/enums/payment.enum'
import { PaymentErrorCode } from '~/enums/payment-error.enum'
import { invoiceService } from '~/services/invoice.service'
import { paymentService } from '~/services/payment.service'
import { useInvoicesStore } from '~/stores/invoices.store'
import { usePatientsStore } from '~/stores/patients.store'

function toDateInputValue(date: Date = new Date()): string {
  const year = date.getFullYear()
  const month = String(date.getMonth() + 1).padStart(2, '0')
  const day = String(date.getDate()).padStart(2, '0')
  return `${year}-${month}-${day}`
}

function toLocalNoonIso(dateInput: string): string {
  const localNoon = new Date(`${dateInput}T12:00:00`)
  return localNoon.toISOString()
}

function generateIdempotencyKey(): string {
  if (typeof crypto !== 'undefined' && typeof crypto.randomUUID === 'function') {
    return crypto.randomUUID()
  }
  return `payment-${Date.now()}-${Math.random().toString(16).slice(2)}`
}

function getPaymentErrorMessage(err: unknown): string {
  const raw = err instanceof Error ? err.message : 'Failed to record payment'

  if (raw.includes(PaymentErrorCode.INVOICE_NOT_FOUND)) {
    return 'Invoice not found.'
  }
  if (raw.includes(PaymentErrorCode.INVOICE_STATUS_INVALID)) {
    return 'Payments can be recorded only for sent, overdue, or partially paid invoices.'
  }
  if (raw.includes(PaymentErrorCode.INVALID_AMOUNT)) {
    return 'Amount must be greater than zero and use at most 2 decimal places.'
  }
  if (raw.includes(PaymentErrorCode.INVALID_INVOICE_TOTAL)) {
    return 'Invoice total must be greater than zero before recording a payment.'
  }
  if (raw.includes(PaymentErrorCode.PAYMENT_EXCEEDS_OUTSTANDING)) {
    return 'Payment amount exceeds the outstanding balance.'
  }
  if (raw.includes(PaymentErrorCode.REFERENCE_NOTE_TOO_LONG)) {
    return 'Reference note must be 280 characters or less.'
  }
  if (raw.includes(PaymentErrorCode.INVOICE_TOTAL_BELOW_PAID)) {
    return 'Invoice total cannot be less than amount already paid.'
  }

  return raw || 'Failed to record payment'
}

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

  const newInvoice = ref({
    patient_id: '',
    items: [{ description: '', quantity: 1, unit_price: 0, total: 0 }],
    notes: '',
    due_date: '',
  })
  const isSubmitting = ref(false)

  const expandedInvoiceId = ref<string | null>(null)
  const paymentHistoryByInvoice = ref<Record<string, Tables<'payments'>[]>>({})
  const paymentHistoryLoadingByInvoice = ref<Record<string, boolean>>({})

  const showRecordPaymentDialog = ref(false)
  const recordPaymentInvoiceId = ref<string | null>(null)
  const paymentForm = ref({
    amount: 0,
    date: toDateInputValue(),
    method: PaymentMethod.CASH as Tables<'payments'>['method'],
    reference_note: '',
  })
  const isRecordingPayment = ref(false)

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

  const patients = computed(() => {
    if (!profile.value) return []
    return dropdownByClinic.value[profile.value.clinic_id] ?? []
  })

  const invoices = computed<IInvoiceWithRelations[]>(() => {
    if (!profile.value) return []
    return byClinic.value[profile.value.clinic_id] ?? []
  })

  const selectedInvoiceForPayment = computed(() => {
    if (!recordPaymentInvoiceId.value) return null
    return invoices.value.find((invoice) => invoice.id === recordPaymentInvoiceId.value) ?? null
  })

  const selectedInvoiceOutstanding = computed(() => {
    if (!selectedInvoiceForPayment.value) return 0
    return Math.max(
      Number(selectedInvoiceForPayment.value.total) -
        Number(selectedInvoiceForPayment.value.amount_paid),
      0,
    )
  })

  const filteredInvoices = computed(() => {
    if (filter.value === 'all') return invoices.value
    if (filter.value === 'pending') {
      return invoices.value.filter((i) => PENDING_STATUSES.includes(i.status))
    }
    if (filter.value === 'paid') {
      return invoices.value.filter((i) => i.status === InvoiceStatus.PAID)
    }
    if (filter.value === 'overdue') {
      return invoices.value.filter((i) => i.status === InvoiceStatus.OVERDUE)
    }
    return invoices.value
  })

  const totalOutstanding = computed(() => {
    return invoices.value
      .filter((i) => OUTSTANDING_STATUSES.includes(i.status))
      .reduce((sum, i) => sum + (Number(i.total) - Number(i.amount_paid)), 0)
  })

  const invoiceTotal = computed(() =>
    newInvoice.value.items.reduce((sum, item) => sum + item.total, 0),
  )

  const expandedInvoicePayments = computed(() => {
    if (!expandedInvoiceId.value) return []
    return paymentHistoryByInvoice.value[expandedInvoiceId.value] ?? []
  })

  const isExpandedInvoicePaymentsLoading = computed(() => {
    if (!expandedInvoiceId.value) return false
    return paymentHistoryLoadingByInvoice.value[expandedInvoiceId.value] ?? false
  })

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

  function applyRoutePatientSelection() {
    const patientId = route.query.patientId
    if (typeof patientId !== 'string' || !patientId) return
    newInvoice.value.patient_id = patientId
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
        status: InvoiceStatus.SENT,
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

  async function loadPaymentHistory(invoiceId: string) {
    if (!profile.value) return

    paymentHistoryLoadingByInvoice.value[invoiceId] = true
    try {
      const rows = await paymentService(supabase).listForInvoice(profile.value.clinic_id, invoiceId)
      paymentHistoryByInvoice.value[invoiceId] = rows
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : 'Failed to load payment history'
      toast.error(message)
    } finally {
      paymentHistoryLoadingByInvoice.value[invoiceId] = false
    }
  }

  async function toggleInvoiceExpanded(invoiceId: string) {
    if (expandedInvoiceId.value === invoiceId) {
      expandedInvoiceId.value = null
      return
    }

    expandedInvoiceId.value = invoiceId
    if (!paymentHistoryByInvoice.value[invoiceId]) {
      await loadPaymentHistory(invoiceId)
    }
  }

  function openRecordPaymentDialog(invoiceId: string) {
    const invoice = invoices.value.find((row) => row.id === invoiceId)
    if (!invoice) return

    const outstanding = Math.max(Number(invoice.total) - Number(invoice.amount_paid), 0)
    if (outstanding <= 0) {
      toast.error('This invoice has no outstanding balance.')
      return
    }

    recordPaymentInvoiceId.value = invoiceId
    paymentForm.value = {
      amount: outstanding,
      date: toDateInputValue(),
      method: PaymentMethod.CASH,
      reference_note: '',
    }
    showRecordPaymentDialog.value = true
  }

  function appendPaymentToHistory(invoiceId: string, payment: Tables<'payments'>) {
    const current = paymentHistoryByInvoice.value[invoiceId] ?? []
    if (current.some((row) => row.id === payment.id)) return
    paymentHistoryByInvoice.value[invoiceId] = [payment, ...current]
  }

  async function recordPayment() {
    if (!profile.value || !recordPaymentInvoiceId.value || !selectedInvoiceForPayment.value) return

    const amount = Number(paymentForm.value.amount)
    const outstanding = selectedInvoiceOutstanding.value

    if (!Number.isFinite(amount) || amount <= 0) {
      toast.error('Enter a valid payment amount.')
      return
    }

    if (Math.round(amount * 100) !== amount * 100) {
      toast.error('Amount can have at most 2 decimal places.')
      return
    }

    if (amount > outstanding) {
      toast.error('Payment amount exceeds the outstanding balance.')
      return
    }

    if (!paymentForm.value.date) {
      toast.error('Payment date is required.')
      return
    }

    const referenceNote = paymentForm.value.reference_note.trim()
    if (referenceNote.length > 280) {
      toast.error('Reference note must be 280 characters or less.')
      return
    }

    isRecordingPayment.value = true

    try {
      const result = await paymentService(supabase).recordForInvoice({
        clinicId: profile.value.clinic_id,
        invoiceId: recordPaymentInvoiceId.value,
        amount,
        method: paymentForm.value.method,
        paidAt: toLocalNoonIso(paymentForm.value.date),
        referenceNote: referenceNote || null,
        idempotencyKey: generateIdempotencyKey(),
      })

      appendPaymentToHistory(recordPaymentInvoiceId.value, {
        id: result.payment.id,
        clinic_id: profile.value.clinic_id,
        invoice_id: result.payment.invoiceId,
        amount: result.payment.amount,
        method: result.payment.method,
        notes: result.payment.notes,
        paid_at: result.payment.paidAt,
        created_at: result.payment.createdAt,
        recorded_by: result.payment.recordedBy,
        idempotency_key: null,
      })

      toast.success(result.alreadyRecorded ? 'Payment already recorded.' : 'Payment recorded')

      await loadInvoices()
      void loadPaymentHistory(recordPaymentInvoiceId.value)
      showRecordPaymentDialog.value = false
    } catch (err: unknown) {
      toast.error(getPaymentErrorMessage(err))
    } finally {
      isRecordingPayment.value = false
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
    applyRoutePatientSelection()
    showNewDialog.value = true
  }

  watch(showNewDialog, (isOpen) => {
    if (isOpen) {
      void loadPatients()
      applyRoutePatientSelection()
    }
  })

  onMounted(() => {
    void loadInvoices()

    if (showNewDialog.value) {
      void loadPatients()
      applyRoutePatientSelection()
    }
  })

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
    expandedInvoiceId,
    expandedInvoicePayments,
    isExpandedInvoicePaymentsLoading,
    showRecordPaymentDialog,
    selectedInvoiceForPayment,
    selectedInvoiceOutstanding,
    paymentForm,
    isRecordingPayment,
    openDialog,
    createInvoice,
    updateLineItem,
    addLineItem,
    removeLineItem,
    toggleInvoiceExpanded,
    openRecordPaymentDialog,
    recordPayment,
  }
}
