<template>
  <component :is="surfaceRoot" :open="open" @update:open="emit('update:open', $event)">
    <component :is="surfaceContent" v-bind="surfaceContentProps" :class="surfaceContentClass">
      <slot />
    </component>
  </component>
</template>

<script setup lang="ts">
import { useMediaQuery } from '@vueuse/core'
import { cn } from '~/lib/utils'
import { Dialog, DialogContent } from '~/components/ui/dialog'
import { Sheet, SheetContent } from '~/components/ui/sheet'

interface ResponsiveFormOverlayProps {
  open: boolean
  desktopWidth?: 'md' | 'lg'
}

const props = withDefaults(defineProps<ResponsiveFormOverlayProps>(), {
  desktopWidth: 'md',
})

const emit = defineEmits<{
  'update:open': [value: boolean]
}>()

const isHydrated = ref(false)
const isMobileViewport = useMediaQuery('(max-width: 639px)')

onMounted(() => {
  isHydrated.value = true
})

const useMobileSheet = computed(() => isHydrated.value && isMobileViewport.value)

const surfaceRoot = computed(() => (useMobileSheet.value ? Sheet : Dialog))
const surfaceContent = computed(() => (useMobileSheet.value ? SheetContent : DialogContent))

const surfaceContentProps = computed(() => {
  if (!useMobileSheet.value) return {}

  return {
    side: 'right' as const,
  }
})

const desktopWidthClass = computed(() =>
  props.desktopWidth === 'lg' ? 'sm:max-w-lg' : 'sm:max-w-md',
)

const surfaceContentClass = computed(() =>
  cn(
    'flex min-h-0 flex-col overflow-hidden border p-0 shadow-lg',
    useMobileSheet.value
      ? 'inset-y-0 right-0 h-dvh w-full max-w-none rounded-none border-0 data-[state=closed]:duration-300 data-[state=open]:duration-300'
      : ['max-h-[calc(100dvh-2rem)] gap-0', desktopWidthClass.value],
  ),
)
</script>
