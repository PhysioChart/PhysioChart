<template>
  <Tabs
    :model-value="modelValue"
    @update:model-value="emit('update:modelValue', $event as BillingFilter)"
  >
    <PageTabsList>
      <TabsTrigger v-for="f in filters" :key="f" :value="f" class="capitalize">
        {{ f }}
      </TabsTrigger>
    </PageTabsList>
  </Tabs>
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
