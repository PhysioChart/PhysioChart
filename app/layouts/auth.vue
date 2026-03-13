<template>
  <div class="bg-muted/40 min-h-dvh">
    <header v-if="!hideAuthHeader" class="flex h-14 items-center justify-end px-4">
      <ThemeToggle />
    </header>
    <main :class="contentClass">
      <slot />
    </main>
  </div>
</template>

<script setup lang="ts">
import ThemeToggle from '~/components/layout/ThemeToggle.vue'

const route = useRoute()

const hideAuthHeader = computed(() => Boolean(route.meta.hideAuthHeader))
const authCentered = computed(() => Boolean(route.meta.authCentered))

const contentClass = computed(() => {
  if (!authCentered.value) return undefined

  const minHeightClass = hideAuthHeader.value ? 'min-h-dvh' : 'min-h-[calc(100dvh-3.5rem)]'

  return ['flex items-center justify-center px-4 py-4 sm:px-6', minHeightClass]
})
</script>
