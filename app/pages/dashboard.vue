<template>
  <div class="space-y-6">
    <div class="flex flex-col gap-4 md:flex-row md:items-start md:justify-between">
      <div>
        <h1 class="text-2xl font-bold tracking-tight">
          Good {{ greeting }}, {{ profile?.full_name?.split(' ')[0] ?? 'Doctor' }}
        </h1>
        <p class="text-muted-foreground">Clinic snapshot for the next 7 days.</p>
      </div>
      <div class="flex flex-wrap items-center gap-2">
        <Button size="lg" @click="navigateTo('/patients?action=new')">
          <UserPlus class="mr-2 h-4 w-4" />New Patient
        </Button>
        <Button size="lg" @click="navigateTo('/appointments?action=new')">
          <CalendarPlus class="mr-2 h-4 w-4" />Book Appointment
        </Button>
        <Button variant="outline" size="lg" :disabled="isLoading" @click="load(true)">
          <RefreshCw class="mr-2 h-4 w-4" />Refresh
        </Button>
      </div>
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

    <div class="grid gap-4 sm:grid-cols-2 md:grid-cols-3">
      <Card v-for="stat in statCards" :key="stat.title">
        <CardHeader class="flex flex-row items-center justify-between space-y-0 pb-2">
          <CardTitle class="text-sm font-medium">{{ stat.title }}</CardTitle>
          <component :is="stat.icon" class="text-muted-foreground h-4 w-4" />
        </CardHeader>
        <CardContent>
          <div class="text-2xl font-bold">
            <Skeleton v-if="isLoading" class="h-6 w-16" />
            <span v-else>{{ stat.value }}</span>
          </div>
          <p class="text-muted-foreground flex items-center gap-2 text-xs">
            <span>{{ stat.description }}</span>
            <Badge v-if="stat.overdueBadge" variant="destructive" size="sm">{{
              stat.overdueBadge
            }}</Badge>
          </p>
        </CardContent>
      </Card>
    </div>

    <div class="grid gap-4 lg:grid-cols-3">
      <Card class="lg:col-span-2">
        <CardHeader class="flex items-center justify-between">
          <div>
            <CardTitle class="flex items-center gap-2">
              <CalendarDays class="h-5 w-5" />Upcoming (7 days)
            </CardTitle>
            <CardDescription>Scheduled and checked-in, including ongoing visits.</CardDescription>
          </div>
          <Button variant="ghost" size="sm" @click="navigateTo('/appointments')">View all</Button>
        </CardHeader>
        <CardContent>
          <div v-if="isLoading" class="space-y-3">
            <Skeleton v-for="i in 4" :key="i" class="h-12 w-full" />
          </div>
          <div
            v-else-if="upcoming.length === 0"
            class="flex flex-col items-center justify-center py-8 text-center"
          >
            <CalendarPlus class="text-muted-foreground/60 mb-3 h-10 w-10" />
            <p class="text-muted-foreground text-sm">No upcoming appointments scheduled.</p>
            <Button variant="outline" class="mt-3" @click="navigateTo('/appointments?action=new')">
              Book an appointment
            </Button>
          </div>
          <ul v-else class="divide-border divide-y">
            <li
              v-for="appt in upcoming"
              :key="appt.id"
              class="hover:bg-muted/40 flex cursor-pointer items-center justify-between rounded-md px-2 py-3"
              @click="navigateTo({ path: '/appointments', query: { focus: appt.id } })"
            >
              <div>
                <p class="font-medium">{{ appt.patientName ?? 'Unknown patient' }}</p>
                <p class="text-muted-foreground text-sm">
                  {{ formatDateTime(appt.startTime) }} · {{ appt.therapistName ?? 'Unassigned' }}
                </p>
              </div>
              <Badge :class="getStatusColor(appt.status)" variant="outline" class="capitalize">
                {{ appt.status.replace('_', ' ') }}
              </Badge>
            </li>
          </ul>
        </CardContent>
      </Card>

      <Card>
        <CardHeader class="flex items-center justify-between">
          <div>
            <CardTitle class="flex items-center gap-2">
              <Clock class="h-5 w-5" />Recent Activity
            </CardTitle>
            <CardDescription>Latest appointments and invoices.</CardDescription>
          </div>
        </CardHeader>
        <CardContent>
          <div v-if="isLoading" class="space-y-3">
            <Skeleton v-for="i in 5" :key="i" class="h-10 w-full" />
          </div>
          <div v-else-if="recent.length === 0" class="text-muted-foreground text-sm">
            Nothing new yet. Booking and billing updates will appear here.
          </div>
          <ul v-else class="space-y-3">
            <li
              v-for="item in recent"
              :key="`${item.kind}-${item.id}`"
              class="hover:bg-muted/40 flex cursor-pointer items-center justify-between rounded-lg border p-3"
              @click="
                navigateTo(
                  item.kind === 'invoice'
                    ? { path: '/billing', query: { focus: item.id } }
                    : { path: '/appointments', query: { focus: item.id } },
                )
              "
            >
              <div class="flex items-center gap-3">
                <div class="bg-muted rounded-full p-2">
                  <component
                    :is="item.kind === 'invoice' ? IndianRupee : CalendarDays"
                    class="h-4 w-4"
                  />
                </div>
                <div>
                  <p class="font-medium">
                    {{
                      item.kind === 'invoice'
                        ? `Invoice ${item.invoiceNumber ?? ''}`.trim()
                        : 'Appointment'
                    }}
                  </p>
                  <p class="text-muted-foreground text-xs">
                    {{ item.patientName ?? 'Unknown patient' }} ·
                    {{ formatRelativeTime(item.occurredAt) }}
                  </p>
                </div>
              </div>
              <div class="text-right text-sm">
                <Badge
                  :class="getStatusColor(item.status)"
                  variant="outline"
                  class="mb-1 capitalize"
                >
                  {{ item.status.replace('_', ' ') }}
                </Badge>
                <p v-if="item.kind === 'invoice'">
                  {{ formatCurrency(item.total ?? 0) }}
                  <span
                    v-if="item.outstanding && item.outstanding > 0"
                    class="text-muted-foreground text-xs"
                  >
                    · Due {{ formatCurrency(item.outstanding) }}
                  </span>
                </p>
                <p v-else-if="item.startTime" class="text-muted-foreground text-xs">
                  Starts {{ formatDateTime(item.startTime) }}
                </p>
              </div>
            </li>
          </ul>
        </CardContent>
      </Card>
    </div>
  </div>
</template>

<script setup lang="ts">
import {
  Users,
  CalendarDays,
  ClipboardList,
  UserPlus,
  CalendarPlus,
  Clock,
  IndianRupee,
  RefreshCw,
  Receipt,
} from 'lucide-vue-next'
import { toast } from 'vue-sonner'
import { dashboardService, type DashboardOverview } from '~/services/dashboard.service'
import { toLocalDateKey } from '~/lib/date'
import {
  formatDateTime,
  formatCurrency,
  formatRelativeTime,
  getStatusColor,
} from '~/lib/formatters'

const { profile } = useAuth()
const supabase = useSupabase()

const isLoading = ref(true)
const errorMessage = ref<string | null>(null)
const overview = ref<DashboardOverview | null>(null)
const lastLoadedAt = ref<number | null>(null)

const greeting = computed(() => {
  const hour = new Date().getHours()
  if (hour < 12) return 'morning'
  if (hour < 17) return 'afternoon'
  return 'evening'
})

const statCards = computed(() => {
  const counts = overview.value?.counts
  return [
    {
      title: 'Upcoming (7d)',
      value: counts ? counts.upcomingAppointments7d : '—',
      icon: CalendarDays,
      description: 'Scheduled & checked-in',
    },
    {
      title: "Today's Appointments",
      value: counts ? counts.todayAppointments : '—',
      icon: Clock,
      description: 'Local day',
    },
    {
      title: 'Pending Invoices',
      value: counts ? counts.pendingInvoices : '—',
      icon: Receipt,
      description: 'Includes sent/partial/overdue',
      overdueBadge:
        counts && counts.overdueInvoices > 0 ? `${counts.overdueInvoices} overdue` : null,
    },
    {
      title: 'Outstanding Amount',
      value: counts ? formatCurrency(counts.outstandingAmount) : '—',
      icon: IndianRupee,
      description: 'Pending invoices sum',
    },
    {
      title: 'Total Patients',
      value: counts ? counts.totalPatients : '—',
      icon: Users,
      description: 'All patients',
    },
    {
      title: 'Active Treatments',
      value: counts ? counts.activeTreatments : '—',
      icon: ClipboardList,
      description: 'Plans in progress',
    },
  ]
})

const upcoming = computed(() => overview.value?.upcomingAppointments ?? [])
const recent = computed(() => overview.value?.recentActivity ?? [])

async function load(force = false) {
  if (!profile.value?.clinic_id) {
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
      clinicId: profile.value.clinic_id,
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
</script>
