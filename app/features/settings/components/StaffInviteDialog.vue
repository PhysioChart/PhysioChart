<template>
  <ResponsiveFormOverlay :open="dialogOpen" @update:open="dialogOpen = $event">
    <!-- Success state: show generated invite URL -->
    <div v-if="generatedUrl" class="flex min-h-0 flex-1 flex-col">
      <DialogHeader
        class="bg-background shrink-0 border-b px-4 py-4 [padding-top:max(1rem,env(safe-area-inset-top))] text-left sm:px-6"
      >
        <DialogTitle>Invite Link Created</DialogTitle>
        <DialogDescription
          >Share this link with the staff member. It expires in 7 days.</DialogDescription
        >
      </DialogHeader>
      <div class="min-h-0 flex-1 overflow-y-auto overscroll-contain px-4 py-4 sm:px-6">
        <div class="space-y-3">
          <Label>Invite URL</Label>
          <div class="flex gap-2">
            <Input :model-value="generatedUrl" readonly class="font-mono text-xs" />
            <Button
              type="button"
              variant="outline"
              size="icon"
              class="shrink-0"
              @click="handleCopy"
            >
              <Check v-if="copied" class="h-4 w-4" />
              <Copy v-else class="h-4 w-4" />
            </Button>
          </div>
        </div>
      </div>
      <DialogFooter
        class="bg-background shrink-0 border-t px-4 py-4 [padding-bottom:max(1rem,env(safe-area-inset-bottom))] sm:px-6"
      >
        <Button type="button" @click="dialogOpen = false">Done</Button>
      </DialogFooter>
    </div>

    <!-- Form state: collect email + role -->
    <form v-else class="flex min-h-0 flex-1 flex-col" @submit.prevent="onSubmit">
      <DialogHeader
        class="bg-background shrink-0 border-b px-4 py-4 [padding-top:max(1rem,env(safe-area-inset-top))] text-left sm:px-6"
      >
        <DialogTitle>Invite Staff Member</DialogTitle>
        <DialogDescription>Send a secure invite link for a new staff member.</DialogDescription>
      </DialogHeader>
      <div class="min-h-0 flex-1 overflow-y-auto overscroll-contain px-4 py-4 sm:px-6">
        <div class="space-y-4">
          <div class="space-y-2">
            <Label for="invite-email">Email *</Label>
            <Input
              id="invite-email"
              v-model="form.email"
              type="email"
              placeholder="staff@clinic.com"
            />
          </div>
          <div class="space-y-2">
            <Label for="invite-role">Role</Label>
            <Select v-model="form.role">
              <SelectTrigger id="invite-role">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem :value="UserRole.STAFF">Staff (Therapist/Receptionist)</SelectItem>
                <SelectItem :value="UserRole.ADMIN">Admin (Full access)</SelectItem>
              </SelectContent>
            </Select>
          </div>
        </div>
      </div>
      <DialogFooter
        class="bg-background shrink-0 border-t px-4 py-4 [padding-bottom:max(1rem,env(safe-area-inset-bottom))] sm:px-6"
      >
        <Button type="button" variant="outline" @click="dialogOpen = false">Cancel</Button>
        <Button type="submit" :disabled="isSubmitting || !form.email">
          {{ isSubmitting ? 'Creating...' : 'Create Invite Link' }}
        </Button>
      </DialogFooter>
    </form>
  </ResponsiveFormOverlay>
</template>

<script setup lang="ts">
import { Check, Copy } from 'lucide-vue-next'
import { toast } from 'vue-sonner'
import { UserRole } from '~/enums/user-role.enum'
import ResponsiveFormOverlay from '~/components/common/ResponsiveFormOverlay.vue'

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
const generatedUrl = ref<string | null>(null)
const copied = ref(false)

watch(
  () => props.open,
  (isOpen) => {
    if (!isOpen) {
      form.value = createEmptyForm()
      isSubmitting.value = false
      generatedUrl.value = null
      copied.value = false
    }
  },
)

function showResult(url: string) {
  generatedUrl.value = url
  isSubmitting.value = false
}

async function handleCopy() {
  if (!generatedUrl.value) return
  try {
    await navigator.clipboard.writeText(generatedUrl.value)
    copied.value = true
    toast.success('Invite link copied to clipboard')
    setTimeout(() => {
      copied.value = false
    }, 2000)
  } catch {
    toast.error('Failed to copy — please select and copy manually')
  }
}

function onSubmit() {
  isSubmitting.value = true
  emit('submit', { ...form.value })
}

function resetSubmitting() {
  isSubmitting.value = false
}

defineExpose({ showResult, resetSubmitting })
</script>
