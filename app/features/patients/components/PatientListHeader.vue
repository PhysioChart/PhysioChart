<template>
  <div class="space-y-4">
    <div class="flex items-center justify-between">
      <div>
        <h1 class="text-2xl font-bold tracking-tight">Patients</h1>
        <p class="text-muted-foreground text-sm">Manage your clinic's patient records</p>
      </div>
      <Button size="lg" @click="emit('addPatient')">
        <UserPlus class="mr-2 h-4 w-4" />
        New Patient
      </Button>
    </div>

    <div class="relative w-full max-w-sm">
      <Search class="text-muted-foreground absolute top-1/2 left-3 h-4 w-4 -translate-y-1/2" />
      <Input
        :model-value="search"
        class="pl-9"
        placeholder="Search by name or phone..."
        @update:model-value="emit('update:search', $event as string)"
      />
    </div>
  </div>
</template>

<script setup lang="ts">
import { UserPlus, Search } from 'lucide-vue-next'

defineProps<{
  search: string
}>()

const emit = defineEmits<{
  (e: 'update:search', value: string): void
  (e: 'addPatient'): void
}>()
</script>
