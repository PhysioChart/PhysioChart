<template>
  <div class="grid gap-4 sm:grid-cols-2 md:grid-cols-3">
    <Card v-for="stat in stats" :key="stat.title">
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
</template>

<script setup lang="ts">
import type { Component } from 'vue'

export interface StatCard {
  title: string
  value: string | number
  icon: Component
  description: string
  overdueBadge?: string | null
}

defineProps<{
  stats: StatCard[]
  isLoading: boolean
}>()
</script>
