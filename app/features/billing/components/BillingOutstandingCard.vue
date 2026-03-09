<template>
  <Card v-if="totalOutstanding > 0" class="border-amber-200 bg-amber-50/50">
    <CardContent class="flex items-center gap-3 p-4">
      <AlertCircle class="h-5 w-5 text-amber-600" />
      <div>
        <p class="text-sm font-medium text-amber-900">Outstanding Payments</p>
        <p class="text-2xl font-bold text-amber-900">
          {{ formatCurrency(totalOutstanding) }}
        </p>
      </div>
    </CardContent>
  </Card>
</template>

<script setup lang="ts">
import { AlertCircle } from 'lucide-vue-next'
import { formatCurrency } from '~/lib/formatters'

defineProps<{
  totalOutstanding: number
}>()
</script>
