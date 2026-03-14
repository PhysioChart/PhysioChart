<template>
  <Card>
    <CardHeader>
      <CardTitle>Clinic Information</CardTitle>
      <CardDescription>
        {{
          isAdmin
            ? 'Update your clinic details.'
            : 'View your clinic details. Only admins can edit.'
        }}
      </CardDescription>
      <CardAction v-if="isAdmin && !isEditing">
        <Button variant="outline" size="sm" @click="startEditing">
          <Pencil class="mr-1.5 h-3.5 w-3.5" />
          Edit
        </Button>
      </CardAction>
    </CardHeader>
    <CardContent>
      <!-- Read-only view -->
      <dl v-if="!isEditing" class="grid gap-3 sm:grid-cols-2">
        <div class="flex items-center gap-2 sm:col-span-2">
          <Building2 class="text-muted-foreground h-4 w-4 shrink-0" />
          <div>
            <dt class="text-muted-foreground text-xs">Clinic Name</dt>
            <dd class="text-sm font-medium">{{ clinic.name || '—' }}</dd>
          </div>
        </div>
        <div class="flex items-center gap-2">
          <Phone class="text-muted-foreground h-4 w-4 shrink-0" />
          <div>
            <dt class="text-muted-foreground text-xs">Phone</dt>
            <dd class="text-sm font-medium">{{ clinic.phone || '—' }}</dd>
          </div>
        </div>
        <div class="flex items-center gap-2">
          <Mail class="text-muted-foreground h-4 w-4 shrink-0" />
          <div>
            <dt class="text-muted-foreground text-xs">Email</dt>
            <dd class="text-sm font-medium">{{ clinic.email || '—' }}</dd>
          </div>
        </div>
        <div class="flex items-center gap-2 sm:col-span-2">
          <MapPin class="text-muted-foreground h-4 w-4 shrink-0" />
          <div>
            <dt class="text-muted-foreground text-xs">Address</dt>
            <dd class="text-sm font-medium">{{ clinic.address || '—' }}</dd>
          </div>
        </div>
        <div class="flex items-center gap-2 sm:col-span-2">
          <ImageIcon class="text-muted-foreground h-4 w-4 shrink-0" />
          <div>
            <dt class="text-muted-foreground text-xs">Logo URL</dt>
            <dd class="text-sm font-medium">{{ clinic.logo_url || '—' }}</dd>
          </div>
        </div>
      </dl>

      <!-- Edit view -->
      <form v-else class="space-y-4" @submit.prevent="onSubmit">
        <div class="grid gap-4 sm:grid-cols-2">
          <div class="space-y-2 sm:col-span-2">
            <Label for="clinic-name">Clinic Name</Label>
            <Input id="clinic-name" v-model="form.name" placeholder="Your clinic name" />
          </div>
          <div class="space-y-2">
            <Label for="clinic-phone">Phone</Label>
            <PhoneInput id="clinic-phone" v-model="form.phone" placeholder="98765 43210" />
          </div>
          <div class="space-y-2">
            <Label for="clinic-email">Email</Label>
            <Input
              id="clinic-email"
              v-model="form.email"
              type="email"
              placeholder="clinic@example.com"
            />
          </div>
          <div class="space-y-2 sm:col-span-2">
            <Label for="clinic-address">Address</Label>
            <Textarea
              id="clinic-address"
              v-model="form.address"
              placeholder="Clinic address"
              rows="2"
            />
          </div>
          <div class="space-y-2 sm:col-span-2">
            <Label for="clinic-logo">Logo URL</Label>
            <Input
              id="clinic-logo"
              v-model="form.logo_url"
              placeholder="https://example.com/logo.png"
            />
          </div>
        </div>
        <div class="flex gap-2">
          <Button type="submit" :disabled="isSaving">
            {{ isSaving ? 'Saving...' : 'Save Changes' }}
          </Button>
          <Button type="button" variant="outline" :disabled="isSaving" @click="cancelEditing">
            Cancel
          </Button>
        </div>
      </form>
    </CardContent>
  </Card>
</template>

<script setup lang="ts">
import { Building2, Phone, Mail, MapPin, ImageIcon, Pencil } from 'lucide-vue-next'
import { PhoneInput } from '~/components/ui/input'

export interface ClinicProfilePayload {
  name: string
  address: string
  phone: string
  email: string
  logo_url: string
}

const props = defineProps<{
  clinic: ClinicProfilePayload
  isAdmin: boolean
  isSaving: boolean
}>()

const emit = defineEmits<{
  (e: 'submit', payload: ClinicProfilePayload): void
}>()

const isEditing = ref(false)
const form = ref<ClinicProfilePayload>({ ...props.clinic })

watch(
  () => props.clinic,
  (newClinic) => {
    if (!isEditing.value) {
      form.value = { ...newClinic }
    }
  },
)

function startEditing() {
  form.value = { ...props.clinic }
  isEditing.value = true
}

function cancelEditing() {
  form.value = { ...props.clinic }
  isEditing.value = false
}

function markSaved() {
  isEditing.value = false
}

function onSubmit() {
  emit('submit', { ...form.value })
}

defineExpose({ markSaved })
</script>
