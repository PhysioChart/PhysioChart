<template>
  <div class="flex min-h-screen items-center justify-center px-4">
    <Card class="w-full max-w-md">
      <CardHeader>
        <CardTitle>Join your clinic workspace</CardTitle>
        <CardDescription v-if="preview?.is_valid">
          <span class="font-medium">{{ preview.clinic_name }}</span>
          invited a {{ roleLabel }} account for {{ preview.masked_email }}.
        </CardDescription>
        <CardDescription v-else> This invite is invalid or expired. </CardDescription>
      </CardHeader>
      <CardContent v-if="preview?.is_valid">
        <div v-if="error" class="bg-destructive/10 text-destructive mb-4 rounded-lg p-3 text-sm">
          {{ error }}
        </div>

        <div v-if="isAuthenticated" class="space-y-4">
          <p class="text-muted-foreground text-sm">
            You are signed in. Redeem this invite to join the clinic.
          </p>
          <div>
            <Label for="invite-full-name">Full Name</Label>
            <Input id="invite-full-name" v-model="fullName" :disabled="isWorking" />
          </div>
          <Button class="w-full" :disabled="isWorking || !fullName" @click="redeemInvite">
            {{ isWorking ? 'Joining...' : 'Accept invite' }}
          </Button>
        </div>

        <div v-else class="space-y-4">
          <Tabs v-model="mode" class="w-full">
            <TabsList class="grid w-full grid-cols-2">
              <TabsTrigger value="signup">Create account</TabsTrigger>
              <TabsTrigger value="login">I already have one</TabsTrigger>
            </TabsList>
            <TabsContent value="signup" class="mt-4 space-y-4">
              <div>
                <Label for="invite-email">Invited Email</Label>
                <Input
                  id="invite-email"
                  v-model="email"
                  type="email"
                  placeholder="Use the invited email"
                  :disabled="isWorking"
                />
              </div>
              <div>
                <Label for="invite-name">Full Name</Label>
                <Input id="invite-name" v-model="fullName" :disabled="isWorking" />
              </div>
              <div>
                <Label for="invite-password">Password</Label>
                <Input
                  id="invite-password"
                  v-model="password"
                  type="password"
                  placeholder="Create a password"
                  :disabled="isWorking"
                />
              </div>
              <Button
                class="w-full"
                :disabled="isWorking || !email || !fullName || !password"
                @click="createAccount"
              >
                {{ isWorking ? 'Creating account...' : 'Create account and join' }}
              </Button>
            </TabsContent>
            <TabsContent value="login" class="mt-4 space-y-4">
              <p class="text-muted-foreground text-sm">
                Sign in with the invited email, then we will resume this invite automatically.
              </p>
              <Button class="w-full" variant="outline" @click="goToLogin">Continue to login</Button>
            </TabsContent>
          </Tabs>
        </div>
      </CardContent>
      <CardContent v-else>
        <Button class="w-full" @click="navigateTo('/login')">Back to login</Button>
      </CardContent>
    </Card>
  </div>
</template>

<script setup lang="ts">
definePageMeta({ layout: 'auth' })

useHead({
  meta: [{ name: 'referrer', content: 'no-referrer' }],
})

const route = useRoute()
const token = computed(() => route.params.token as string)
const { isAuthenticated, pendingInviteToken, signUpFromInvite, acceptInvite, fetchInvitePreview } =
  useAuth()

const preview = ref<Awaited<ReturnType<typeof fetchInvitePreview>> | null>(null)
const error = ref('')
const isWorking = ref(false)
const fullName = ref('')
const email = ref('')
const password = ref('')
const mode = ref<'signup' | 'login'>('signup')

const roleLabel = computed(() => (preview.value?.role === 'admin' ? 'administrator' : 'staff'))

async function loadPreview() {
  preview.value = await fetchInvitePreview(token.value)
}

async function redeemInvite() {
  error.value = ''
  isWorking.value = true
  try {
    await acceptInvite({ token: token.value, fullName: fullName.value })
    await navigateTo('/home')
  } catch (err: unknown) {
    error.value = err instanceof Error ? err.message : 'Failed to accept invite'
  } finally {
    isWorking.value = false
  }
}

async function createAccount() {
  error.value = ''
  isWorking.value = true

  try {
    const result = await signUpFromInvite({
      token: token.value,
      email: email.value,
      password: password.value,
      fullName: fullName.value,
    })

    if (result.requiresLogin) {
      pendingInviteToken.value = token.value
      await navigateTo({ path: '/login', query: { invite: token.value, email: email.value } })
    }
  } catch (err: unknown) {
    error.value = err instanceof Error ? err.message : 'Failed to create account'
  } finally {
    isWorking.value = false
  }
}

async function goToLogin() {
  pendingInviteToken.value = token.value
  await navigateTo({
    path: '/login',
    query: { invite: token.value, email: email.value || undefined },
  })
}

onMounted(async () => {
  await loadPreview()
})
</script>
