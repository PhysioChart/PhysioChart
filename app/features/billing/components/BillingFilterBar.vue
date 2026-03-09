<template>
  <div class="flex flex-wrap gap-2">
    <Button
      v-for="f in filters"
      :key="f"
      :variant="modelValue === f ? 'default' : 'outline'"
      size="sm"
      class="capitalize"
      @click="emit('update:modelValue', f)"
    >
      {{ f }}
    </Button>
  </div>
</template>

<script setup lang="ts">
type BillingFilter = 'all' | 'pending' | 'paid' | 'overdue'

const filters: BillingFilter[] = ['all', 'pending', 'paid', 'overdue']

defineProps<{
  modelValue: BillingFilter
}>()

const emit = defineEmits<{
  'update:modelValue': [value: BillingFilter]
}>()
</script>
