<template>
  <div class="flex flex-wrap items-center gap-2">
    <Button size="default" @click="navigateTo('/patients?action=new')">
      <UserPlus class="mr-1.5 h-4 w-4" />New Patient
    </Button>
    <Button size="default" @click="navigateTo('/appointments?action=new')">
      <CalendarPlus class="mr-1.5 h-4 w-4" />Book Appointment
    </Button>
    <Button variant="outline" size="default" :disabled="isRefreshing" @click="emit('refresh')">
      <RefreshCw class="mr-1.5 h-4 w-4" />Refresh
    </Button>
  </div>
</template>

<script setup lang="ts">
import { UserPlus, CalendarPlus, RefreshCw } from 'lucide-vue-next'

defineProps<{
  isRefreshing: boolean
}>()

const emit = defineEmits<{
  (e: 'refresh'): void
}>()
</script>
