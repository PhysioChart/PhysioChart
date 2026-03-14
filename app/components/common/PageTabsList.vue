<template>
  <TabsList :class="cn('w-full justify-start overflow-x-auto sm:w-fit', props.class)">
    <slot />
  </TabsList>
</template>

<script setup lang="ts">
import type { HTMLAttributes } from 'vue'
import { cn } from '~/lib/utils'

const props = defineProps<{
  class?: HTMLAttributes['class']
}>()
</script>
