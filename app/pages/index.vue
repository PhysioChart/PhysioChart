<template>
  <div class="flex min-h-[calc(100vh-3.5rem)] flex-col">
    <section class="flex flex-1 flex-col items-center justify-center px-4 py-16 text-center">
      <div
        class="bg-primary/10 text-primary mb-6 inline-flex items-center gap-2 rounded-full px-4 py-1.5 text-sm font-medium"
      >
        <Stethoscope class="h-4 w-4" />
        Built for physiotherapy clinics
      </div>

      <h1 class="max-w-2xl text-4xl font-bold tracking-tight sm:text-5xl">
        Run your clinic, not spreadsheets
      </h1>

      <p class="text-muted-foreground mt-4 max-w-lg text-lg">
        MedPractice handles appointments, treatment tracking, billing, and patient records — so you
        can focus on patient care.
      </p>

      <div class="mt-8 flex flex-wrap items-center justify-center gap-3">
        <Button size="lg" as-child>
          <NuxtLink to="/register">Start free</NuxtLink>
        </Button>
        <Button size="lg" variant="outline" as-child>
          <a :href="whatsappUrl" target="_blank" rel="noopener noreferrer">
            <MessageCircle class="mr-2 h-4 w-4" />
            Get a demo
          </a>
        </Button>
      </div>

      <p class="text-muted-foreground mt-3 text-sm">No credit card required</p>
    </section>

    <section class="border-t px-4 py-16">
      <div class="mx-auto max-w-4xl">
        <h2 class="mb-10 text-center text-2xl font-semibold tracking-tight">
          Everything your clinic needs
        </h2>

        <div class="grid gap-6 sm:grid-cols-2 lg:grid-cols-3">
          <Card v-for="feature in features" :key="feature.title">
            <CardContent class="flex gap-4 p-5">
              <div
                class="bg-primary/10 text-primary flex h-10 w-10 shrink-0 items-center justify-center rounded-lg"
              >
                <component :is="feature.icon" class="h-5 w-5" />
              </div>
              <div>
                <p class="font-medium">{{ feature.title }}</p>
                <p class="text-muted-foreground mt-1 text-sm">{{ feature.description }}</p>
              </div>
            </CardContent>
          </Card>
        </div>
      </div>
    </section>

    <section class="bg-muted/50 border-t px-4 py-16">
      <div class="mx-auto max-w-xl text-center">
        <h2 class="text-2xl font-semibold tracking-tight">Ready to simplify your clinic?</h2>
        <p class="text-muted-foreground mt-2">
          Join clinics already using MedPractice. Set up in under 2 minutes.
        </p>
        <div class="mt-6 flex flex-wrap items-center justify-center gap-3">
          <Button size="lg" as-child>
            <NuxtLink to="/register">Register your clinic</NuxtLink>
          </Button>
          <Button size="lg" variant="outline" as-child>
            <a :href="mailtoUrl">
              <Mail class="mr-2 h-4 w-4" />
              Contact us
            </a>
          </Button>
        </div>
      </div>
    </section>

    <footer class="border-t px-4 py-6 text-center">
      <p class="text-muted-foreground text-sm">
        MedPractice &middot; Clinic management made simple
      </p>
    </footer>
  </div>
</template>

<script setup lang="ts">
import {
  CalendarCheck,
  ClipboardList,
  CreditCard,
  Mail,
  MessageCircle,
  Stethoscope,
  Users,
  Activity,
} from 'lucide-vue-next'

definePageMeta({ layout: 'auth' })

const { isAuthenticated } = useAuth()

watch(
  isAuthenticated,
  (authenticated) => {
    if (authenticated) {
      void navigateTo('/home', { replace: true })
    }
  },
  { immediate: true },
)

// TODO: Replace with real contact details before outreach
const whatsappUrl =
  'https://wa.me/919999999999?text=Hi%2C%20I%27d%20like%20a%20demo%20of%20MedPractice'
const mailtoUrl = 'mailto:hello@medpractice.in?subject=MedPractice%20Demo%20Request'

const features = [
  {
    icon: CalendarCheck,
    title: 'Smart Scheduling',
    description:
      'Book single or series appointments with therapist availability and overlap blocking.',
  },
  {
    icon: ClipboardList,
    title: 'Treatment Plans',
    description: 'Track sessions, progress, and notes per patient. Auto-complete plans when done.',
  },
  {
    icon: CreditCard,
    title: 'Billing & Payments',
    description:
      'Generate invoices from treatments, record payments, and track outstanding balances.',
  },
  {
    icon: Users,
    title: 'Patient Records',
    description:
      'Complete patient profiles with appointments, treatments, and billing in one place.',
  },
  {
    icon: Activity,
    title: 'Live Dashboard',
    description: "Today's appointments, pending invoices, and recent activity at a glance.",
  },
  {
    icon: MessageCircle,
    title: 'WhatsApp Reminders',
    description: 'Send appointment reminders to patients via WhatsApp with one tap.',
  },
]
</script>
