<template>
  <div class="dark">
    <div class="bg-background text-foreground min-h-screen">
      <!-- Navbar -->
      <nav
        class="border-border/50 bg-background/80 fixed top-0 right-0 left-0 z-50 border-b backdrop-blur-lg"
      >
        <div class="mx-auto flex h-16 max-w-5xl items-center justify-between px-6">
          <span class="text-foreground text-lg font-bold tracking-tight">PhysioChart</span>
          <a
            :href="whatsappUrl"
            target="_blank"
            rel="noopener noreferrer"
            class="hidden md:inline-flex"
          >
            <Button size="sm">
              <MessageCircle class="mr-2 h-4 w-4" />
              Book a Demo
            </Button>
          </a>
        </div>
      </nav>

      <!-- Hero -->
      <section class="flex flex-col items-center px-6 pt-32 pb-16 text-center sm:pt-40 sm:pb-20">
        <div
          class="border-primary/20 bg-primary/10 text-primary mb-6 inline-flex items-center gap-2 rounded-full border px-4 py-1.5 text-sm font-medium"
        >
          Built for Indian Physiotherapy Clinics
        </div>

        <h1
          class="mx-auto max-w-3xl text-3xl leading-tight font-bold tracking-tight sm:text-4xl lg:text-5xl"
        >
          Your physiotherapy clinic, finally organized
        </h1>

        <p class="text-muted-foreground mx-auto mt-5 max-w-xl text-lg">
          Appointments, treatments, billing — everything your clinic needs in one beautiful app.
          Replace paper registers and Excel forever.
        </p>

        <div class="mt-8 flex flex-wrap items-center justify-center gap-3">
          <a :href="whatsappUrl" target="_blank" rel="noopener noreferrer">
            <Button size="lg">
              <MessageCircle class="mr-2 h-4 w-4" />
              Book a Free Demo
            </Button>
          </a>
        </div>

        <p class="text-muted-foreground mt-4 text-sm">
          15-minute walkthrough &middot; No commitment &middot; Free forever during beta
        </p>
      </section>

      <!-- Dashboard Screenshot Placeholder -->
      <section class="px-6 pb-20">
        <div
          class="border-border/50 bg-card/50 mx-auto flex h-64 max-w-4xl items-center justify-center rounded-xl border-2 border-dashed shadow-[0_0_80px_-20px_hsl(142.1_62%_37.5%/0.2)] sm:h-80 lg:h-96"
        >
          <div class="text-muted-foreground flex flex-col items-center gap-3">
            <LayoutDashboard class="text-primary/50 h-10 w-10" />
            <span class="text-sm font-medium">[Screenshot: Dashboard]</span>
          </div>
        </div>
      </section>

      <!-- Pain Point -->
      <section data-reveal class="reveal-element px-6 py-16 text-center">
        <p class="text-muted-foreground mx-auto max-w-2xl text-xl font-medium sm:text-2xl">
          Still running your clinic on paper registers and WhatsApp forwards?
        </p>
      </section>

      <!-- Feature: Patients -->
      <section data-reveal class="reveal-element px-6 py-16">
        <div class="mx-auto grid max-w-5xl items-center gap-10 md:grid-cols-2">
          <div>
            <span class="text-primary text-xs font-semibold tracking-widest uppercase"
              >Patients</span
            >
            <h2 class="mt-3 text-2xl font-bold tracking-tight sm:text-3xl">
              Every patient, one tap away
            </h2>
            <p class="text-muted-foreground mt-4 leading-relaxed">
              Complete profiles with contact details, medical history, appointment timeline, and
              billing — all in one place. No more flipping through registers to find a patient's
              last visit.
            </p>
          </div>
          <div
            class="border-border/50 bg-card/50 flex h-56 items-center justify-center rounded-xl border-2 border-dashed sm:h-64"
          >
            <div class="text-muted-foreground flex flex-col items-center gap-3">
              <Users class="text-primary/50 h-10 w-10" />
              <span class="text-sm font-medium">[Screenshot: Patient Profile]</span>
            </div>
          </div>
        </div>
      </section>

      <!-- Feature: Appointments -->
      <section data-reveal class="reveal-element px-6 py-16">
        <div class="mx-auto grid max-w-5xl items-center gap-10 md:grid-cols-2">
          <div class="order-2 md:order-1">
            <div
              class="border-border/50 bg-card/50 flex h-56 items-center justify-center rounded-xl border-2 border-dashed sm:h-64"
            >
              <div class="text-muted-foreground flex flex-col items-center gap-3">
                <CalendarCheck class="text-primary/50 h-10 w-10" />
                <span class="text-sm font-medium">[Screenshot: Appointments]</span>
              </div>
            </div>
          </div>
          <div class="order-1 md:order-2">
            <span class="text-primary text-xs font-semibold tracking-widest uppercase"
              >Appointments</span
            >
            <h2 class="mt-3 text-2xl font-bold tracking-tight sm:text-3xl">
              Book, reschedule, track — without the chaos
            </h2>
            <p class="text-muted-foreground mt-4 leading-relaxed">
              See today's schedule at a glance. Book single or series appointments, send WhatsApp
              reminders with one tap, and never double-book a slot again.
            </p>
          </div>
        </div>
      </section>

      <!-- Feature: Treatments -->
      <section data-reveal class="reveal-element px-6 py-16">
        <div class="mx-auto grid max-w-5xl items-center gap-10 md:grid-cols-2">
          <div>
            <span class="text-primary text-xs font-semibold tracking-widest uppercase"
              >Treatments</span
            >
            <h2 class="mt-3 text-2xl font-bold tracking-tight sm:text-3xl">
              Treatment plans that actually get followed
            </h2>
            <p class="text-muted-foreground mt-4 leading-relaxed">
              Create structured treatment plans with session counts, track progress with visual
              indicators, and record notes per session. Know exactly where every patient stands in
              their recovery.
            </p>
          </div>
          <div class="flex flex-col gap-4">
            <div
              class="border-border/50 bg-card/50 flex h-40 items-center justify-center rounded-xl border-2 border-dashed sm:h-48"
            >
              <div class="text-muted-foreground flex flex-col items-center gap-3">
                <ClipboardList class="text-primary/50 h-10 w-10" />
                <span class="text-sm font-medium">[Screenshot: Treatment Plans]</span>
              </div>
            </div>
            <div
              class="border-border/50 bg-card/50 flex h-40 items-center justify-center rounded-xl border-2 border-dashed sm:h-48"
            >
              <div class="text-muted-foreground flex flex-col items-center gap-3">
                <Activity class="text-primary/50 h-10 w-10" />
                <span class="text-sm font-medium">[Screenshot: Session Progress]</span>
              </div>
            </div>
          </div>
        </div>
      </section>

      <!-- Feature: Billing -->
      <section data-reveal class="reveal-element px-6 py-16">
        <div class="mx-auto grid max-w-5xl items-center gap-10 md:grid-cols-2">
          <div class="order-2 md:order-1">
            <div
              class="border-border/50 bg-card/50 flex h-56 items-center justify-center rounded-xl border-2 border-dashed sm:h-64"
            >
              <div class="text-muted-foreground flex flex-col items-center gap-3">
                <CreditCard class="text-primary/50 h-10 w-10" />
                <span class="text-sm font-medium">[Screenshot: Billing]</span>
              </div>
            </div>
          </div>
          <div class="order-1 md:order-2">
            <span class="text-primary text-xs font-semibold tracking-widest uppercase"
              >Billing</span
            >
            <h2 class="mt-3 text-2xl font-bold tracking-tight sm:text-3xl">
              Get paid without the paperwork
            </h2>
            <p class="text-muted-foreground mt-4 leading-relaxed">
              Generate invoices from treatments, record partial or full payments, and see
              outstanding balances at a glance. No more chasing patients for dues you forgot to
              track.
            </p>
          </div>
        </div>
      </section>

      <!-- Founder Note -->
      <section data-reveal class="reveal-element px-6 py-20">
        <div
          class="border-border/50 bg-card/50 mx-auto max-w-2xl rounded-xl border p-8 text-center sm:p-12"
        >
          <p class="text-muted-foreground text-lg leading-relaxed italic">
            "I built PhysioChart because I saw physiotherapists — brilliant at their craft —
            drowning in admin work. Paper registers, Excel sheets, WhatsApp groups for appointment
            reminders. Your patients deserve your full attention, not half of it lost to paperwork.
            This app is my attempt to give you that time back."
          </p>
        </div>
      </section>

      <!-- Final CTA -->
      <section data-reveal class="reveal-element px-6 py-20 text-center">
        <h2 class="text-2xl font-bold tracking-tight sm:text-3xl">
          Ready to run your clinic the modern way?
        </h2>
        <div class="mt-8">
          <a :href="whatsappUrl" target="_blank" rel="noopener noreferrer">
            <Button size="lg">
              <MessageCircle class="mr-2 h-4 w-4" />
              Book a Free Demo
            </Button>
          </a>
        </div>
        <a
          :href="whatsappUrl"
          target="_blank"
          rel="noopener noreferrer"
          class="text-muted-foreground hover:text-foreground mt-4 inline-block text-sm underline underline-offset-4"
        >
          Or message us on WhatsApp
        </a>
      </section>

      <!-- Footer -->
      <footer class="border-border/50 border-t px-6 py-8 text-center">
        <p class="text-muted-foreground text-sm">
          &copy; 2026 PhysioChart &middot; Built in Bangalore
        </p>
      </footer>

      <!-- Sticky WhatsApp Button (mobile only) -->
      <a
        :href="whatsappUrl"
        target="_blank"
        rel="noopener noreferrer"
        class="fixed right-4 bottom-4 z-50 flex h-14 w-14 items-center justify-center rounded-full bg-[#25D366] text-white shadow-lg md:hidden"
        aria-label="Chat on WhatsApp"
      >
        <MessageCircle class="h-6 w-6" />
      </a>
    </div>
  </div>
</template>

<script setup lang="ts">
import {
  Activity,
  CalendarCheck,
  ClipboardList,
  CreditCard,
  LayoutDashboard,
  MessageCircle,
  Users,
} from 'lucide-vue-next'

definePageMeta({ layout: false })

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

useScrollReveal()

const whatsappUrl =
  'https://wa.me/919999999999?text=Hi%2C%20I%27d%20like%20a%20demo%20of%20PhysioChart'
</script>

<style scoped>
.reveal-element {
  opacity: 0;
  transform: translateY(24px);
  transition:
    opacity 0.6s ease,
    transform 0.6s ease;
}

.reveal-element.revealed {
  opacity: 1;
  transform: translateY(0);
}
</style>
