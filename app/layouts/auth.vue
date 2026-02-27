<template>
  <div v-if="!isAuthenticated" class="bg-muted/40 min-h-screen">
    <header class="flex h-14 items-center justify-end px-4">
      <ThemeToggle />
    </header>
    <slot />
  </div>
  <div v-else class="bg-background text-foreground flex min-h-screen items-center justify-center">
    <div class="border-primary h-8 w-8 animate-spin rounded-full border-4 border-t-transparent" />
  </div>
</template>

<script setup lang="ts">
const { isAuthenticated } = useAuth()

watch(
  isAuthenticated,
  async () => {
    if (isAuthenticated.value) {
      await navigateTo('/home', { replace: true })
    }
  },
  { immediate: true },
)
</script>
