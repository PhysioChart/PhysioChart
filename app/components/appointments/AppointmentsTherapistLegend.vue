<template>
  <div v-if="items.length > 0" class="flex flex-wrap gap-3">
    <div v-for="item in items" :key="item.id" class="flex items-center gap-1.5 text-xs">
      <span :class="[item.color.bg, item.color.border, 'h-3 w-3 rounded-sm border-l-2']" />
      <span class="text-muted-foreground">{{ item.name }}</span>
    </div>
  </div>
</template>

<script setup lang="ts">
import type { TherapistLegendItem } from '~/features/appointments/types'

defineProps<{
  items: TherapistLegendItem[]
}>()
</script>
