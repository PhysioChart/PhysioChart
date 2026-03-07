<template>
  <div class="flex min-h-screen items-center justify-center px-4">
    <Card class="w-full max-w-md">
      <CardHeader class="text-center">
        <CardTitle>Confirming your session</CardTitle>
        <CardDescription> We are finishing the secure sign-in redirect. </CardDescription>
      </CardHeader>
      <CardContent class="flex justify-center">
        <div
          v-if="!hasFailed"
          class="border-primary h-8 w-8 animate-spin rounded-full border-4 border-t-transparent"
        />
        <div v-else class="text-center text-sm">
          <p class="text-muted-foreground">
            We could not finish the sign-in callback. Try signing in again.
          </p>
          <Button class="mt-4" @click="backToLogin">Back to login</Button>
        </div>
      </CardContent>
    </Card>
  </div>
</template>

<script setup lang="ts">
definePageMeta({ layout: 'auth' })

const { ensureBootstrapped, bootstrapStatus } = useAuth()
const session = useSupabaseSession()
const redirect = useSupabaseCookieRedirect()
const hasFailed = ref(false)

function sessionUserId(value: unknown): string | null {
  if (!value || typeof value !== 'object') return null
  const user = (value as { user?: { id?: string } }).user
  return typeof user?.id === 'string' ? user.id : null
}

const timeout = setTimeout(() => {
  hasFailed.value = true
  redirect.pluck()
}, 5000)

watch(
  session,
  async (value) => {
    const userId = sessionUserId(value)
    if (!userId || hasFailed.value) return

    clearTimeout(timeout)
    await ensureBootstrapped({ userId, force: true })

    if (bootstrapStatus.value === 'needs_onboarding') {
      await navigateTo('/onboarding', { replace: true })
      return
    }

    await navigateTo(redirect.pluck() || '/home', { replace: true })
  },
  { immediate: true },
)

async function backToLogin() {
  redirect.pluck()
  await navigateTo('/login', { replace: true })
}

onBeforeUnmount(() => {
  clearTimeout(timeout)
})
</script>
