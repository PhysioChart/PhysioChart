<template>
  <Dialog v-model:open="dialogOpen">
    <DialogContent class="sm:max-w-md">
      <DialogHeader>
        <DialogTitle>Invite Staff Member</DialogTitle>
        <DialogDescription> Send a secure invite link for a new staff member. </DialogDescription>
      </DialogHeader>
      <form class="space-y-4" @submit.prevent="onSubmit">
        <div>
          <Label>Email *</Label>
          <Input v-model="form.email" type="email" placeholder="staff@clinic.com" />
        </div>
        <div>
          <Label>Role</Label>
          <Select v-model="form.role">
            <SelectTrigger>
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem :value="UserRole.STAFF">Staff (Therapist/Receptionist)</SelectItem>
              <SelectItem :value="UserRole.ADMIN">Admin (Full access)</SelectItem>
            </SelectContent>
          </Select>
        </div>
        <DialogFooter>
          <Button type="button" variant="outline" @click="dialogOpen = false">Cancel</Button>
          <Button type="submit" :disabled="isSubmitting || !form.email">
            {{ isSubmitting ? 'Creating...' : 'Create Invite Link' }}
          </Button>
        </DialogFooter>
      </form>
    </DialogContent>
  </Dialog>
</template>

<script setup lang="ts">
import { UserRole } from '~/enums/user-role.enum'

export interface StaffInvitePayload {
  email: string
  role: UserRole
}

const props = defineProps<{
  open: boolean
}>()

const emit = defineEmits<{
  (e: 'update:open', value: boolean): void
  (e: 'submit', payload: StaffInvitePayload): void
}>()

const dialogOpen = computed({
  get: () => props.open,
  set: (value: boolean) => emit('update:open', value),
})

function createEmptyForm(): StaffInvitePayload {
  return {
    email: '',
    role: UserRole.STAFF,
  }
}

const form = ref<StaffInvitePayload>(createEmptyForm())
const isSubmitting = ref(false)

watch(
  () => props.open,
  (isOpen) => {
    if (!isOpen) {
      form.value = createEmptyForm()
      isSubmitting.value = false
    }
  },
)

function markSubmitted() {
  isSubmitting.value = false
}

function onSubmit() {
  isSubmitting.value = true
  emit('submit', { ...form.value })
}

defineExpose({ markSubmitted })
</script>
