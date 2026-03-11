<template>
  <Card class="w-full max-w-md">
    <CardHeader class="text-center">
      <div class="bg-primary mx-auto mb-2 flex h-12 w-12 items-center justify-center rounded-xl">
        <LogIn class="text-primary-foreground h-6 w-6" />
      </div>
      <CardTitle class="text-2xl">Welcome back</CardTitle>
      <CardDescription>Sign in to your PhysioChart account</CardDescription>
    </CardHeader>
    <CardContent>
      <form class="space-y-4" @submit="onSubmit">
        <div v-if="error" class="bg-destructive/10 text-destructive rounded-lg p-3 text-sm">
          {{ error }}
        </div>

        <FormField v-slot="{ componentField }" name="email">
          <FormItem>
            <FormLabel>Email</FormLabel>
            <FormControl>
              <Input
                type="email"
                placeholder="doctor@clinic.com"
                v-bind="componentField"
                :disabled="isLoading"
              />
            </FormControl>
            <FormMessage />
          </FormItem>
        </FormField>

        <FormField v-slot="{ componentField }" name="password">
          <FormItem>
            <FormLabel>Password</FormLabel>
            <FormControl>
              <Input
                type="password"
                placeholder="Enter your password"
                v-bind="componentField"
                :disabled="isLoading"
              />
            </FormControl>
            <FormMessage />
          </FormItem>
        </FormField>

        <Button type="submit" size="lg" class="w-full" :disabled="isLoading">
          <template v-if="isLoading">Signing in...</template>
          <template v-else>Sign in</template>
        </Button>
      </form>
    </CardContent>
    <CardFooter class="justify-center">
      <p class="text-muted-foreground text-sm">
        Don't have an account?
        <NuxtLink to="/register" class="text-primary font-medium hover:underline">
          Register your clinic
        </NuxtLink>
      </p>
    </CardFooter>
  </Card>
</template>

<script setup lang="ts">
import { toTypedSchema } from '@vee-validate/zod'
import { useForm } from 'vee-validate'
import { z } from 'zod'
import { LogIn } from 'lucide-vue-next'

definePageMeta({
  layout: 'auth',
  middleware: 'guest',
  hideAuthHeader: true,
  authCentered: true,
})

useHead({
  title: 'Log In',
  meta: [{ name: 'description', content: 'Log in to your PhysioChart account' }],
})

const { signIn } = useAuth()
const route = useRoute()
const error = ref('')
const isLoading = ref(false)

const schema = toTypedSchema(
  z.object({
    email: z.string().email('Enter a valid email'),
    password: z.string().min(6, 'Password must be at least 6 characters'),
  }),
)

const { handleSubmit, setFieldValue } = useForm({ validationSchema: schema })

onMounted(() => {
  if (typeof route.query.email === 'string') {
    setFieldValue('email', route.query.email)
  }
})

const onSubmit = handleSubmit(async (values) => {
  error.value = ''
  isLoading.value = true
  try {
    await signIn({
      email: values.email,
      password: values.password,
      resumeInviteToken: typeof route.query.invite === 'string' ? route.query.invite : undefined,
    })
  } catch (e: unknown) {
    error.value = e instanceof Error ? e.message : 'Login failed'
  } finally {
    isLoading.value = false
  }
})
</script>
