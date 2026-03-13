<template>
  <ResponsiveFormOverlay :open="dialogOpen" desktop-width="lg" @update:open="dialogOpen = $event">
    <form class="flex min-h-0 flex-1 flex-col" @submit.prevent="onSave">
      <DialogHeader
        class="bg-background shrink-0 border-b px-4 py-4 [padding-top:max(1rem,env(safe-area-inset-top))] text-left sm:px-6"
      >
        <DialogTitle>Edit Patient</DialogTitle>
      </DialogHeader>
      <div class="min-h-0 flex-1 overflow-y-auto overscroll-contain px-4 py-4 sm:px-6">
        <div class="grid gap-4 sm:grid-cols-2">
          <div class="space-y-2 sm:col-span-2">
            <Label for="edit-name">Full Name</Label>
            <Input id="edit-name" v-model="form.full_name" placeholder="Patient name" />
          </div>
          <div class="space-y-2">
            <Label for="edit-phone">Phone</Label>
            <PhoneInput id="edit-phone" v-model="form.phone" placeholder="98765 43210" />
          </div>
          <div class="space-y-2">
            <Label for="edit-email">Email</Label>
            <Input id="edit-email" v-model="form.email" type="email" placeholder="Optional" />
          </div>
          <div class="space-y-2">
            <Label for="edit-dob">Date of Birth</Label>
            <Popover v-model:open="dobPickerOpen" modal>
              <PopoverTrigger as-child>
                <Button
                  id="edit-dob"
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
            <Label for="edit-gender">Gender</Label>
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
            <Label for="edit-address">Address</Label>
            <Textarea id="edit-address" v-model="form.address" placeholder="Optional" rows="2" />
          </div>
          <div class="space-y-2">
            <Label for="edit-ec-name">Emergency Contact Name</Label>
            <Input id="edit-ec-name" v-model="form.emergency_contact_name" placeholder="Optional" />
          </div>
          <div class="space-y-2">
            <Label for="edit-ec-phone">Emergency Contact Phone</Label>
            <PhoneInput
              id="edit-ec-phone"
              v-model="form.emergency_contact_phone"
              placeholder="Optional"
            />
          </div>
          <div class="space-y-2 sm:col-span-2">
            <Label for="edit-notes">Notes</Label>
            <Textarea
              id="edit-notes"
              v-model="form.notes"
              placeholder="Any additional notes"
              rows="2"
            />
          </div>
        </div>
      </div>
      <DialogFooter
        class="bg-background shrink-0 border-t px-4 py-4 [padding-bottom:max(1rem,env(safe-area-inset-bottom))] sm:px-6"
      >
        <Button type="button" variant="outline" @click="dialogOpen = false">Cancel</Button>
        <Button type="submit" :disabled="isSaving">
          {{ isSaving ? 'Saving...' : 'Save Changes' }}
        </Button>
      </DialogFooter>
    </form>
  </ResponsiveFormOverlay>
</template>

<script setup lang="ts">
import type { DateValue } from 'reka-ui'
import type { Tables } from '~/types/database'
import type { IPatientEditForm } from '~/types/models/patient.types'
import { CalendarDate } from '@internationalized/date'
import { CalendarIcon } from 'lucide-vue-next'
import { Calendar } from '~/components/ui/calendar'
import { Popover, PopoverContent, PopoverTrigger } from '~/components/ui/popover'
import { cn } from '~/lib/utils'
import { Gender, GENDER_LABELS } from '~/enums/gender.enum'
import { PhoneInput } from '~/components/ui/input'

const props = defineProps<{
  open: boolean
  isSaving: boolean
  patient: Tables<'patients'> | null
  buildEditForm: (patient: Tables<'patients'>) => IPatientEditForm
}>()

const emit = defineEmits<{
  (e: 'update:open', value: boolean): void
  (e: 'save', form: IPatientEditForm): void
}>()

const form = ref<IPatientEditForm>({
  full_name: '',
  phone: '',
  email: '',
  date_of_birth: '',
  gender: '',
  address: '',
  emergency_contact_name: '',
  emergency_contact_phone: '',
  notes: '',
})

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

const dialogOpen = computed({
  get: () => props.open,
  set: (value: boolean) => emit('update:open', value),
})

watch(
  [() => props.open, () => props.patient],
  ([open, patientData]) => {
    if (!open || !patientData) return
    form.value = props.buildEditForm(patientData)
  },
  { immediate: true },
)

function onSave() {
  emit('save', form.value)
}
</script>
