<template>
  <div class="bg-muted/40 min-h-screen">
    <header class="flex h-14 items-center justify-end px-4">
      <ThemeToggle />
    </header>
    <slot />
  </div>
</template>

<script setup lang="ts">
import ThemeToggle from '~/components/layout/ThemeToggle.vue'
</script>
