<template>
  <Dialog v-model:open="dialogOpen">
    <DialogContent class="max-h-[90vh] overflow-y-auto sm:max-w-md">
      <DialogHeader class="-mx-6 -mt-6 border-b px-6 py-4">
        <DialogTitle>Register New Patient</DialogTitle>
        <DialogDescription>
          Enter the patient's details. Phone number is the primary identifier.
        </DialogDescription>
      </DialogHeader>
      <form class="space-y-4 pt-2" @submit.prevent="onSubmit">
        <div class="grid gap-4 sm:grid-cols-2">
          <div class="space-y-2 sm:col-span-2">
            <Label for="create-name">Full Name *</Label>
            <Input id="create-name" v-model="form.full_name" placeholder="Patient name" />
          </div>
          <div class="space-y-2">
            <Label for="create-phone">Phone *</Label>
            <PhoneInput id="create-phone" v-model="form.phone" placeholder="98765 43210" />
          </div>
          <div class="space-y-2">
            <Label for="create-email">Email</Label>
            <Input id="create-email" v-model="form.email" type="email" placeholder="Optional" />
          </div>
          <div class="space-y-2">
            <Label for="create-dob">Date of Birth</Label>
            <Popover v-model:open="dobPickerOpen" modal>
              <PopoverTrigger as-child>
                <Button
                  id="create-dob"
                  type="button"
                  variant="outline"
                  :class="
                    cn(
                      'w-full justify-start text-left font-normal',
                      !form.date_of_birth && 'text-muted-foreground',
                    )
                  "
                >
                  <CalendarIcon class="mr-2 size-4" />
                  {{ formattedDob || 'Pick a date' }}
                </Button>
              </PopoverTrigger>
              <PopoverContent class="w-auto p-0" align="start">
                <Calendar v-model="dobCalendarValue" />
              </PopoverContent>
            </Popover>
          </div>
          <div class="space-y-2">
            <Label for="create-gender">Gender</Label>
            <Select v-model="form.gender">
              <SelectTrigger class="w-full">
                <SelectValue placeholder="Select" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem :value="Gender.MALE">{{ GENDER_LABELS[Gender.MALE] }}</SelectItem>
                <SelectItem :value="Gender.FEMALE">{{ GENDER_LABELS[Gender.FEMALE] }}</SelectItem>
                <SelectItem :value="Gender.OTHER">{{ GENDER_LABELS[Gender.OTHER] }}</SelectItem>
              </SelectContent>
            </Select>
          </div>
          <div class="space-y-2 sm:col-span-2">
            <Label for="create-address">Address</Label>
            <Textarea id="create-address" v-model="form.address" placeholder="Optional" rows="2" />
          </div>
          <div class="space-y-2">
            <Label for="create-ec-name">Emergency Contact Name</Label>
            <Input
              id="create-ec-name"
              v-model="form.emergency_contact_name"
              placeholder="Optional"
            />
          </div>
          <div class="space-y-2">
            <Label for="create-ec-phone">Emergency Contact Phone</Label>
            <PhoneInput
              id="create-ec-phone"
              v-model="form.emergency_contact_phone"
              placeholder="Optional"
            />
          </div>
          <div class="space-y-2 sm:col-span-2">
            <Label for="create-notes">Notes</Label>
            <Textarea
              id="create-notes"
              v-model="form.notes"
              placeholder="Any additional notes"
              rows="2"
            />
          </div>
        </div>
        <DialogFooter class="-mx-6 -mb-6 border-t px-6 py-4">
          <Button type="button" variant="outline" @click="dialogOpen = false">Cancel</Button>
          <Button type="submit" :disabled="isSubmitting || !form.full_name || !form.phone">
            {{ isSubmitting ? 'Registering...' : 'Register Patient' }}
          </Button>
        </DialogFooter>
      </form>
    </DialogContent>
  </Dialog>
</template>

<script setup lang="ts">
import type { DateValue } from 'reka-ui'
import { CalendarDate } from '@internationalized/date'
import { CalendarIcon } from 'lucide-vue-next'
import { Calendar } from '~/components/ui/calendar'
import { Popover, PopoverContent, PopoverTrigger } from '~/components/ui/popover'
import { PhoneInput } from '~/components/ui/input'
import { cn } from '~/lib/utils'
import { Gender, GENDER_LABELS } from '~/enums/gender.enum'

export interface PatientCreatePayload {
  full_name: string
  phone: string
  email: string
  date_of_birth: string
  gender: '' | 'male' | 'female' | 'other'
  address: string
  emergency_contact_name: string
  emergency_contact_phone: string
  notes: string
  medical_history: {
    past_surgeries: string[]
    current_medications: string[]
    allergies: string[]
    conditions: string[]
    notes: string
  }
}

const props = defineProps<{
  open: boolean
}>()

const emit = defineEmits<{
  (e: 'update:open', value: boolean): void
  (e: 'submit', payload: PatientCreatePayload): void
}>()

const dialogOpen = computed({
  get: () => props.open,
  set: (value: boolean) => emit('update:open', value),
})

function createEmptyForm(): PatientCreatePayload {
  return {
    full_name: '',
    phone: '',
    email: '',
    date_of_birth: '',
    gender: '',
    address: '',
    emergency_contact_name: '',
    emergency_contact_phone: '',
    notes: '',
    medical_history: {
      past_surgeries: [],
      current_medications: [],
      allergies: [],
      conditions: [],
      notes: '',
    },
  }
}

const form = ref<PatientCreatePayload>(createEmptyForm())
const isSubmitting = ref(false)
const dobPickerOpen = ref(false)

const dobCalendarValue = computed<DateValue | undefined>({
  get() {
    if (!form.value.date_of_birth) return undefined
    const [year, month, day] = form.value.date_of_birth.split('-').map(Number) as [
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
      form.value.date_of_birth = `${y}-${m}-${d}`
    } else {
      form.value.date_of_birth = ''
    }
    dobPickerOpen.value = false
  },
})

const formattedDob = computed(() => {
  if (!form.value.date_of_birth) return ''
  return new Date(form.value.date_of_birth + 'T00:00:00').toLocaleDateString('en-IN', {
    year: 'numeric',
    month: 'short',
    day: 'numeric',
  })
})

function markSubmitted() {
  isSubmitting.value = false
}

watch(
  () => props.open,
  (isOpen) => {
    if (!isOpen) {
      form.value = createEmptyForm()
      isSubmitting.value = false
    }
  },
)

function onSubmit() {
  isSubmitting.value = true
  emit('submit', { ...form.value })
}

defineExpose({ markSubmitted })
</script>
