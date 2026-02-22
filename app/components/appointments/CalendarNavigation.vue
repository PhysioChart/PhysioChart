<template>
  <div class="flex items-center gap-2">
    <Button variant="outline" size="sm" @click="emit('today')">Today</Button>
    <div class="flex items-center">
      <Button variant="ghost" size="icon" class="h-8 w-8" @click="emit('prev')">
        <ChevronLeft class="h-4 w-4" />
      </Button>
      <Button variant="ghost" size="icon" class="h-8 w-8" @click="emit('next')">
        <ChevronRight class="h-4 w-4" />
      </Button>
    </div>
    <h2 class="text-sm font-semibold">{{ label }}</h2>
  </div>
</template>

<script setup lang="ts">
import { ChevronLeft, ChevronRight } from 'lucide-vue-next'

defineProps<{
  label: string
}>()

const emit = defineEmits<{
  prev: []
  next: []
  today: []
}>()
</script>
