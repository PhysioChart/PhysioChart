<template>
  <Dialog :open="open" @update:open="emit('update:open', $event)">
    <DialogContent class="sm:max-w-md">
      <DialogHeader class="-mx-6 -mt-6 border-b px-6 py-4">
        <DialogTitle>Record Payment</DialogTitle>
        <DialogDescription v-if="invoice">
          Invoice {{ invoice.invoice_number }} • Outstanding:
          {{ formatCurrency(outstandingAmount) }}
        </DialogDescription>
      </DialogHeader>
      <form class="space-y-4 pt-2" @submit.prevent="handleSubmit">
        <div class="space-y-2">
          <Label>Amount *</Label>
          <Input v-model.number="paymentForm.amount" type="number" min="0.01" step="0.01" />
        </div>

        <div class="space-y-2">
          <Label>Date *</Label>
          <Popover v-model:open="paymentDatePickerOpen" modal>
            <PopoverTrigger as-child>
              <Button
                type="button"
                variant="outline"
                :class="
                  cn(
                    'w-full justify-start text-left font-normal',
                    !paymentForm.date && 'text-muted-foreground',
                  )
                "
              >
                <CalendarIcon class="mr-2 size-4" />
                {{ formattedPaymentDate || 'Pick a date' }}
              </Button>
            </PopoverTrigger>
            <PopoverContent class="w-auto p-0" align="start">
              <Calendar v-model="paymentDateCalendarValue" />
            </PopoverContent>
          </Popover>
        </div>

        <div class="space-y-2">
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

        <div class="space-y-2">
          <Label>Reference Note</Label>
          <Textarea
            v-model="paymentForm.reference_note"
            placeholder="Optional transaction reference"
            rows="2"
            maxlength="280"
          />
        </div>

        <DialogFooter class="-mx-6 -mb-6 border-t px-6 py-4">
          <Button type="button" variant="outline" @click="emit('update:open', false)">
            Cancel
          </Button>
          <Button type="submit" :disabled="isRecordingPayment">
            {{ isRecordingPayment ? 'Saving...' : 'Save Payment' }}
          </Button>
        </DialogFooter>
      </form>
    </DialogContent>
  </Dialog>
</template>

<script setup lang="ts">
import type { DateValue } from 'reka-ui'
import { CalendarDate } from '@internationalized/date'
import { toast } from 'vue-sonner'
import { CalendarIcon } from 'lucide-vue-next'
import type { Tables } from '~/types/database'
import type { IInvoiceWithRelations } from '~/types/models/invoice.types'
import { Calendar } from '~/components/ui/calendar'
import { Popover, PopoverContent, PopoverTrigger } from '~/components/ui/popover'
import { cn } from '~/lib/utils'
import { toDateInputValue } from '~/lib/date'
import { generateIdempotencyKey } from '~/lib/idempotency'
import { formatCurrency } from '~/lib/formatters'
import { PaymentMethod, PAYMENT_METHOD_LABELS, PAYMENT_METHOD_VALUES } from '~/enums/payment.enum'

const props = defineProps<{
  open: boolean
  invoice: IInvoiceWithRelations | null
}>()

const emit = defineEmits<{
  'update:open': [value: boolean]
  submit: [
    payload: {
      invoiceId: string
      amount: number
      date: string
      method: Tables<'payments'>['method']
      referenceNote: string | null
      idempotencyKey: string
    },
  ]
}>()

const paymentForm = ref({
  amount: 0,
  date: toDateInputValue(),
  method: PaymentMethod.CASH as Tables<'payments'>['method'],
  reference_note: '',
})

const isRecordingPayment = ref(false)

// --- Computed ---

const outstandingAmount = computed(() => {
  if (!props.invoice) return 0
  return Math.max(Number(props.invoice.total) - Number(props.invoice.amount_paid), 0)
})

// --- Date Picker ---

const paymentDatePickerOpen = ref(false)

const paymentDateCalendarValue = computed<DateValue | undefined>({
  get() {
    if (!paymentForm.value.date) return undefined
    const [year, month, day] = paymentForm.value.date.split('-').map(Number) as [
      number,
      number,
      number,
    ]
    return new CalendarDate(year, month, day)
  },
  set(val: DateValue | undefined) {
    if (val) {
      const y = String(val.year).padStart(4, '0')
      const m = String(val.month).padStart(2, '0')
      const d = String(val.day).padStart(2, '0')
      paymentForm.value.date = `${y}-${m}-${d}`
    } else {
      paymentForm.value.date = ''
    }
    paymentDatePickerOpen.value = false
  },
})

const formattedPaymentDate = computed(() => {
  if (!paymentForm.value.date) return ''
  return new Date(paymentForm.value.date + 'T00:00:00').toLocaleDateString('en-IN', {
    weekday: 'short',
    day: 'numeric',
    month: 'short',
    year: 'numeric',
  })
})

// --- Validation & Submit ---

function handleSubmit() {
  if (!props.invoice) return

  const amount = Number(paymentForm.value.amount)
  const outstanding = outstandingAmount.value

  if (!Number.isFinite(amount) || amount <= 0) {
    toast.error('Enter a valid payment amount.')
    return
  }

  const amountStr = String(paymentForm.value.amount)
  const decimalPart = amountStr.includes('.') ? (amountStr.split('.')[1] ?? '') : ''
  if (decimalPart.length > 2) {
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

  emit('submit', {
    invoiceId: props.invoice.id,
    amount,
    date: paymentForm.value.date,
    method: paymentForm.value.method,
    referenceNote: referenceNote || null,
    idempotencyKey: generateIdempotencyKey('payment'),
  })
}

function markSubmitted() {
  isRecordingPayment.value = false
}

// --- Dialog open/close lifecycle ---

function resetForm() {
  paymentForm.value = {
    amount: 0,
    date: toDateInputValue(),
    method: PaymentMethod.CASH,
    reference_note: '',
  }
  isRecordingPayment.value = false
}

watch(
  () => props.open,
  (isOpen) => {
    if (isOpen && props.invoice) {
      const outstanding = Math.max(
        Number(props.invoice.total) - Number(props.invoice.amount_paid),
        0,
      )
      paymentForm.value = {
        amount: outstanding,
        date: toDateInputValue(),
        method: PaymentMethod.CASH,
        reference_note: '',
      }
    } else if (!isOpen) {
      resetForm()
    }
  },
)

defineExpose({ markSubmitted })
</script>
