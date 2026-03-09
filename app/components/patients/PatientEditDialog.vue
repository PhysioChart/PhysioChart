<template>
  <Dialog v-model:open="dialogOpen">
    <DialogContent class="max-h-[90vh] overflow-y-auto sm:max-w-lg">
      <DialogHeader>
        <DialogTitle>Edit Patient</DialogTitle>
      </DialogHeader>
      <form class="space-y-4" @submit.prevent="onSave">
        <div class="grid gap-4 sm:grid-cols-2">
          <div class="sm:col-span-2">
            <Label>Full Name</Label>
            <Input v-model="form.full_name" />
          </div>
          <div>
            <Label>Phone</Label>
            <PhoneInput v-model="form.phone" />
          </div>
          <div>
            <Label>Email</Label>
            <Input v-model="form.email" type="email" />
          </div>
          <div>
            <Label>Date of Birth</Label>
            <Popover v-model:open="dobPickerOpen" modal>
              <PopoverTrigger as-child>
                <Button
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
          <div>
            <Label>Gender</Label>
            <Select v-model="form.gender">
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem :value="Gender.MALE">{{ GENDER_LABELS[Gender.MALE] }}</SelectItem>
                <SelectItem :value="Gender.FEMALE">{{ GENDER_LABELS[Gender.FEMALE] }}</SelectItem>
                <SelectItem :value="Gender.OTHER">{{ GENDER_LABELS[Gender.OTHER] }}</SelectItem>
              </SelectContent>
            </Select>
          </div>
          <div class="sm:col-span-2">
            <Label>Address</Label>
            <Textarea v-model="form.address" rows="2" />
          </div>
          <div>
            <Label>Emergency Contact Name</Label>
            <Input v-model="form.emergency_contact_name" />
          </div>
          <div>
            <Label>Emergency Contact Phone</Label>
            <PhoneInput v-model="form.emergency_contact_phone" />
          </div>
          <div class="sm:col-span-2">
            <Label>Notes</Label>
            <Textarea v-model="form.notes" rows="2" />
          </div>
        </div>
        <DialogFooter>
          <Button type="button" variant="outline" @click="dialogOpen = false">Cancel</Button>
          <Button type="submit" :disabled="isSaving">
            {{ isSaving ? 'Saving...' : 'Save Changes' }}
          </Button>
        </DialogFooter>
      </form>
    </DialogContent>
  </Dialog>
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
    const [year, month, day] = form.value.date_of_birth.split('-').map(Number) as [number, number, number]
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
