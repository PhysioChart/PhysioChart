<template>
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
      <div v-else-if="activities.length === 0" class="text-muted-foreground text-sm">
        Nothing new yet. Booking and billing updates will appear here.
      </div>
      <ul v-else class="space-y-3">
        <li
          v-for="item in activities"
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
            <StatusChip :status="item.status" class="mb-1" />
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
</template>

<script setup lang="ts">
import { Clock, IndianRupee, CalendarDays } from 'lucide-vue-next'
import type { DashboardActivityItem } from '~/services/dashboard.service'
import { formatDateTime, formatCurrency, formatRelativeTime } from '~/lib/formatters'

defineProps<{
  activities: DashboardActivityItem[]
  isLoading: boolean
}>()
</script>
