<script setup lang="ts">
import type { HTMLAttributes } from 'vue'
import { Minus, Plus } from 'lucide-vue-next'
import { cn } from '@/lib/utils'

const props = withDefaults(
  defineProps<{
    min?: number
    max?: number
    step?: number
    class?: HTMLAttributes['class']
  }>(),
  {
    min: 0,
    max: Infinity,
    step: 1,
  },
)

const modelValue = defineModel<number>({ default: 0 })

function decrement() {
  const next = modelValue.value - props.step
  if (next >= props.min) modelValue.value = next
}

function increment() {
  const next = modelValue.value + props.step
  if (next <= props.max) modelValue.value = next
}

function onInput(event: Event) {
  const raw = (event.target as HTMLInputElement).value
  const parsed = Number.parseInt(raw, 10)
  if (Number.isFinite(parsed)) {
    modelValue.value = Math.min(Math.max(parsed, props.min), props.max)
  }
}
</script>

<template>
  <div
    :class="cn(
      'border-input dark:bg-input/30 inline-flex h-9 w-full min-w-0 items-center overflow-hidden rounded-md border bg-transparent text-sm shadow-xs',
      'focus-within:border-ring focus-within:ring-ring/50 focus-within:ring-[3px]',
      props.class,
    )"
  >
    <input
      type="text"
      inputmode="numeric"
      :value="modelValue"
      class="selection:bg-primary selection:text-primary-foreground w-full grow px-3 py-2 text-center tabular-nums outline-none"
      @input="onInput"
    />
    <button
      type="button"
      class="border-input bg-background text-muted-foreground hover:bg-accent hover:text-foreground -me-px flex aspect-square h-[inherit] cursor-pointer items-center justify-center border text-sm transition-[color,box-shadow] disabled:pointer-events-none disabled:cursor-not-allowed disabled:opacity-50"
      :disabled="modelValue <= min"
      @click="decrement"
    >
      <Minus class="size-4" />
    </button>
    <button
      type="button"
      class="border-input bg-background text-muted-foreground hover:bg-accent hover:text-foreground -me-px flex aspect-square h-[inherit] cursor-pointer items-center justify-center rounded-r-md border text-sm transition-[color,box-shadow] disabled:pointer-events-none disabled:cursor-not-allowed disabled:opacity-50"
      :disabled="modelValue >= max"
      @click="increment"
    >
      <Plus class="size-4" />
    </button>
  </div>
</template>
