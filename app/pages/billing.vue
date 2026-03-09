<template>
  <div class="space-y-4">
    <BillingHeader @new-invoice="showCreateDialog = true" />
    <BillingOutstandingCard :total-outstanding="totalOutstanding" />
    <BillingFilterBar v-model="filter" />
    <BillingInvoiceTable
      :invoices="filteredInvoices"
      :is-loading="isLoading"
      :filter="filter"
      :expanded-invoice-id="expandedInvoiceId"
      :expanded-invoice-payments="expandedInvoicePayments"
      :is-expanded-invoice-payments-loading="isExpandedInvoicePaymentsLoading"
      @toggle-expand="toggleExpand"
      @record-payment="openRecordPaymentDialog"
      @new-invoice="showCreateDialog = true"
    />

    <BillingCreateInvoiceDialog
      ref="createDialogRef"
      :open="showCreateDialog"
      :initial-patient-id="initialPatientId"
      :initial-treatment-plan-id="initialTreatmentPlanId"
      @update:open="showCreateDialog = $event"
      @submit="handleCreateInvoice"
    />

    <BillingRecordPaymentDialog
      ref="paymentDialogRef"
      :open="showRecordPaymentDialog"
      :invoice="selectedInvoiceForPayment"
      @update:open="showRecordPaymentDialog = $event"
      @submit="handleRecordPayment"
    />
  </div>
</template>

<script setup lang="ts">
import { storeToRefs } from 'pinia'
import { toast } from 'vue-sonner'
import type { Tables } from '~/types/database'
import type { IInvoiceWithRelations } from '~/types/models/invoice.types'
import { InvoiceStatus } from '~/enums/invoice.enum'
import { invoiceService, type ICreateInvoiceResult } from '~/services/invoice.service'
import { paymentService } from '~/services/payment.service'
import { toLocalNoonIso } from '~/lib/date'
import { getInvoiceErrorMessage, getPaymentErrorMessage } from '~/lib/error-messages'
import { useInvoicesStore } from '~/stores/invoices.store'
import BillingHeader from '~/features/billing/components/BillingHeader.vue'
import BillingOutstandingCard from '~/features/billing/components/BillingOutstandingCard.vue'
import BillingFilterBar from '~/features/billing/components/BillingFilterBar.vue'
import BillingInvoiceTable from '~/features/billing/components/BillingInvoiceTable.vue'
import BillingCreateInvoiceDialog from '~/features/billing/components/BillingCreateInvoiceDialog.vue'
import BillingRecordPaymentDialog from '~/features/billing/components/BillingRecordPaymentDialog.vue'

definePageMeta({ layout: 'protected' })

useHead({ title: 'Billing' })

const supabase = useSupabaseClient()
const { activeMembership } = useAuth()
const route = useRoute()
const router = useRouter()
const invoicesStore = useInvoicesStore()
const { byClinic } = storeToRefs(invoicesStore)

// --- State ---

const isLoading = ref(true)
const filter = ref<'all' | 'pending' | 'paid' | 'overdue'>('all')
const showCreateDialog = ref(route.query.action === 'new')
const showRecordPaymentDialog = ref(false)
const recordPaymentInvoiceId = ref<string | null>(null)
const expandedInvoiceId = ref<string | null>(null)
const paymentHistoryByInvoice = ref<Record<string, Tables<'payments'>[]>>({})
const paymentHistoryLoadingByInvoice = ref<Record<string, boolean>>({})

const createDialogRef = ref<InstanceType<typeof BillingCreateInvoiceDialog> | null>(null)
const paymentDialogRef = ref<InstanceType<typeof BillingRecordPaymentDialog> | null>(null)

// One-shot deep-link params (consumed on mount, not persisted)
const initialPatientId = toSingleQueryValue(route.query.patientId)
const initialTreatmentPlanId = toSingleQueryValue(route.query.treatmentPlanId)

// --- Constants ---

const PENDING_STATUSES: InvoiceStatus[] = [
  InvoiceStatus.DRAFT,
  InvoiceStatus.SENT,
  InvoiceStatus.PARTIALLY_PAID,
]
const OUTSTANDING_STATUSES: InvoiceStatus[] = [...PENDING_STATUSES, InvoiceStatus.OVERDUE]

// --- Computed ---

const invoices = computed<IInvoiceWithRelations[]>(() => {
  if (!activeMembership.value?.clinic_id) return []
  return byClinic.value[activeMembership.value.clinic_id] ?? []
})

const filteredInvoices = computed(() => {
  if (filter.value === 'all') return invoices.value
  if (filter.value === 'pending')
    return invoices.value.filter((i) => PENDING_STATUSES.includes(i.status))
  if (filter.value === 'paid') return invoices.value.filter((i) => i.status === InvoiceStatus.PAID)
  if (filter.value === 'overdue')
    return invoices.value.filter((i) => i.status === InvoiceStatus.OVERDUE)
  return invoices.value
})

const totalOutstanding = computed(() =>
  invoices.value
    .filter((i) => OUTSTANDING_STATUSES.includes(i.status))
    .reduce((sum, i) => sum + (Number(i.total) - Number(i.amount_paid)), 0),
)

const selectedInvoiceForPayment = computed(() => {
  if (!recordPaymentInvoiceId.value) return null
  return invoices.value.find((inv) => inv.id === recordPaymentInvoiceId.value) ?? null
})

const expandedInvoicePayments = computed(() => {
  if (!expandedInvoiceId.value) return []
  return paymentHistoryByInvoice.value[expandedInvoiceId.value] ?? []
})

const isExpandedInvoicePaymentsLoading = computed(() => {
  if (!expandedInvoiceId.value) return false
  return paymentHistoryLoadingByInvoice.value[expandedInvoiceId.value] ?? false
})

// --- Data Loading ---

async function loadInvoices() {
  if (!activeMembership.value?.clinic_id) return
  isLoading.value = true
  try {
    await invoicesStore.fetchList(activeMembership.value.clinic_id)
  } catch (err: unknown) {
    toast.error(err instanceof Error ? err.message : 'Failed to load invoices')
  } finally {
    isLoading.value = false
  }
}

async function loadPaymentHistory(invoiceId: string) {
  if (!activeMembership.value?.clinic_id) return
  paymentHistoryLoadingByInvoice.value[invoiceId] = true
  try {
    paymentHistoryByInvoice.value[invoiceId] = await paymentService(supabase).listForInvoice(
      activeMembership.value.clinic_id,
      invoiceId,
    )
  } catch (err: unknown) {
    toast.error(err instanceof Error ? err.message : 'Failed to load payment history')
  } finally {
    paymentHistoryLoadingByInvoice.value[invoiceId] = false
  }
}

// --- Interactions ---

async function toggleExpand(invoiceId: string) {
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
  showRecordPaymentDialog.value = true
}

// --- Write Orchestration ---

async function handleCreateInvoice(payload: {
  patientId: string
  treatmentPlanId: string | null
  lineItems: Array<{ description: string; quantity: number; unit_price: number; total: number }>
  dueDate: string | null
  notes: string | null
  idempotencyKey: string
}) {
  if (!activeMembership.value?.clinic_id) return
  try {
    const result: ICreateInvoiceResult = await invoiceService(supabase).createInvoice({
      clinicId: activeMembership.value.clinic_id,
      patientId: payload.patientId,
      treatmentPlanId: payload.treatmentPlanId,
      lineItems: payload.lineItems,
      dueDate: payload.dueDate,
      notes: payload.notes,
      idempotencyKey: payload.idempotencyKey,
    })
    invoicesStore.upsertInvoice(activeMembership.value.clinic_id, result.invoice)
    toast.success(result.alreadyCreated ? 'Invoice already created.' : 'Invoice created')
    showCreateDialog.value = false
  } catch (err: unknown) {
    toast.error(getInvoiceErrorMessage(err))
  } finally {
    createDialogRef.value?.markSubmitted()
  }
}

async function handleRecordPayment(payload: {
  invoiceId: string
  amount: number
  date: string
  method: Tables<'payments'>['method']
  referenceNote: string | null
  idempotencyKey: string
}) {
  if (!activeMembership.value?.clinic_id) return
  try {
    const result = await paymentService(supabase).recordForInvoice({
      clinicId: activeMembership.value.clinic_id,
      invoiceId: payload.invoiceId,
      amount: payload.amount,
      method: payload.method,
      paidAt: toLocalNoonIso(payload.date),
      referenceNote: payload.referenceNote,
      idempotencyKey: payload.idempotencyKey,
    })
    toast.success(result.alreadyRecorded ? 'Payment already recorded.' : 'Payment recorded')
    await loadInvoices()
    // Invalidate this invoice's payment history and refetch if expanded
    // eslint-disable-next-line @typescript-eslint/no-dynamic-delete
    delete paymentHistoryByInvoice.value[payload.invoiceId]
    if (expandedInvoiceId.value === payload.invoiceId) {
      void loadPaymentHistory(payload.invoiceId)
    }
    showRecordPaymentDialog.value = false
  } catch (err: unknown) {
    toast.error(getPaymentErrorMessage(err))
  } finally {
    paymentDialogRef.value?.markSubmitted()
  }
}

// --- Helpers ---

function toSingleQueryValue(value: string | null | (string | null)[] | undefined): string | null {
  if (Array.isArray(value)) return value[0] ?? null
  return typeof value === 'string' && value ? value : null
}

// --- Deep-link Init ---

onMounted(async () => {
  // Clear one-shot create params from URL
  if (route.query.action === 'new' || route.query.patientId || route.query.treatmentPlanId) {
    const query = { ...route.query }
    delete query.action
    delete query.patientId
    delete query.treatmentPlanId
    void router.replace({ query })
  }

  // Handle expandInvoice deep-link
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
})
</script>
