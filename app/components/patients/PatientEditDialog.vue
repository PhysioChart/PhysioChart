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
            <Input v-model="form.phone" />
          </div>
          <div>
            <Label>Email</Label>
            <Input v-model="form.email" type="email" />
          </div>
          <div>
            <Label>Date of Birth</Label>
            <Input v-model="form.date_of_birth" type="date" />
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
            <Input v-model="form.emergency_contact_phone" />
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
import type { Tables } from '~/types/database'
import type { IPatientEditForm } from '~/types/models/patient.types'
import { Gender, GENDER_LABELS } from '~/enums/gender.enum'

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
