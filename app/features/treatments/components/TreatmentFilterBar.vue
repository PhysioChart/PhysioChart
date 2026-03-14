<template>
  <Tabs
    :model-value="modelValue"
    @update:model-value="emit('update:modelValue', $event as FilterValue)"
  >
    <PageTabsList>
      <TabsTrigger v-for="f in filters" :key="f.value" :value="f.value">
        {{ f.label }}
      </TabsTrigger>
    </PageTabsList>
  </Tabs>
</template>

<script setup lang="ts">
import { TreatmentStatus, TREATMENT_STATUS_LABELS } from '~/enums/treatment.enum'

type FilterValue = TreatmentStatus | 'all'

const filters: Array<{ value: FilterValue; label: string }> = [
  { value: TreatmentStatus.ACTIVE, label: TREATMENT_STATUS_LABELS[TreatmentStatus.ACTIVE] },
  { value: TreatmentStatus.COMPLETED, label: TREATMENT_STATUS_LABELS[TreatmentStatus.COMPLETED] },
  { value: 'all', label: 'All' },
]

defineProps<{
  modelValue: FilterValue
}>()

const emit = defineEmits<{
  'update:modelValue': [value: FilterValue]
}>()
</script>
