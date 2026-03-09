<template>
  <div class="flex items-center justify-between">
    <div>
      <h1 class="text-2xl font-bold tracking-tight">Appointments</h1>
      <p class="text-muted-foreground text-sm">Manage your clinic's schedule</p>
    </div>
    <Button size="lg" @click="emit('open-booking')">
      <CalendarPlus class="mr-2 h-4 w-4" />
      Book Appointment
    </Button>
  </div>
</template>

<script setup lang="ts">
import { CalendarPlus } from 'lucide-vue-next'

const emit = defineEmits<{
  (e: 'open-booking'): void
}>()
</script>
