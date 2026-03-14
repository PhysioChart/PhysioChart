<template>
  <div class="flex min-h-screen items-center justify-center px-4">
    <Card class="w-full max-w-md">
      <CardHeader>
        <CardTitle>Finish setting up your clinic</CardTitle>
        <CardDescription>
          Your account exists, but the clinic workspace still needs to be created.
        </CardDescription>
      </CardHeader>
      <CardContent>
        <form class="space-y-4" @submit.prevent="submit">
          <div v-if="error" class="bg-destructive/10 text-destructive rounded-lg p-3 text-sm">
            {{ error }}
          </div>
          <div class="space-y-2">
            <Label for="clinic-name">Clinic Name</Label>
            <Input
              id="clinic-name"
              v-model="clinicName"
              placeholder="Your clinic name"
              :disabled="isSubmitting"
            />
          </div>
          <div class="space-y-2">
            <Label for="full-name">Your Name</Label>
            <Input
              id="full-name"
              v-model="fullName"
              placeholder="Your full name"
              :disabled="isSubmitting"
            />
          </div>
          <Button type="submit" class="w-full" :disabled="isSubmitting">
            {{ isSubmitting ? 'Saving...' : 'Finish setup' }}
          </Button>
        </form>
      </CardContent>
    </Card>
  </div>
</template>

<script setup lang="ts">
definePageMeta({ layout: 'auth' })

useHead({ title: 'Setup Your Clinic' })

const { onboardingDraft, completeOnboarding } = useAuth()
const clinicName = ref(onboardingDraft.value?.clinicName ?? '')
const fullName = ref(onboardingDraft.value?.fullName ?? '')
const error = ref('')
const isSubmitting = ref(false)

async function submit() {
  error.value = ''
  isSubmitting.value = true

  try {
    await completeOnboarding(clinicName.value, fullName.value)
    await navigateTo('/home')
  } catch (err: unknown) {
    error.value = err instanceof Error ? err.message : 'Failed to finish onboarding'
  } finally {
    isSubmitting.value = false
  }
}
</script>
