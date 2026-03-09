<template>
  <div class="flex items-center justify-between">
    <div>
      <h1 class="text-2xl font-bold tracking-tight">Billing</h1>
      <p class="text-muted-foreground text-sm">Manage invoices and payments</p>
    </div>
    <Button size="lg" @click="emit('newInvoice')">
      <Plus class="mr-2 h-4 w-4" />
      New Invoice
    </Button>
  </div>
</template>

<script setup lang="ts">
import { Plus } from 'lucide-vue-next'

const emit = defineEmits<{
  newInvoice: []
}>()
</script>
