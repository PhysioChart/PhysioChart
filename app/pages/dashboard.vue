<template>
  <div class="space-y-6">
    <!-- Header -->
    <div class="flex flex-col gap-4 md:flex-row md:items-start md:justify-between">
      <div>
        <h1 class="text-2xl font-bold tracking-tight">
          Good
          {{
            new Date().getHours() < 12
              ? 'morning'
              : new Date().getHours() < 17
                ? 'afternoon'
                : 'evening'
          }},
          {{ profile?.full_name?.split(' ')[0] ?? 'Doctor' }}
        </h1>
        <p class="text-muted-foreground">
          Here's what's happening at {{ clinic?.name ?? 'your clinic' }} today.
        </p>
      </div>
      <div class="flex flex-wrap items-center gap-2">
        <Button size="lg" @click="navigateTo('/patients?action=new')">
          <UserPlus class="mr-2 h-4 w-4" />
          New Patient
        </Button>
        <Button size="lg" @click="navigateTo('/appointments?action=new')">
          <CalendarPlus class="mr-2 h-4 w-4" />
          Book Appointment
        </Button>
      </div>
    </div>

    <!-- Stats -->
    <div class="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
      <Card v-for="stat in stats" :key="stat.title">
        <CardHeader class="flex flex-row items-center justify-between space-y-0 pb-2">
          <CardTitle class="text-sm font-medium">{{ stat.title }}</CardTitle>
          <component :is="stat.icon" class="text-muted-foreground h-4 w-4" />
        </CardHeader>
        <CardContent>
          <div class="text-2xl font-bold">{{ stat.value }}</div>
          <p class="text-muted-foreground text-xs">{{ stat.description }}</p>
        </CardContent>
      </Card>
    </div>

    <!-- Recent Activity Placeholder -->
    <Card>
      <CardHeader>
        <CardTitle class="flex items-center gap-2">
          <Clock class="h-5 w-5" />
          Today's Agenda
        </CardTitle>
        <CardDescription>Your upcoming appointments for today</CardDescription>
      </CardHeader>
      <CardContent>
        <div class="flex flex-col items-center justify-center py-8 text-center">
          <CalendarDays class="text-muted-foreground/50 mb-3 h-10 w-10" />
          <p class="text-muted-foreground text-sm">No appointments scheduled for today</p>
          <Button variant="outline" class="mt-3" @click="navigateTo('/appointments?action=new')">
            Book an appointment
          </Button>
        </div>
      </CardContent>
    </Card>
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
} from 'lucide-vue-next'

const { clinic, profile } = useAuth()

// Placeholder stats — will be replaced with real data
const stats = ref([
  {
    title: "Today's Appointments",
    value: '—',
    icon: CalendarDays,
    description: 'No appointments yet',
  },
  { title: 'Total Patients', value: '—', icon: Users, description: 'Register your first patient' },
  {
    title: 'Active Treatments',
    value: '—',
    icon: ClipboardList,
    description: 'No active treatments',
  },
  {
    title: 'Revenue (This Month)',
    value: '—',
    icon: IndianRupee,
    description: 'No revenue recorded',
  },
])

const supabase = useSupabase()

onMounted(async () => {
  if (!profile.value) return
  const clinicId = profile.value.clinic_id

  const [patientsRes, appointmentsRes, treatmentsRes] = await Promise.all([
    supabase
      .from('patients')
      .select('id', { count: 'exact', head: true })
      .eq('clinic_id', clinicId),
    supabase
      .from('appointments')
      .select('id', { count: 'exact', head: true })
      .eq('clinic_id', clinicId)
      .gte('start_time', new Date().toISOString().split('T')[0])
      .lt('start_time', new Date(Date.now() + 86400000).toISOString().split('T')[0]),
    supabase
      .from('treatment_plans')
      .select('id', { count: 'exact', head: true })
      .eq('clinic_id', clinicId)
      .eq('status', 'active'),
  ])

  if (stats.value[0]) {
    stats.value[0].value = String(appointmentsRes.count ?? 0)
    stats.value[0].description = 'appointments scheduled today'
  }
  if (stats.value[1]) {
    stats.value[1].value = String(patientsRes.count ?? 0)
    stats.value[1].description = 'total registered patients'
  }
  if (stats.value[2]) {
    stats.value[2].value = String(treatmentsRes.count ?? 0)
    stats.value[2].description = 'active treatment plans'
  }
})
</script>
