<template>
  <div>
    <Card v-if="isLoadingInvoices">
      <CardContent class="space-y-3 p-6">
        <Skeleton v-for="i in 3" :key="i" class="h-20 w-full" />
      </CardContent>
    </Card>

    <Card v-else-if="invoices.length === 0">
      <CardContent class="flex flex-col items-center justify-center py-12 text-center">
        <Receipt class="text-muted-foreground/50 mb-3 h-10 w-10" />
        <p class="text-muted-foreground text-sm">No invoices for this patient yet</p>
        <Button
          variant="outline"
          class="mt-3"
          @click="navigateTo('/billing?action=new&patientId=' + patientId)"
        >
          + Create Invoice
        </Button>
      </CardContent>
    </Card>

    <div v-else class="space-y-6">
      <div class="space-y-3">
        <div class="flex items-center justify-between">
          <p class="text-muted-foreground text-sm font-medium">Unpaid / Pending</p>
          <Button
            size="sm"
            variant="outline"
            @click="navigateTo('/billing?action=new&patientId=' + patientId)"
          >
            + Create Invoice
          </Button>
        </div>

        <p v-if="unpaidPendingInvoices.length === 0" class="text-muted-foreground text-sm">
          No unpaid or pending invoices
        </p>

        <Card v-for="inv in unpaidPendingInvoices" v-else :key="inv.id">
          <CardContent class="space-y-2 p-4">
            <div class="flex items-start justify-between gap-3">
              <div>
                <p class="font-medium">{{ inv.invoice_number }}</p>
                <p class="text-muted-foreground text-sm">
                  {{ formatDateWithYear(inv.created_at) }}
                </p>
              </div>
              <Badge :class="getInvoiceStatusBadgeClass(inv.status)" variant="secondary">
                {{ INVOICE_STATUS_LABELS[inv.status] }}
              </Badge>
            </div>

            <p class="text-sm">Total: {{ formatCurrency(inv.total) }}</p>
          </CardContent>
        </Card>
      </div>

      <div class="space-y-3">
        <p class="text-muted-foreground text-sm font-medium">Paid</p>

        <p v-if="paidInvoices.length === 0" class="text-muted-foreground text-sm">
          No paid invoices yet
        </p>

        <Card v-for="inv in paidInvoices" v-else :key="inv.id">
          <CardContent class="space-y-2 p-4">
            <div class="flex items-start justify-between gap-3">
              <div>
                <p class="font-medium">{{ inv.invoice_number }}</p>
                <p class="text-muted-foreground text-sm">
                  {{ formatDateWithYear(inv.created_at) }}
                </p>
              </div>
              <Badge :class="getInvoiceStatusBadgeClass(inv.status)" variant="secondary">
                {{ INVOICE_STATUS_LABELS[inv.status] }}
              </Badge>
            </div>

            <p class="text-sm">Total: {{ formatCurrency(inv.total) }}</p>
          </CardContent>
        </Card>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { Receipt } from 'lucide-vue-next'
import type { IInvoiceWithRelations } from '~/types/models/invoice.types'
import type { InvoiceStatus } from '~/enums/invoice.enum'
import { INVOICE_STATUS_LABELS } from '~/enums/invoice.enum'
import { formatCurrency, formatDateWithYear } from '~/lib/formatters'

defineProps<{
  patientId: string
  isLoadingInvoices: boolean
  invoices: IInvoiceWithRelations[]
  unpaidPendingInvoices: IInvoiceWithRelations[]
  paidInvoices: IInvoiceWithRelations[]
  getInvoiceStatusBadgeClass: (status: InvoiceStatus) => string
}>()
</script>
