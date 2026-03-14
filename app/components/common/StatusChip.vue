<template>
  <Badge variant="secondary" :class="cn(statusClasses, props.class)">
    <slot>{{ displayLabel }}</slot>
  </Badge>
</template>

<script setup lang="ts">
import type { HTMLAttributes } from 'vue'
import { cn } from '~/lib/utils'
import { getStatusClasses, getStatusLabel } from '~/enums/status-variant.enum'

const props = defineProps<{
  status: string
  label?: string
  class?: HTMLAttributes['class']
}>()

const statusClasses = computed(() => getStatusClasses(props.status))
const displayLabel = computed(() => props.label ?? getStatusLabel(props.status))
</script>
