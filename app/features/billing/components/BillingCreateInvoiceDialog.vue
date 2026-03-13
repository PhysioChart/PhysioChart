<template>
  <ResponsiveFormOverlay :open="open" desktop-width="lg" @update:open="emit('update:open', $event)">
    <form class="flex min-h-0 flex-1 flex-col" @submit.prevent="handleSubmit">
      <DialogHeader
        class="bg-background shrink-0 border-b px-4 py-4 [padding-top:max(1rem,env(safe-area-inset-top))] text-left sm:px-6"
      >
        <DialogTitle>Create Invoice</DialogTitle>
        <DialogDescription>Generate a new invoice for a patient.</DialogDescription>
      </DialogHeader>
      <div class="min-h-0 flex-1 overflow-y-auto overscroll-contain px-4 py-4 sm:px-6">
        <div class="space-y-4">
          <div class="space-y-2">
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

          <div v-if="shouldShowTreatmentLoading" class="space-y-2">
            <Label>Linked Treatment (Optional)</Label>
            <p class="text-muted-foreground text-sm">Loading treatment plans...</p>
          </div>

          <div v-else-if="shouldShowTreatmentSelector" class="space-y-2">
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

          <div v-else-if="shouldShowNoEligibleTreatments" class="space-y-2">
            <Label>Linked Treatment (Optional)</Label>
            <p class="text-muted-foreground text-sm">No eligible treatments available.</p>
          </div>

          <div class="space-y-2">
            <Label>Line Items</Label>

            <!-- Treatment-linked: auto-generated summary card -->
            <div v-if="hasTreatmentItem" class="mt-2 space-y-3">
              <div class="bg-muted/40 rounded-md border p-3">
                <p class="text-sm font-medium">{{ newInvoice.treatmentItem!.description }}</p>
                <div class="mt-1.5 flex items-center gap-2 text-sm">
                  <template v-if="isPerSessionPlan">
                    <Input
                      :model-value="newInvoice.treatmentItem!.quantity"
                      type="number"
                      min="1"
                      step="1"
                      class="h-8 w-16"
                      @update:model-value="updateTreatmentItemQty(Number($event))"
                    />
                    <span class="text-muted-foreground">&times;</span>
                  </template>
                  <template v-else>
                    <span>{{ newInvoice.treatmentItem!.quantity }}</span>
                    <span class="text-muted-foreground">&times;</span>
                  </template>
                  <span>{{ formatCurrency(newInvoice.treatmentItem!.unit_price) }}</span>
                  <span class="text-muted-foreground">=</span>
                  <span class="font-medium">{{
                    formatCurrency(newInvoice.treatmentItem!.total)
                  }}</span>
                </div>
              </div>

              <!-- Extra charges (editable) -->
              <div v-if="newInvoice.extraItems.length > 0" class="space-y-2">
                <p class="text-muted-foreground text-xs font-medium">Extra Charges</p>
                <div
                  v-for="(item, i) in newInvoice.extraItems"
                  :key="item.id"
                  class="space-y-2 sm:grid sm:grid-cols-12 sm:gap-2 sm:space-y-0"
                >
                  <Input
                    v-model="item.description"
                    placeholder="Description"
                    class="sm:col-span-5"
                  />
                  <div class="grid grid-cols-3 gap-2 sm:contents">
                    <Input
                      v-model.number="item.quantity"
                      type="number"
                      min="1"
                      step="1"
                      placeholder="Qty"
                      class="sm:col-span-2"
                      @input="updateLineItem(i)"
                    />
                    <Input
                      v-model.number="item.unit_price"
                      type="number"
                      min="0"
                      step="0.01"
                      placeholder="Price"
                      class="sm:col-span-3"
                      @input="updateLineItem(i)"
                    />
                    <div
                      class="flex items-center justify-end gap-1 sm:col-span-2 sm:justify-between"
                    >
                      <span class="text-sm">{{ formatCurrency(item.total) }}</span>
                      <Button
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
              </div>

              <Button type="button" variant="outline" size="sm" @click="addLineItem">
                Add extra charge
              </Button>
            </div>

            <!-- No treatment linked: manual line items (unchanged) -->
            <div v-else class="mt-2 space-y-2">
              <div
                v-for="(item, i) in newInvoice.items"
                :key="item.id"
                class="space-y-2 sm:grid sm:grid-cols-12 sm:gap-2 sm:space-y-0"
              >
                <Input v-model="item.description" placeholder="Description" class="sm:col-span-5" />
                <div class="grid grid-cols-3 gap-2 sm:contents">
                  <Input
                    v-model.number="item.quantity"
                    type="number"
                    min="1"
                    step="1"
                    placeholder="Qty"
                    class="sm:col-span-2"
                    @input="updateLineItem(i)"
                  />
                  <Input
                    v-model.number="item.unit_price"
                    type="number"
                    min="0"
                    step="0.01"
                    placeholder="Price"
                    class="sm:col-span-3"
                    @input="updateLineItem(i)"
                  />
                  <div class="flex items-center justify-end gap-1 sm:col-span-2 sm:justify-between">
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
          </div>

          <div class="flex justify-between border-t pt-2 text-sm font-medium">
            <span>Total</span>
            <span>{{ formatCurrency(invoiceTotal) }}</span>
          </div>

          <div class="space-y-2">
            <Label>Due Date</Label>
            <Popover v-model:open="dueDatePickerOpen" modal>
              <PopoverTrigger as-child>
                <Button
                  type="button"
                  variant="outline"
                  :class="
                    cn(
                      'w-full justify-start text-left font-normal',
                      !newInvoice.due_date && 'text-muted-foreground',
                    )
                  "
                >
                  <CalendarIcon class="mr-2 size-4" />
                  {{ formattedDueDate || 'Pick a date' }}
                </Button>
              </PopoverTrigger>
              <PopoverContent class="w-auto p-0" align="start">
                <Calendar v-model="dueDateCalendarValue" :min-value="todayCalendarDate" />
              </PopoverContent>
            </Popover>
          </div>
          <div class="space-y-2">
            <Label>Notes</Label>
            <Textarea v-model="newInvoice.notes" placeholder="Optional notes" rows="2" />
          </div>
        </div>
      </div>

      <DialogFooter
        class="bg-background shrink-0 border-t px-4 py-4 [padding-bottom:max(1rem,env(safe-area-inset-bottom))] sm:px-6"
      >
        <Button type="button" variant="outline" @click="emit('update:open', false)">
          Cancel
        </Button>
        <Button type="submit" :disabled="isSubmitting || !newInvoice.patient_id">
          {{ isSubmitting ? 'Creating...' : 'Create Invoice' }}
        </Button>
      </DialogFooter>
    </form>
  </ResponsiveFormOverlay>
</template>

<script setup lang="ts">
import type { DateValue } from 'reka-ui'
import { CalendarDate } from '@internationalized/date'
import { storeToRefs } from 'pinia'
import { toast } from 'vue-sonner'
import { CalendarIcon } from 'lucide-vue-next'
import { Calendar } from '~/components/ui/calendar'
import { Popover, PopoverContent, PopoverTrigger } from '~/components/ui/popover'
import { cn } from '~/lib/utils'
import { roundMoney } from '~/lib/money'
import { generateIdempotencyKey } from '~/lib/idempotency'
import { formatCurrency } from '~/lib/formatters'
import { TreatmentStatus } from '~/enums/treatment.enum'
import { usePatientsStore } from '~/stores/patients.store'
import { useTreatmentsStore } from '~/stores/treatments.store'
import type { ITreatmentPlanWithRelations } from '~/types/models/treatment.types'
import {
  type IInvoiceDraft,
  type IInvoiceDraftItem,
  NO_TREATMENT_PLAN_VALUE,
  createDefaultLineItem,
  createDefaultInvoiceForm,
} from '~/features/billing/types'

const props = defineProps<{
  open: boolean
  initialPatientId?: string | null
  initialTreatmentPlanId?: string | null
}>()

const emit = defineEmits<{
  'update:open': [value: boolean]
  submit: [
    payload: {
      patientId: string
      treatmentPlanId: string | null
      lineItems: Array<{ description: string; quantity: number; unit_price: number; total: number }>
      dueDate: string | null
      notes: string | null
      idempotencyKey: string
    },
  ]
}>()

const { activeMembership } = useAuth()

const patientsStore = usePatientsStore()
const treatmentsStore = useTreatmentsStore()
const { dropdownByClinic } = storeToRefs(patientsStore)
const { byPatientByClinic: treatmentsByPatientByClinic } = storeToRefs(treatmentsStore)

const newInvoice = ref<IInvoiceDraft>(createDefaultInvoiceForm())
const isSubmitting = ref(false)
const createInvoiceIdempotencyKey = ref(generateIdempotencyKey('inv'))

const isLoadingTreatments = ref(false)
const treatmentLoadToken = ref(0)

let dropdownsLoaded = false

// --- Patients ---

const patients = computed(() => {
  if (!activeMembership.value?.clinic_id) return []
  return dropdownByClinic.value[activeMembership.value.clinic_id] ?? []
})

// --- Treatments ---

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

const isPerSessionPlan = computed(() => {
  if (!selectedTreatmentPlan.value) return false
  const packagePrice = Number(selectedTreatmentPlan.value.package_price)
  if (Number.isFinite(packagePrice) && packagePrice > 0) return false
  const sessionPrice = Number(selectedTreatmentPlan.value.price_per_session)
  return Number.isFinite(sessionPrice) && sessionPrice > 0
})

const hasTreatmentItem = computed(() => !!newInvoice.value.treatmentItem)

// --- Line Items ---

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

const invoiceTotal = computed(() =>
  allInvoiceItems.value.reduce((sum, item) => sum + Number(item.total), 0),
)

// --- Due Date Picker ---

const dueDatePickerOpen = ref(false)

const todayCalendarDate = computed(() => {
  const now = new Date()
  return new CalendarDate(now.getFullYear(), now.getMonth() + 1, now.getDate())
})

const dueDateCalendarValue = computed<DateValue | undefined>({
  get() {
    if (!newInvoice.value.due_date) return undefined
    const [year, month, day] = newInvoice.value.due_date.split('-').map(Number) as [
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
      newInvoice.value.due_date = `${y}-${m}-${d}`
    } else {
      newInvoice.value.due_date = ''
    }
    dueDatePickerOpen.value = false
  },
})

const formattedDueDate = computed(() => {
  if (!newInvoice.value.due_date) return ''
  return new Date(newInvoice.value.due_date + 'T00:00:00').toLocaleDateString('en-IN', {
    weekday: 'short',
    day: 'numeric',
    month: 'short',
    year: 'numeric',
  })
})

// --- Data Loading ---

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

// --- Form Actions ---

function resetForm() {
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

function handlePatientSelection(value: unknown) {
  const patientId = typeof value === 'string' ? value : ''
  void setPatientSelection(patientId)
}

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

// --- Validation ---

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

// --- Submit ---

function handleSubmit() {
  if (!activeMembership.value?.clinic_id || !newInvoice.value.patient_id) return

  const itemsToSubmit = allInvoiceItems.value
  if (!validateInvoiceItems(itemsToSubmit)) return

  isSubmitting.value = true

  const normalizedItems = itemsToSubmit.map((item) => {
    const quantity = Math.trunc(item.quantity)
    const unitPrice = roundMoney(item.unit_price)
    return {
      description: item.description.trim(),
      quantity,
      unit_price: unitPrice,
      total: roundMoney(quantity * unitPrice),
    }
  })

  emit('submit', {
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
}

function markSubmitted() {
  isSubmitting.value = false
}

// --- Dialog open/close lifecycle ---

async function initializeDialog() {
  if (!activeMembership.value?.clinic_id) return

  try {
    await loadPatients()

    if (props.initialPatientId) {
      await setPatientSelection(props.initialPatientId)
    }

    if (props.initialPatientId && props.initialTreatmentPlanId) {
      const linkedPlan = availableTreatmentPlans.value.find(
        (plan) => plan.id === props.initialTreatmentPlanId,
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
    emit('update:open', false)
  }
}

watch(
  () => props.open,
  (isOpen) => {
    if (isOpen) {
      void initializeDialog()
      return
    }
    resetForm()
  },
)

defineExpose({ markSubmitted })
</script>
