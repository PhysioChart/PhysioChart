<template>
  <div class="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
    <Tabs v-model="viewMode" class="w-auto">
      <TabsList>
        <TabsTrigger value="list">List</TabsTrigger>
        <TabsTrigger value="day">Day</TabsTrigger>
        <TabsTrigger value="week" class="hidden md:inline-flex">Week</TabsTrigger>
      </TabsList>
    </Tabs>

    <div v-if="viewMode === 'list'" class="flex gap-2">
      <Button
        :variant="listFilter === 'today' ? 'default' : 'outline'"
        size="sm"
        @click="listFilter = 'today'"
      >
        Today
      </Button>
      <Button
        :variant="listFilter === 'all' ? 'default' : 'outline'"
        size="sm"
        @click="listFilter = 'all'"
      >
        All
      </Button>
    </div>

    <CalendarNavigation
      v-if="viewMode === 'day'"
      :label="dayViewLabel"
      @prev="emit('prev-day')"
      @next="emit('next-day')"
      @today="emit('today')"
    />
    <CalendarNavigation
      v-if="viewMode === 'week'"
      :label="weekViewLabel"
      @prev="emit('prev-week')"
      @next="emit('next-week')"
      @today="emit('today')"
    />
  </div>
</template>

<script setup lang="ts">
import type { AppointmentsListFilter, AppointmentsViewMode } from '~/features/appointments/types'

defineProps<{
  dayViewLabel: string
  weekViewLabel: string
}>()

const viewMode = defineModel<AppointmentsViewMode>('viewMode', { required: true })
const listFilter = defineModel<AppointmentsListFilter>('listFilter', { required: true })

const emit = defineEmits<{
  (e: 'today' | 'prev-day' | 'next-day' | 'prev-week' | 'next-week'): void
}>()
</script>
