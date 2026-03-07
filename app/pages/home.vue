<template>
  <DashboardPage />
</template>

<script setup lang="ts">
import DashboardPage from './dashboard.vue'

definePageMeta({ layout: 'protected' })
</script>
