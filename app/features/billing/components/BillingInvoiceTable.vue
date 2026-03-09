<template>
  <Card>
    <CardContent class="p-0">
      <div v-if="isLoading" class="space-y-3 p-6">
        <Skeleton v-for="i in 5" :key="i" class="h-12 w-full" />
      </div>
      <div
        v-else-if="invoices.length === 0"
        class="flex flex-col items-center justify-center py-12 text-center"
      >
        <Receipt class="text-muted-foreground/50 mb-3 h-10 w-10" />
        <p class="text-muted-foreground text-sm">
          {{
            filter === 'all'
              ? 'No invoices yet'
              : filter === 'pending'
                ? 'No pending invoices'
                : filter === 'paid'
                  ? 'No paid invoices'
                  : 'No overdue invoices'
          }}
        </p>
        <Button v-if="filter === 'all'" variant="outline" class="mt-3" @click="emit('newInvoice')">
          Create your first invoice
        </Button>
      </div>
      <div v-else class="overflow-x-auto">
        <Table>
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
            <template v-for="inv in invoices" :key="inv.id">
              <TableRow
                class="cursor-pointer"
                :aria-expanded="expandedInvoiceId === inv.id"
                @click="emit('toggleExpand', inv.id)"
              >
                <TableCell class="font-medium">{{ inv.invoice_number }}</TableCell>
                <TableCell>{{ inv.patient?.full_name ?? '—' }}</TableCell>
                <TableCell class="hidden md:table-cell">{{
                  formatDateWithYear(inv.created_at)
                }}</TableCell>
                <TableCell>{{ formatCurrency(inv.total) }}</TableCell>
                <TableCell>{{ formatCurrency(inv.amount_paid) }}</TableCell>
                <TableCell>
                  <div class="flex items-center gap-2">
                    <Badge :class="getStatusColor(inv.status)" variant="secondary">
                      {{ INVOICE_STATUS_LABELS[inv.status] }}
                    </Badge>
                    <Button
                      v-if="inv.status !== 'paid'"
                      size="sm"
                      variant="ghost"
                      class="hidden h-7 px-2 text-xs sm:inline-flex"
                      @click.stop="emit('recordPayment', inv.id)"
                    >
                      <Banknote class="mr-1 h-3.5 w-3.5" />
                      Pay
                    </Button>
                  </div>
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

                      <Button
                        v-if="inv.status !== 'paid' && inv.status !== 'cancelled'"
                        size="sm"
                        @click.stop="emit('recordPayment', inv.id)"
                      >
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
      </div>
    </CardContent>
  </Card>
</template>

<script setup lang="ts">
import type { Tables } from '~/types/database'
import type { IInvoiceWithRelations } from '~/types/models/invoice.types'
import { Banknote, Receipt } from 'lucide-vue-next'
import { INVOICE_STATUS_LABELS } from '~/enums/invoice.enum'
import { PAYMENT_METHOD_LABELS } from '~/enums/payment.enum'
import {
  formatCurrency,
  formatDateWithYear,
  formatDateTime,
  getStatusColor,
} from '~/lib/formatters'

defineProps<{
  invoices: IInvoiceWithRelations[]
  isLoading: boolean
  filter: string
  expandedInvoiceId: string | null
  expandedInvoicePayments: Tables<'payments'>[]
  isExpandedInvoicePaymentsLoading: boolean
}>()

const emit = defineEmits<{
  toggleExpand: [invoiceId: string]
  recordPayment: [invoiceId: string]
  newInvoice: []
}>()
</script>
