<template>
  <div class="space-y-4">
    <div class="flex items-center justify-between">
      <div>
        <h1 class="text-2xl font-bold tracking-tight">Billing</h1>
        <p class="text-muted-foreground text-sm">Manage invoices and payments</p>
      </div>
      <Button size="lg" @click="openDialog()">
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
            <Select
              :model-value="newInvoice.patient_id"
              @update:model-value="handlePatientSelection"
            >
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

          <div v-if="shouldShowTreatmentLoading" class="space-y-1">
            <Label>Linked Treatment (Optional)</Label>
            <p class="text-muted-foreground text-sm">Loading treatment plans...</p>
          </div>

          <div v-else-if="shouldShowTreatmentSelector" class="space-y-1">
            <Label>Linked Treatment (Optional)</Label>
            <Select
              :model-value="newInvoice.treatment_plan_id"
              @update:model-value="handleTreatmentSelection"
            >
              <SelectTrigger aria-describedby="treatment-select-help">
                <SelectValue placeholder="No linked treatment" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem :value="NO_TREATMENT_PLAN_VALUE">No linked treatment</SelectItem>
                <SelectItem v-for="plan in availableTreatmentPlans" :key="plan.id" :value="plan.id">
                  {{ getTreatmentPlanOptionLabel(plan) }}
                </SelectItem>
              </SelectContent>
            </Select>
            <p id="treatment-select-help" class="text-muted-foreground text-xs">
              {{ treatmentSelectionHelpText }}
            </p>
          </div>

          <div v-else-if="shouldShowNoEligibleTreatments" class="space-y-1">
            <Label>Linked Treatment (Optional)</Label>
            <p class="text-muted-foreground text-sm">No eligible treatments available.</p>
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
                  step="1"
                  class="col-span-2"
                  @input="updateLineItem(i)"
                />
                <Input
                  v-model.number="item.unit_price"
                  type="number"
                  min="0"
                  step="0.01"
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

    <Dialog v-model:open="showRecordPaymentDialog">
      <DialogContent class="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Record Payment</DialogTitle>
          <DialogDescription v-if="selectedInvoiceForPayment">
            Invoice {{ selectedInvoiceForPayment.invoice_number }} • Outstanding:
            {{ formatCurrency(selectedInvoiceOutstanding) }}
          </DialogDescription>
        </DialogHeader>
        <form class="space-y-4" @submit.prevent="recordPayment">
          <div>
            <Label>Amount *</Label>
            <Input v-model.number="paymentForm.amount" type="number" min="0.01" step="0.01" />
          </div>

          <div>
            <Label>Date *</Label>
            <Input v-model="paymentForm.date" type="date" />
          </div>

          <div>
            <Label>Method *</Label>
            <Select v-model="paymentForm.method">
              <SelectTrigger>
                <SelectValue placeholder="Select method" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem v-for="method in PAYMENT_METHOD_VALUES" :key="method" :value="method">
                  {{ PAYMENT_METHOD_LABELS[method] }}
                </SelectItem>
              </SelectContent>
            </Select>
          </div>

          <div>
            <Label>Reference Note</Label>
            <Textarea
              v-model="paymentForm.reference_note"
              placeholder="Optional transaction reference"
              rows="2"
              maxlength="280"
            />
          </div>

          <DialogFooter>
            <Button type="button" variant="outline" @click="showRecordPaymentDialog = false">
              Cancel
            </Button>
            <Button type="submit" :disabled="isRecordingPayment">
              {{ isRecordingPayment ? 'Saving...' : 'Save Payment' }}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>

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
            <template v-for="inv in filteredInvoices" :key="inv.id">
              <TableRow class="cursor-pointer" @click="toggleInvoiceExpanded(inv.id)">
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

              <TableRow v-if="expandedInvoiceId === inv.id" :key="`${inv.id}-expanded`">
                <TableCell :colspan="6">
                  <div class="bg-muted/20 space-y-4 rounded-md border p-4">
                    <div class="flex flex-wrap items-center justify-between gap-4">
                      <div class="grid grid-cols-1 gap-3 text-sm sm:grid-cols-3">
                        <div>
                          <p class="text-muted-foreground">Total</p>
                          <p class="font-semibold">{{ formatCurrency(inv.total) }}</p>
                        </div>
                        <div>
                          <p class="text-muted-foreground">Paid</p>
                          <p class="font-semibold">{{ formatCurrency(inv.amount_paid) }}</p>
                        </div>
                        <div>
                          <p class="text-muted-foreground">Outstanding</p>
                          <p class="font-semibold">
                            {{ formatCurrency(inv.total - inv.amount_paid) }}
                          </p>
                        </div>
                      </div>

                      <Button size="sm" @click.stop="openRecordPaymentDialog(inv.id)">
                        Record Payment
                      </Button>
                    </div>

                    <div class="space-y-2">
                      <p class="text-sm font-medium">Payment History</p>

                      <div v-if="isExpandedInvoicePaymentsLoading" class="space-y-2">
                        <Skeleton v-for="i in 2" :key="i" class="h-12 w-full" />
                      </div>

                      <p
                        v-else-if="expandedInvoicePayments.length === 0"
                        class="text-muted-foreground text-sm"
                      >
                        No payments recorded yet.
                      </p>

                      <div v-else class="space-y-2">
                        <div
                          v-for="payment in expandedInvoicePayments"
                          :key="payment.id"
                          class="bg-background rounded-md border p-3"
                        >
                          <div class="flex items-start justify-between gap-3">
                            <div>
                              <p class="text-sm font-medium">
                                {{ formatCurrency(payment.amount) }} ·
                                {{ PAYMENT_METHOD_LABELS[payment.method] }}
                              </p>
                              <p class="text-muted-foreground text-xs">
                                {{ formatDateTime(payment.paid_at) }}
                              </p>
                              <p v-if="payment.notes" class="text-muted-foreground mt-1 text-xs">
                                Ref: {{ payment.notes }}
                              </p>
                            </div>
                          </div>
                        </div>
                      </div>
                    </div>
                  </div>
                </TableCell>
              </TableRow>
            </template>
          </TableBody>
        </Table>
      </CardContent>
    </Card>
  </div>
</template>

<script setup lang="ts">
import { AlertCircle, Plus, Receipt } from 'lucide-vue-next'
import { INVOICE_STATUS_LABELS } from '~/enums/invoice.enum'
import { PAYMENT_METHOD_LABELS, PAYMENT_METHOD_VALUES } from '~/enums/payment.enum'
import { useBillingPage } from '~/composables/useBillingPage'
import {
  formatDateTime,
  formatDateWithYear,
  formatCurrency,
  getStatusColor,
} from '~/lib/formatters'

const {
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
  updateLineItem,
  addLineItem,
  removeLineItem,
  toggleInvoiceExpanded,
  openRecordPaymentDialog,
  recordPayment,
  getTreatmentPlanOptionLabel,
} = useBillingPage()
</script>
