<template>
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
        v-else-if="appointments.length === 0"
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
          v-for="appt in appointments"
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
</template>

<script setup lang="ts">
import { CalendarDays, CalendarPlus } from 'lucide-vue-next'
import type { UpcomingAppointmentSummary } from '~/services/dashboard.service'
import { formatDateTime, getStatusColor } from '~/lib/formatters'

defineProps<{
  appointments: UpcomingAppointmentSummary[]
  isLoading: boolean
}>()
</script>
