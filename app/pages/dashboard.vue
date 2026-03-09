<template>
  <div class="space-y-6">
    <div class="flex flex-col gap-4 md:flex-row md:items-start md:justify-between">
      <div>
        <h1 class="text-2xl font-bold tracking-tight">
          Good {{ greeting }}, {{ profile?.full_name?.split(' ')[0] ?? 'Doctor' }}
        </h1>
        <p class="text-muted-foreground">Clinic snapshot for the next 7 days.</p>
      </div>
      <DashboardQuickActions :is-refreshing="isLoading" @refresh="load(true)" />
    </div>

    <div
      v-if="errorMessage"
      class="border-destructive/50 bg-destructive/10 text-destructive rounded-md border p-3 text-sm"
    >
      {{ errorMessage }}
      <Button size="sm" variant="secondary" class="ml-2" :disabled="isLoading" @click="load(true)">
        Retry
      </Button>
    </div>

    <DashboardStatCards :stats="statCards" :is-loading="isLoading" />

    <div class="grid gap-4 lg:grid-cols-3">
      <DashboardUpcomingList :appointments="upcoming" :is-loading="isLoading" />
      <DashboardRecentActivity :activities="recent" :is-loading="isLoading" />
    </div>
  </div>
</template>

<script setup lang="ts">
import { Users, CalendarDays, ClipboardList, Clock, IndianRupee, Receipt } from 'lucide-vue-next'
import { toast } from 'vue-sonner'
import { dashboardService, type DashboardOverview } from '~/services/dashboard.service'
import { formatAppDate, toLocalDateKey } from '~/lib/date'
import { formatCurrency } from '~/lib/formatters'
import type { StatCard } from '~/features/dashboard/components/DashboardStatCards.vue'
import DashboardStatCards from '~/features/dashboard/components/DashboardStatCards.vue'
import DashboardUpcomingList from '~/features/dashboard/components/DashboardUpcomingList.vue'
import DashboardRecentActivity from '~/features/dashboard/components/DashboardRecentActivity.vue'
import DashboardQuickActions from '~/features/dashboard/components/DashboardQuickActions.vue'

definePageMeta({ layout: 'protected' })

const { profile, activeClinic } = useAuth()
const supabase = useSupabaseClient()

const isLoading = ref(true)
const errorMessage = ref<string | null>(null)
const overview = ref<DashboardOverview | null>(null)
const lastLoadedAt = ref<number | null>(null)

const greeting = computed(() => {
  const hour = Number.parseInt(formatAppDate(new Date(), { hour: 'numeric', hourCycle: 'h23' }), 10)
  if (Number.isNaN(hour)) return 'morning'
  if (hour < 12) return 'morning'
  if (hour < 17) return 'afternoon'
  return 'evening'
})

const statCards = computed<StatCard[]>(() => {
  const counts = overview.value?.counts
  return [
    {
      title: 'Upcoming (7d)',
      value: counts ? counts.upcomingAppointments7d : '\u2014',
      icon: CalendarDays,
      description: 'Scheduled & checked-in',
    },
    {
      title: "Today's Appointments",
      value: counts ? counts.todayAppointments : '\u2014',
      icon: Clock,
      description: 'Local day',
    },
    {
      title: 'Pending Invoices',
      value: counts ? counts.pendingInvoices : '\u2014',
      icon: Receipt,
      description: 'Includes sent/partial/overdue',
      overdueBadge:
        counts && counts.overdueInvoices > 0 ? `${counts.overdueInvoices} overdue` : null,
    },
    {
      title: 'Outstanding Amount',
      value: counts ? formatCurrency(counts.outstandingAmount) : '\u2014',
      icon: IndianRupee,
      description: 'Pending invoices sum',
    },
    {
      title: 'Total Patients',
      value: counts ? counts.totalPatients : '\u2014',
      icon: Users,
      description: 'All patients',
    },
    {
      title: 'Active Treatments',
      value: counts ? counts.activeTreatments : '\u2014',
      icon: ClipboardList,
      description: 'Plans in progress',
    },
  ]
})

const upcoming = computed(() => overview.value?.upcomingAppointments ?? [])
const recent = computed(() => overview.value?.recentActivity ?? [])

async function load(force = false) {
  if (!activeClinic.value?.id) {
    errorMessage.value = 'Clinic not found for your profile.'
    isLoading.value = false
    return
  }
  const nowTs = Date.now()
  if (!force && lastLoadedAt.value && nowTs - lastLoadedAt.value < 30_000) return

  isLoading.value = true
  errorMessage.value = null
  try {
    const now = new Date()
    const rangeEnd = new Date(now)
    rangeEnd.setDate(rangeEnd.getDate() + 7)

    overview.value = await dashboardService(supabase).getOverview({
      clinicId: activeClinic.value.id,
      nowIso: now.toISOString(),
      rangeEndIso: rangeEnd.toISOString(),
      todayLocal: toLocalDateKey(now),
      tzOffsetMinutes: now.getTimezoneOffset(),
    })
    lastLoadedAt.value = Date.now()
  } catch (err) {
    lastLoadedAt.value = null
    const code = err instanceof Error ? err.message : 'DASHBOARD_LOAD_FAILED'
    const friendly =
      code === 'DASHBOARD_FORBIDDEN'
        ? "You don't have access to this clinic dashboard."
        : code === 'DASHBOARD_INVALID_CLINIC'
          ? 'Clinic not found.'
          : code === 'DASHBOARD_INVALID_RANGE'
            ? 'Invalid date range requested.'
            : 'Failed to load dashboard.'
    errorMessage.value = friendly
    toast.error(friendly)
  } finally {
    isLoading.value = false
  }
}

onMounted(() => load())

watch(activeClinic, () => {
  void load(true)
})
</script>
