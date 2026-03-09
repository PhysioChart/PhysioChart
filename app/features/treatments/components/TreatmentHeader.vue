<template>
  <div class="flex items-center justify-between">
    <div>
      <h1 class="text-2xl font-bold tracking-tight">Treatment Plans</h1>
      <p class="text-muted-foreground text-sm">Track treatment progress for your patients</p>
    </div>
    <Button size="lg" @click="emit('newPlan')">
      <Plus class="mr-2 h-4 w-4" />
      New Plan
    </Button>
  </div>
</template>

<script setup lang="ts">
import { Plus } from 'lucide-vue-next'

const emit = defineEmits<{
  newPlan: []
}>()
</script>
