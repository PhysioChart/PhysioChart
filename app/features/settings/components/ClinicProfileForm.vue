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
    </CardHeader>
    <CardContent>
      <form class="space-y-4" @submit.prevent="onSubmit">
        <div class="grid gap-4 sm:grid-cols-2">
          <div class="sm:col-span-2">
            <Label for="clinic-name">Clinic Name</Label>
            <Input
              id="clinic-name"
              v-model="form.name"
              placeholder="Your clinic name"
              :disabled="!isAdmin"
            />
          </div>
          <div>
            <Label for="clinic-phone">Phone</Label>
            <PhoneInput
              id="clinic-phone"
              v-model="form.phone"
              placeholder="98765 43210"
              :disabled="!isAdmin"
            />
          </div>
          <div>
            <Label for="clinic-email">Email</Label>
            <Input
              id="clinic-email"
              v-model="form.email"
              type="email"
              placeholder="clinic@example.com"
              :disabled="!isAdmin"
            />
          </div>
          <div class="sm:col-span-2">
            <Label for="clinic-address">Address</Label>
            <Textarea
              id="clinic-address"
              v-model="form.address"
              placeholder="Clinic address"
              rows="2"
              :disabled="!isAdmin"
            />
          </div>
          <div class="sm:col-span-2">
            <Label for="clinic-logo">Logo URL</Label>
            <Input
              id="clinic-logo"
              v-model="form.logo_url"
              placeholder="https://example.com/logo.png"
              :disabled="!isAdmin"
            />
          </div>
        </div>
        <Button v-if="isAdmin" type="submit" size="lg" :disabled="isSaving">
          {{ isSaving ? 'Saving...' : 'Save Changes' }}
        </Button>
      </form>
    </CardContent>
  </Card>
</template>

<script setup lang="ts">
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

const form = ref<ClinicProfilePayload>({ ...props.clinic })

watch(
  () => props.clinic,
  (newClinic) => {
    form.value = { ...newClinic }
  },
)

function onSubmit() {
  emit('submit', { ...form.value })
}
</script>
