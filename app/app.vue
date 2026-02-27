<template>
  <div
    v-if="!clientReady || loading"
    class="bg-background text-foreground flex min-h-screen items-center justify-center"
  >
    <div class="border-primary h-8 w-8 animate-spin rounded-full border-4 border-t-transparent" />
  </div>
  <div v-else>
    <NuxtRouteAnnouncer />
    <NuxtLayout>
      <NuxtPage />
    </NuxtLayout>
    <Sonner />
  </div>
</template>

<script setup lang="ts">
const { initialize, loading } = useAuth()
const clientReady = ref(false)

onMounted(async () => {
  await initialize()
  clientReady.value = true
})
</script>
