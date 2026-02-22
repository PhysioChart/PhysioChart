<template>
  <div class="space-y-4">
    <div class="flex items-center justify-between">
      <div>
        <h1 class="text-2xl font-bold tracking-tight">Billing</h1>
        <p class="text-muted-foreground text-sm">Manage invoices and payments</p>
      </div>
      <Button @click="openDialog()">
        <Plus class="mr-2 h-4 w-4" />
        New Invoice
      </Button>
    </div>

    <Dialog v-model:open="showNewDialog">
      <DialogContent class="max-h-[90vh] overflow-y-auto sm:max-w-lg">
        <DialogHeader>
          <DialogTitle>Create Invoice</DialogTitle>
          <DialogDescription>Generate a new invoice for a patient.</DialogDescription>
        </DialogHeader>
        <form class="space-y-4" @submit.prevent="createInvoice">
          <div>
            <Label>Patient *</Label>
            <Select v-model="newInvoice.patient_id">
              <SelectTrigger>
                <SelectValue placeholder="Select patient" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem v-for="p in patients" :key="p.id" :value="p.id">
                  {{ p.full_name }}
                </SelectItem>
              </SelectContent>
            </Select>
          </div>

          <div>
            <Label>Line Items</Label>
            <div class="mt-2 space-y-2">
              <div v-for="(item, i) in newInvoice.items" :key="i" class="grid grid-cols-12 gap-2">
                <Input v-model="item.description" placeholder="Description" class="col-span-5" />
                <Input
                  v-model.number="item.quantity"
                  type="number"
                  min="1"
                  class="col-span-2"
                  @input="updateLineItem(i)"
                />
                <Input
                  v-model.number="item.unit_price"
                  type="number"
                  placeholder="Price"
                  class="col-span-3"
                  @input="updateLineItem(i)"
                />
                <div class="col-span-2 flex items-center justify-between">
                  <span class="text-sm">{{ formatCurrency(item.total) }}</span>
                  <Button
                    v-if="newInvoice.items.length > 1"
                    type="button"
                    variant="ghost"
                    size="icon"
                    class="h-8 w-8"
                    @click="removeLineItem(i)"
                  >
                    &times;
                  </Button>
                </div>
              </div>
            </div>
            <Button type="button" variant="outline" size="sm" class="mt-2" @click="addLineItem">
              Add item
            </Button>
          </div>

          <div class="flex justify-between border-t pt-2 text-sm font-medium">
            <span>Total</span>
            <span>{{ formatCurrency(invoiceTotal) }}</span>
          </div>

          <div>
            <Label>Due Date</Label>
            <Input v-model="newInvoice.due_date" type="date" />
          </div>
          <div>
            <Label>Notes</Label>
            <Textarea v-model="newInvoice.notes" placeholder="Optional notes" rows="2" />
          </div>

          <DialogFooter>
            <Button type="button" variant="outline" @click="showNewDialog = false">Cancel</Button>
            <Button type="submit" :disabled="isSubmitting || !newInvoice.patient_id">
              {{ isSubmitting ? 'Creating...' : 'Create Invoice' }}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>

    <!-- Outstanding Summary -->
    <Card v-if="totalOutstanding > 0" class="border-amber-200 bg-amber-50/50">
      <CardContent class="flex items-center gap-3 p-4">
        <AlertCircle class="h-5 w-5 text-amber-600" />
        <div>
          <p class="text-sm font-medium text-amber-900">Outstanding Payments</p>
          <p class="text-2xl font-bold text-amber-900">
            {{ formatCurrency(totalOutstanding) }}
          </p>
        </div>
      </CardContent>
    </Card>

    <!-- Filter -->
    <div class="flex gap-2">
      <Button
        v-for="f in ['all', 'pending', 'paid', 'overdue'] as const"
        :key="f"
        :variant="filter === f ? 'default' : 'outline'"
        size="sm"
        class="capitalize"
        @click="filter = f"
      >
        {{ f }}
      </Button>
    </div>

    <!-- Invoices Table -->
    <Card>
      <CardContent class="p-0">
        <div v-if="isLoading" class="space-y-3 p-6">
          <Skeleton v-for="i in 5" :key="i" class="h-12 w-full" />
        </div>
        <div
          v-else-if="filteredInvoices.length === 0"
          class="flex flex-col items-center justify-center py-12 text-center"
        >
          <Receipt class="text-muted-foreground/50 mb-3 h-10 w-10" />
          <p class="text-muted-foreground text-sm">No invoices yet</p>
          <Button variant="outline" class="mt-3" @click="openDialog()">
            Create your first invoice
          </Button>
        </div>
        <Table v-else>
          <TableHeader>
            <TableRow>
              <TableHead>Invoice #</TableHead>
              <TableHead>Patient</TableHead>
              <TableHead class="hidden md:table-cell">Date</TableHead>
              <TableHead>Total</TableHead>
              <TableHead>Paid</TableHead>
              <TableHead>Status</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            <TableRow v-for="inv in filteredInvoices" :key="inv.id">
              <TableCell class="font-medium">{{ inv.invoice_number }}</TableCell>
              <TableCell>{{ inv.patient?.full_name ?? '—' }}</TableCell>
              <TableCell class="hidden md:table-cell">{{
                formatDateWithYear(inv.created_at)
              }}</TableCell>
              <TableCell>{{ formatCurrency(inv.total) }}</TableCell>
              <TableCell>{{ formatCurrency(inv.amount_paid) }}</TableCell>
              <TableCell>
                <Badge :class="getStatusColor(inv.status)" variant="secondary">
                  {{ INVOICE_STATUS_LABELS[inv.status] }}
                </Badge>
              </TableCell>
            </TableRow>
          </TableBody>
        </Table>
      </CardContent>
    </Card>
  </div>
</template>

<script setup lang="ts">
import { Receipt, Plus, AlertCircle } from 'lucide-vue-next'
import { toast } from 'vue-sonner'
import type { Tables } from '~/types/database'
import type { IInvoiceWithRelations } from '~/types/models/invoice.types'
import { InvoiceStatus, INVOICE_STATUS_LABELS } from '~/enums/invoice.enum'
import { invoiceService } from '~/services/invoice.service'
import { patientService } from '~/services/patient.service'
import { formatDateWithYear, formatCurrency, getStatusColor } from '~/lib/formatters'

const supabase = useSupabase()
const { profile } = useAuth()
const route = useRoute()

const invoices = ref<IInvoiceWithRelations[]>([])
const patients = ref<Tables<'patients'>[]>([])
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

let dropdownsLoaded = false

async function loadInvoices() {
  if (!profile.value) return
  isLoading.value = true

  try {
    invoices.value = await invoiceService(supabase).list(profile.value.clinic_id)
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
    patients.value = await patientService(supabase).listForDropdown(profile.value.clinic_id)
    dropdownsLoaded = true
  } catch {
    // Allow retry on next dialog open
  }
}

function openDialog() {
  loadPatients()
  showNewDialog.value = true
}

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
  if (filter.value === 'paid') return invoices.value.filter((i) => i.status === InvoiceStatus.PAID)
  if (filter.value === 'overdue')
    return invoices.value.filter((i) => i.status === InvoiceStatus.OVERDUE)
  return invoices.value
})

const totalOutstanding = computed(() => {
  return invoices.value
    .filter((i) => OUTSTANDING_STATUSES.includes(i.status))
    .reduce((sum, i) => sum + (i.total - i.amount_paid), 0)
})

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

const invoiceTotal = computed(() =>
  newInvoice.value.items.reduce((sum, item) => sum + item.total, 0),
)

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

onMounted(loadInvoices)
</script>
