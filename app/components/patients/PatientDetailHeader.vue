<template>
  <div class="flex items-center justify-between">
    <div class="flex items-center gap-3">
      <Button variant="ghost" size="icon" @click="emit('back')">
        <ArrowLeft class="h-4 w-4" />
      </Button>
      <div>
        <h1 class="text-2xl font-bold tracking-tight">{{ patient.full_name }}</h1>
        <p class="text-muted-foreground text-sm">
          Patient since {{ formatDateLong(patient.created_at) }}
        </p>
      </div>
    </div>
    <div class="flex gap-2">
      <Button variant="outline" @click="emit('edit')">
        <Pencil class="mr-2 h-4 w-4" />
        Edit
      </Button>
      <Button variant="outline" class="text-destructive" :disabled="isArchiving" @click="onArchive">
        <Archive class="mr-2 h-4 w-4" />
        {{ isArchiving ? 'Archiving...' : 'Archive' }}
      </Button>
    </div>
  </div>
</template>

<script setup lang="ts">
import { ArrowLeft, Pencil, Archive } from 'lucide-vue-next'
import type { Tables } from '~/types/database'
import { formatDateLong } from '~/lib/formatters'

defineProps<{
  patient: Tables<'patients'>
  isArchiving: boolean
}>()

const emit = defineEmits<{
  (e: 'back' | 'edit' | 'archive'): void
}>()

function onArchive() {
  emit('archive')
}
</script>
