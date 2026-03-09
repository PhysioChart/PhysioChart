<script setup lang="ts">
import type { HTMLAttributes } from "vue"
import { useVModel } from "@vueuse/core"
import { cn } from "@/lib/utils"

const props = defineProps<{
  defaultValue?: string | number
  modelValue?: string | number
  class?: HTMLAttributes["class"]
  disabled?: boolean
  id?: string
  placeholder?: string
}>()

const emits = defineEmits<{
  (e: "update:modelValue", payload: string | number): void
}>()

const modelValue = useVModel(props, "modelValue", emits, {
  passive: true,
  defaultValue: props.defaultValue,
})

function onKeypress(e: KeyboardEvent) {
  if (!/[0-9]/.test(e.key)) {
    e.preventDefault()
  }
}
</script>

<template>
  <div class="flex rounded-md shadow-xs">
    <span
      class="border-input bg-background text-muted-foreground inline-flex items-center rounded-l-md border px-3 text-sm"
    >
      +91
    </span>
    <input
      :id="id"
      v-model="modelValue"
      type="tel"
      maxlength="10"
      inputmode="numeric"
      pattern="[0-9]*"
      :placeholder="placeholder"
      :disabled="disabled"
      @keypress="onKeypress"
      data-slot="input"
      :class="cn(
        'placeholder:text-muted-foreground selection:bg-primary selection:text-primary-foreground dark:bg-input/30 border-input h-9 w-full min-w-0 rounded-md rounded-l-none border -ms-px bg-transparent px-3 py-1 text-base shadow-none transition-[color,box-shadow] outline-none disabled:pointer-events-none disabled:cursor-not-allowed disabled:opacity-50 md:text-sm',
        'focus-visible:border-ring focus-visible:ring-ring/50 focus-visible:ring-[3px]',
        'aria-invalid:ring-destructive/20 dark:aria-invalid:ring-destructive/40 aria-invalid:border-destructive',
        props.class,
      )"
    >
  </div>
</template>
