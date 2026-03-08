<template>
  <div
    :class="
      cn(
        'border-input dark:bg-input/30 focus-within:border-ring focus-within:ring-ring/50 flex h-9 w-full overflow-hidden rounded-md border bg-transparent shadow-xs transition-[color,box-shadow] focus-within:ring-[3px]',
        disabled ? 'pointer-events-none opacity-50' : '',
        props.class,
      )
    "
  >
    <span
      class="bg-muted text-muted-foreground flex items-center border-r px-3 text-sm font-medium"
      aria-hidden="true"
    >
      {{ INDIA_PHONE_PREFIX }}
    </span>
    <input
      :id="id"
      :name="name"
      :disabled="disabled"
      :placeholder="placeholder"
      :value="digitsValue"
      type="tel"
      inputmode="numeric"
      autocomplete="tel-national"
      maxlength="10"
      class="placeholder:text-muted-foreground flex-1 bg-transparent px-3 py-1 text-base outline-none md:text-sm"
      @input="handleInput"
    />
  </div>
</template>

<script setup lang="ts">
import type { HTMLAttributes } from 'vue'
import { cn } from '~/lib/utils'
import { INDIA_PHONE_PREFIX, extractIndianPhoneDigits } from '~/lib/phone'

const props = withDefaults(
  defineProps<{
    modelValue?: string
    id?: string
    name?: string
    placeholder?: string
    disabled?: boolean
    class?: HTMLAttributes['class']
  }>(),
  {
    modelValue: '',
    id: undefined,
    name: undefined,
    placeholder: '9876543210',
    disabled: false,
    class: undefined,
  },
)

const emit = defineEmits<{
  (e: 'update:modelValue', value: string): void
}>()

const digitsValue = computed(() => extractIndianPhoneDigits(props.modelValue))

function handleInput(event: Event) {
  const target = event.target as HTMLInputElement
  const digits = extractIndianPhoneDigits(target.value)
  target.value = digits
  emit('update:modelValue', digits)
}
</script>
