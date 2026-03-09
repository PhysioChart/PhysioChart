import { storeToRefs } from 'pinia'
import { toast } from 'vue-sonner'
import type { Tables } from '~/types/database'
import type { ITreatmentPlanWithRelations } from '~/types/models/treatment.types'
import type { ICreateInvoiceResult } from '~/services/invoice.service'
import type { IInvoiceLineItem, IInvoiceWithRelations } from '~/types/models/invoice.types'
import { InvoiceStatus } from '~/enums/invoice.enum'
import { InvoiceErrorCode } from '~/enums/invoice-error.enum'
import { PaymentMethod } from '~/enums/payment.enum'
import { PaymentErrorCode } from '~/enums/payment-error.enum'
import { TreatmentStatus } from '~/enums/treatment.enum'
import { invoiceService } from '~/services/invoice.service'
import { paymentService } from '~/services/payment.service'
import { formatCurrency } from '~/lib/formatters'
import { useInvoicesStore } from '~/stores/invoices.store'
import { usePatientsStore } from '~/stores/patients.store'
import { useTreatmentsStore } from '~/stores/treatments.store'

export const NO_TREATMENT_PLAN_VALUE = '__NO_TREATMENT_PLAN__'

interface IInvoiceDraftItem {
  id: string
  description: string
  quantity: number
  unit_price: number
  total: number
}

interface IInvoiceDraft {
  patient_id: string
  treatment_plan_id: string
  treatmentItem: IInvoiceDraftItem | null
  extraItems: IInvoiceDraftItem[]
  items: IInvoiceDraftItem[]
  notes: string
  due_date: string
}

function createDefaultLineItem(): IInvoiceDraftItem {
  return { id: crypto.randomUUID(), description: '', quantity: 1, unit_price: 0, total: 0 }
}

function createDefaultInvoiceForm(): IInvoiceDraft {
  return {
    patient_id: '',
    treatment_plan_id: NO_TREATMENT_PLAN_VALUE,
    treatmentItem: null,
    extraItems: [],
    items: [createDefaultLineItem()],
    notes: '',
    due_date: '',
  }
}

function roundMoney(value: number): number {
  return Math.round(value * 100) / 100
}

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

function generateIdempotencyKey(prefix: string): string {
  if (typeof crypto !== 'undefined' && typeof crypto.randomUUID === 'function') {
    return `${prefix}-${crypto.randomUUID()}`
  }
  return `${prefix}-${Date.now()}-${Math.random().toString(16).slice(2)}`
}

function toSingleQueryValue(value: string | null | (string | null)[] | undefined): string | null {
  if (Array.isArray(value)) return value[0] ?? null
  return typeof value === 'string' && value ? value : null
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

function getInvoiceErrorMessage(err: unknown): string {
  const raw = err instanceof Error ? err.message : 'Failed to create invoice'

  if (raw.includes(InvoiceErrorCode.INVALID_CLINIC_ID)) {
    return 'Clinic context is invalid. Please reload and try again.'
  }
  if (raw.includes(InvoiceErrorCode.CLINIC_SCOPE_MISMATCH)) {
    return 'You are not allowed to create invoices for this clinic.'
  }
  if (
    raw.includes(InvoiceErrorCode.PATIENT_NOT_FOUND) ||
    raw.includes(InvoiceErrorCode.PATIENT_CLINIC_MISMATCH)
  ) {
    return 'Selected patient is unavailable.'
  }
  if (
    raw.includes(InvoiceErrorCode.TREATMENT_PLAN_NOT_FOUND) ||
    raw.includes(InvoiceErrorCode.TREATMENT_PLAN_CLINIC_MISMATCH) ||
    raw.includes(InvoiceErrorCode.PATIENT_PLAN_MISMATCH)
  ) {
    return 'Selected treatment plan is unavailable.'
  }
  if (raw.includes(InvoiceErrorCode.TREATMENT_PLAN_CANCELLED)) {
    return 'Cancelled treatment plans cannot be linked to invoices.'
  }
  if (raw.includes(InvoiceErrorCode.IDEMPOTENCY_KEY_REQUIRED)) {
    return 'Request key missing. Please try again.'
  }
  if (
    raw.includes(InvoiceErrorCode.INVALID_LINE_ITEMS) ||
    raw.includes(InvoiceErrorCode.LINE_ITEM_DESCRIPTION_REQUIRED) ||
    raw.includes(InvoiceErrorCode.INVALID_LINE_ITEM_QUANTITY) ||
    raw.includes(InvoiceErrorCode.INVALID_LINE_ITEM_PRICE)
  ) {
    return 'Please review line items and try again.'
  }
  if (raw.includes(InvoiceErrorCode.INVALID_INVOICE_TOTAL)) {
    return 'Invoice total must be greater than zero and valid.'
  }
  if (raw.includes(InvoiceErrorCode.INVOICE_ALREADY_CREATED)) {
    return 'Invoice already created.'
  }
  if (raw.includes(InvoiceErrorCode.INVOICE_NUMBER_GENERATION_FAILED)) {
    return 'Unable to generate invoice number. Please try again.'
  }
  if (raw.includes(InvoiceErrorCode.INVOICE_CREATE_RETRY_EXHAUSTED)) {
    return 'Invoice creation failed after multiple attempts. Please try again.'
  }
  if (raw.includes(InvoiceErrorCode.INVALID_CREATE_INVOICE_RESPONSE)) {
    return 'Unexpected response from server. Please try again.'
  }

  return raw || 'Failed to create invoice'
}

export function useBillingPage() {
  const supabase = useSupabaseClient()
  const { activeMembership } = useAuth()
  const route = useRoute()
  const router = useRouter()

  const patientsStore = usePatientsStore()
  const invoicesStore = useInvoicesStore()
  const treatmentsStore = useTreatmentsStore()
  const { dropdownByClinic } = storeToRefs(patientsStore)
  const { byClinic } = storeToRefs(invoicesStore)
  const { byPatientByClinic: treatmentsByPatientByClinic } = storeToRefs(treatmentsStore)

  const isLoading = ref(true)
  const showNewDialog = ref(route.query.action === 'new')
  const filter = ref<'all' | 'pending' | 'paid' | 'overdue'>('all')

  const newInvoice = ref<IInvoiceDraft>(createDefaultInvoiceForm())
  const isSubmitting = ref(false)
  const createInvoiceIdempotencyKey = ref(generateIdempotencyKey('inv'))

  const isLoadingTreatments = ref(false)
  const treatmentLoadToken = ref(0)

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
    if (!activeMembership.value?.clinic_id) return []
    return dropdownByClinic.value[activeMembership.value.clinic_id] ?? []
  })

  const invoices = computed<IInvoiceWithRelations[]>(() => {
    if (!activeMembership.value?.clinic_id) return []
    return byClinic.value[activeMembership.value.clinic_id] ?? []
  })

  const hasSelectedPatient = computed(() => !!newInvoice.value.patient_id)

  const availableTreatmentPlans = computed<ITreatmentPlanWithRelations[]>(() => {
    if (!activeMembership.value?.clinic_id || !newInvoice.value.patient_id) return []

    const plans =
      treatmentsByPatientByClinic.value[activeMembership.value.clinic_id]?.[
        newInvoice.value.patient_id
      ] ?? []

    return plans.filter(
      (plan) => plan.status === TreatmentStatus.ACTIVE || plan.status === TreatmentStatus.COMPLETED,
    )
  })

  const selectedTreatmentPlan = computed<ITreatmentPlanWithRelations | null>(() => {
    const treatmentPlanId = newInvoice.value.treatment_plan_id
    if (!treatmentPlanId || treatmentPlanId === NO_TREATMENT_PLAN_VALUE) return null
    return availableTreatmentPlans.value.find((plan) => plan.id === treatmentPlanId) ?? null
  })

  const shouldShowTreatmentLoading = computed(
    () => hasSelectedPatient.value && isLoadingTreatments.value,
  )

  const shouldShowTreatmentSelector = computed(
    () =>
      hasSelectedPatient.value &&
      !isLoadingTreatments.value &&
      availableTreatmentPlans.value.length > 0,
  )

  const shouldShowNoEligibleTreatments = computed(
    () =>
      hasSelectedPatient.value &&
      !isLoadingTreatments.value &&
      availableTreatmentPlans.value.length === 0,
  )

  const treatmentSelectionHelpText = computed(() => {
    if (!hasSelectedPatient.value) return ''
    if (!selectedTreatmentPlan.value) {
      return 'Selecting a treatment will prefill line items from its pricing.'
    }

    const packagePrice = Number(selectedTreatmentPlan.value.package_price)
    if (Number.isFinite(packagePrice) && packagePrice > 0) {
      return `Prefill uses package price (${formatCurrency(packagePrice)}).`
    }

    const sessionPrice = Number(selectedTreatmentPlan.value.price_per_session)
    if (Number.isFinite(sessionPrice) && sessionPrice > 0) {
      return `Prefill uses per-session price (${formatCurrency(sessionPrice)}).`
    }

    return 'Selected treatment has no pricing. Add line items manually.'
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
    allInvoiceItems.value.reduce((sum, item) => sum + Number(item.total), 0),
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
    if (!activeMembership.value?.clinic_id) return
    isLoading.value = true

    try {
      await invoicesStore.fetchList(activeMembership.value.clinic_id)
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : 'Failed to load invoices'
      toast.error(message)
    } finally {
      isLoading.value = false
    }
  }

  async function loadPatients() {
    if (!activeMembership.value?.clinic_id || dropdownsLoaded) return
    await patientsStore.fetchDropdown(activeMembership.value.clinic_id)
    dropdownsLoaded = true
  }

  async function loadTreatmentsForPatient(patientId: string) {
    if (!activeMembership.value?.clinic_id || !patientId) return

    const token = ++treatmentLoadToken.value
    isLoadingTreatments.value = true

    try {
      await treatmentsStore.fetchByPatient(activeMembership.value.clinic_id, patientId)
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : 'Failed to load treatment plans'
      toast.error(message)
    } finally {
      if (treatmentLoadToken.value === token) {
        isLoadingTreatments.value = false
      }
    }
  }

  function clearCreateInvoiceQueryParams() {
    const query = { ...route.query }
    delete query.action
    delete query.patientId
    delete query.treatmentPlanId
    void router.replace({ query })
  }

  function resetInvoiceForm() {
    treatmentLoadToken.value += 1
    isLoadingTreatments.value = false
    createInvoiceIdempotencyKey.value = generateIdempotencyKey('inv')
    newInvoice.value = createDefaultInvoiceForm()
  }

  async function setPatientSelection(patientId: string) {
    newInvoice.value.patient_id = patientId
    newInvoice.value.treatment_plan_id = NO_TREATMENT_PLAN_VALUE
    newInvoice.value.treatmentItem = null
    newInvoice.value.extraItems = []
    newInvoice.value.items = [createDefaultLineItem()]

    if (!patientId) return
    await loadTreatmentsForPatient(patientId)
  }

  function buildTreatmentItem(plan: ITreatmentPlanWithRelations): IInvoiceDraftItem | null {
    const packagePrice = Number(plan.package_price)
    if (Number.isFinite(packagePrice) && packagePrice > 0) {
      const unitPrice = roundMoney(packagePrice)
      return {
        id: crypto.randomUUID(),
        description: `${plan.name} (Package)`,
        quantity: 1,
        unit_price: unitPrice,
        total: unitPrice,
      }
    }

    const pricePerSession = Number(plan.price_per_session)
    if (Number.isFinite(pricePerSession) && pricePerSession > 0) {
      const unitPrice = roundMoney(pricePerSession)
      return {
        id: crypto.randomUUID(),
        description: `${plan.name} (Session)`,
        quantity: 1,
        unit_price: unitPrice,
        total: unitPrice,
      }
    }

    return null
  }

  const isPerSessionPlan = computed(() => {
    if (!selectedTreatmentPlan.value) return false
    const packagePrice = Number(selectedTreatmentPlan.value.package_price)
    if (Number.isFinite(packagePrice) && packagePrice > 0) return false
    const sessionPrice = Number(selectedTreatmentPlan.value.price_per_session)
    return Number.isFinite(sessionPrice) && sessionPrice > 0
  })

  const hasTreatmentItem = computed(() => !!newInvoice.value.treatmentItem)

  const allInvoiceItems = computed<IInvoiceDraftItem[]>(() => {
    const items: IInvoiceDraftItem[] = []
    if (newInvoice.value.treatmentItem) {
      items.push(newInvoice.value.treatmentItem)
    }
    if (hasTreatmentItem.value) {
      items.push(...newInvoice.value.extraItems)
    } else {
      items.push(...newInvoice.value.items)
    }
    return items
  })

  function handleTreatmentSelection(value: unknown) {
    const treatmentPlanId = typeof value === 'string' ? value : null

    if (!treatmentPlanId || treatmentPlanId === NO_TREATMENT_PLAN_VALUE) {
      newInvoice.value.treatment_plan_id = NO_TREATMENT_PLAN_VALUE
      newInvoice.value.treatmentItem = null
      newInvoice.value.extraItems = []
      newInvoice.value.items = [createDefaultLineItem()]
      return
    }

    const plan = availableTreatmentPlans.value.find((row) => row.id === treatmentPlanId)
    if (!plan) {
      newInvoice.value.treatment_plan_id = NO_TREATMENT_PLAN_VALUE
      newInvoice.value.treatmentItem = null
      newInvoice.value.extraItems = []
      newInvoice.value.items = [createDefaultLineItem()]
      return
    }

    newInvoice.value.treatment_plan_id = plan.id
    const treatmentItem = buildTreatmentItem(plan)
    newInvoice.value.treatmentItem = treatmentItem
    newInvoice.value.extraItems = []
    newInvoice.value.items = treatmentItem ? [] : [createDefaultLineItem()]
  }

  function handlePatientSelection(value: unknown) {
    const patientId = typeof value === 'string' ? value : ''
    void setPatientSelection(patientId)
  }

  function validateInvoiceItems(items: IInvoiceDraftItem[]): boolean {
    if (items.length === 0) {
      toast.error('Add at least one line item.')
      return false
    }

    for (const item of items) {
      if (!item.description.trim()) {
        toast.error('Line item description is required.')
        return false
      }
      if (!Number.isInteger(item.quantity) || item.quantity < 1) {
        toast.error('Line item quantity must be a whole number greater than zero.')
        return false
      }
      if (!Number.isFinite(item.unit_price) || item.unit_price < 0) {
        toast.error('Line item price must be zero or more.')
        return false
      }
      if (roundMoney(item.unit_price) !== item.unit_price) {
        toast.error('Line item price can have at most 2 decimal places.')
        return false
      }
    }

    if (roundMoney(items.reduce((sum, item) => sum + item.quantity * item.unit_price, 0)) <= 0) {
      toast.error('Invoice total must be greater than zero.')
      return false
    }

    return true
  }

  async function initializeCreateInvoiceDialog() {
    if (!showNewDialog.value || !activeMembership.value?.clinic_id) return

    try {
      const action = toSingleQueryValue(route.query.action)
      const patientIdParam = toSingleQueryValue(route.query.patientId)
      const treatmentPlanIdParam = toSingleQueryValue(route.query.treatmentPlanId)
      const hasCreateQuery = action === 'new' || !!patientIdParam || !!treatmentPlanIdParam

      if (hasCreateQuery) {
        clearCreateInvoiceQueryParams()
      }

      await loadPatients()

      if (patientIdParam) {
        await setPatientSelection(patientIdParam)
      }

      if (patientIdParam && treatmentPlanIdParam) {
        const linkedPlan = availableTreatmentPlans.value.find(
          (plan) => plan.id === treatmentPlanIdParam,
        )
        if (linkedPlan) {
          handleTreatmentSelection(linkedPlan.id)
        } else {
          toast.error('Linked treatment plan is unavailable. Please select another plan.')
        }
      }
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : 'Failed to initialize invoice form'
      toast.error(message)
      showNewDialog.value = false
    }
  }

  async function createInvoice() {
    if (!activeMembership.value?.clinic_id || !newInvoice.value.patient_id) return
    const itemsToSubmit = allInvoiceItems.value
    if (!validateInvoiceItems(itemsToSubmit)) return

    isSubmitting.value = true

    try {
      const normalizedItems: IInvoiceLineItem[] = itemsToSubmit.map((item) => {
        const quantity = Math.trunc(item.quantity)
        const unitPrice = roundMoney(item.unit_price)
        return {
          description: item.description.trim(),
          quantity,
          unit_price: unitPrice,
          total: roundMoney(quantity * unitPrice),
        }
      })

      const result: ICreateInvoiceResult = await invoiceService(supabase).createInvoice({
        clinicId: activeMembership.value.clinic_id,
        patientId: newInvoice.value.patient_id,
        treatmentPlanId:
          newInvoice.value.treatment_plan_id === NO_TREATMENT_PLAN_VALUE
            ? null
            : newInvoice.value.treatment_plan_id,
        lineItems: normalizedItems,
        dueDate: newInvoice.value.due_date || null,
        notes: newInvoice.value.notes.trim() || null,
        idempotencyKey: createInvoiceIdempotencyKey.value,
      })

      invoicesStore.upsertInvoice(activeMembership.value.clinic_id, result.invoice)
      toast.success(result.alreadyCreated ? 'Invoice already created.' : 'Invoice created')
      showNewDialog.value = false
    } catch (err: unknown) {
      toast.error(getInvoiceErrorMessage(err))
    } finally {
      isSubmitting.value = false
    }
  }

  async function loadPaymentHistory(invoiceId: string) {
    if (!activeMembership.value?.clinic_id) return

    paymentHistoryLoadingByInvoice.value[invoiceId] = true
    try {
      const rows = await paymentService(supabase).listForInvoice(
        activeMembership.value.clinic_id,
        invoiceId,
      )
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
    if (
      !activeMembership.value?.clinic_id ||
      !recordPaymentInvoiceId.value ||
      !selectedInvoiceForPayment.value
    )
      return

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
        clinicId: activeMembership.value.clinic_id,
        invoiceId: recordPaymentInvoiceId.value,
        amount,
        method: paymentForm.value.method,
        paidAt: toLocalNoonIso(paymentForm.value.date),
        referenceNote: referenceNote || null,
        idempotencyKey: generateIdempotencyKey('payment'),
      })

      appendPaymentToHistory(recordPaymentInvoiceId.value, {
        id: result.payment.id,
        clinic_id: activeMembership.value.clinic_id,
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

  function updateTreatmentItemQty(qty: number) {
    const item = newInvoice.value.treatmentItem
    if (!item) return
    const clampedQty = Math.max(1, Math.trunc(qty))
    newInvoice.value.treatmentItem = {
      ...item,
      quantity: clampedQty,
      total: roundMoney(clampedQty * item.unit_price),
    }
  }

  function updateLineItem(index: number) {
    const items = hasTreatmentItem.value ? newInvoice.value.extraItems : newInvoice.value.items
    const item = items[index]
    if (!item) return
    const quantity = Number(item.quantity)
    const unitPrice = Number(item.unit_price)
    item.total = roundMoney(
      (Number.isFinite(quantity) ? quantity : 0) * (Number.isFinite(unitPrice) ? unitPrice : 0),
    )
  }

  function addLineItem() {
    if (hasTreatmentItem.value) {
      newInvoice.value.extraItems.push(createDefaultLineItem())
    } else {
      newInvoice.value.items.push(createDefaultLineItem())
    }
  }

  function removeLineItem(index: number) {
    if (hasTreatmentItem.value) {
      newInvoice.value.extraItems.splice(index, 1)
    } else if (newInvoice.value.items.length > 1) {
      newInvoice.value.items.splice(index, 1)
    }
  }

  function openDialog() {
    if (showNewDialog.value) return
    showNewDialog.value = true
  }

  function getTreatmentPlanOptionLabel(plan: ITreatmentPlanWithRelations): string {
    const statusLabel =
      plan.status === TreatmentStatus.ACTIVE
        ? 'Active'
        : plan.status === TreatmentStatus.COMPLETED
          ? 'Completed'
          : 'Cancelled'
    const treatmentTypeLabel = plan.treatment_type ? ` • ${plan.treatment_type}` : ''
    return `${plan.name}${treatmentTypeLabel} (${statusLabel})`
  }

  watch(showNewDialog, (isOpen) => {
    if (isOpen) {
      void initializeCreateInvoiceDialog()
      return
    }
    resetInvoiceForm()
  })

  async function initializeFromQueryParams() {
    const expandInvoiceParam = toSingleQueryValue(route.query.expandInvoice)

    if (expandInvoiceParam) {
      void router.replace({ query: { ...route.query, expandInvoice: undefined } })

      await loadInvoices()

      const invoice = invoices.value.find((inv) => inv.id === expandInvoiceParam)
      if (invoice) {
        expandedInvoiceId.value = expandInvoiceParam
        await loadPaymentHistory(expandInvoiceParam)
        openRecordPaymentDialog(expandInvoiceParam)
      }
      return
    }

    await loadInvoices()
  }

  onMounted(() => {
    void initializeFromQueryParams()

    if (showNewDialog.value) {
      void initializeCreateInvoiceDialog()
    }
  })

  return {
    NO_TREATMENT_PLAN_VALUE,
    isLoading,
    showNewDialog,
    filter,
    patients,
    filteredInvoices,
    totalOutstanding,
    newInvoice,
    isSubmitting,
    invoiceTotal,
    isLoadingTreatments,
    isPerSessionPlan,
    hasTreatmentItem,
    allInvoiceItems,
    availableTreatmentPlans,
    shouldShowTreatmentLoading,
    shouldShowTreatmentSelector,
    shouldShowNoEligibleTreatments,
    treatmentSelectionHelpText,
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
    handlePatientSelection,
    handleTreatmentSelection,
    updateTreatmentItemQty,
    updateLineItem,
    addLineItem,
    removeLineItem,
    toggleInvoiceExpanded,
    openRecordPaymentDialog,
    recordPayment,
    getTreatmentPlanOptionLabel,
  }
}
