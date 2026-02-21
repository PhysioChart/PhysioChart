<script setup lang="ts">
import { toTypedSchema } from '@vee-validate/zod'
import { useForm } from 'vee-validate'
import { z } from 'zod'
import { Building2 } from 'lucide-vue-next'

definePageMeta({ layout: 'auth' })

const { signUp } = useAuth()
const error = ref('')
const isLoading = ref(false)

const schema = toTypedSchema(
  z.object({
    clinicName: z.string().min(2, 'Clinic name is required'),
    fullName: z.string().min(2, 'Your name is required'),
    email: z.string().email('Enter a valid email'),
    password: z.string().min(6, 'Password must be at least 6 characters'),
  }),
)

const { handleSubmit } = useForm({ validationSchema: schema })

const onSubmit = handleSubmit(async (values) => {
  error.value = ''
  isLoading.value = true
  try {
    await signUp(values.clinicName, values.fullName, values.email, values.password)
    await navigateTo('/dashboard')
  } catch (e: unknown) {
    error.value = e instanceof Error ? e.message : 'Registration failed'
  } finally {
    isLoading.value = false
  }
})
</script>

<template>
  <div class="bg-muted/40 flex min-h-screen items-center justify-center px-4">
    <Card class="w-full max-w-md">
      <CardHeader class="text-center">
        <div class="bg-primary mx-auto mb-2 flex h-12 w-12 items-center justify-center rounded-xl">
          <Building2 class="text-primary-foreground h-6 w-6" />
        </div>
        <CardTitle class="text-2xl">Register your clinic</CardTitle>
        <CardDescription>Create a free MedPractice account</CardDescription>
      </CardHeader>
      <CardContent>
        <form class="space-y-4" @submit="onSubmit">
          <div v-if="error" class="bg-destructive/10 text-destructive rounded-lg p-3 text-sm">
            {{ error }}
          </div>

          <FormField v-slot="{ componentField }" name="clinicName">
            <FormItem>
              <FormLabel>Clinic Name</FormLabel>
              <FormControl>
                <Input
                  placeholder="Sunrise Physiotherapy"
                  v-bind="componentField"
                  :disabled="isLoading"
                />
              </FormControl>
              <FormMessage />
            </FormItem>
          </FormField>

          <FormField v-slot="{ componentField }" name="fullName">
            <FormItem>
              <FormLabel>Your Name</FormLabel>
              <FormControl>
                <Input placeholder="Dr. Sharma" v-bind="componentField" :disabled="isLoading" />
              </FormControl>
              <FormMessage />
            </FormItem>
          </FormField>

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
                  placeholder="At least 6 characters"
                  v-bind="componentField"
                  :disabled="isLoading"
                />
              </FormControl>
              <FormMessage />
            </FormItem>
          </FormField>

          <Button type="submit" class="w-full" :disabled="isLoading">
            <template v-if="isLoading">Creating account...</template>
            <template v-else>Create account</template>
          </Button>

          <p class="text-muted-foreground text-center text-xs">
            By registering, you agree to our privacy policy and terms of service.
          </p>
        </form>
      </CardContent>
      <CardFooter class="justify-center">
        <p class="text-muted-foreground text-sm">
          Already have an account?
          <NuxtLink to="/login" class="text-primary font-medium hover:underline">
            Sign in
          </NuxtLink>
        </p>
      </CardFooter>
    </Card>
  </div>
</template>
