<template>
  <div class="flex min-h-screen items-center justify-center">
    <div class="border-primary h-8 w-8 animate-spin rounded-full border-4 border-t-transparent" />
  </div>
</template>

<script setup lang="ts">
definePageMeta({ layout: false })

const { isAuthenticated, loading } = useAuth()

watch(
  [isAuthenticated, loading],
  () => {
    if (!loading.value) {
      navigateTo(isAuthenticated.value ? '/dashboard' : '/login', { replace: true })
    }
  },
  { immediate: true },
)
</script>
