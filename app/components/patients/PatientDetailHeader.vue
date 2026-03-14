<template>
  <div class="flex items-start gap-3">
    <Button variant="ghost" size="icon" class="mt-1 shrink-0" @click="emit('back')">
      <ArrowLeft class="h-4 w-4" />
    </Button>
    <div class="min-w-0 flex-1">
      <div class="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
        <div class="min-w-0">
          <h1 class="text-2xl font-bold tracking-tight">{{ patient.full_name }}</h1>
          <p class="text-muted-foreground text-sm">
            Patient since {{ formatDateLong(patient.created_at) }}
          </p>
        </div>
        <div class="flex shrink-0 gap-2">
          <Button variant="outline" size="sm" @click="emit('edit')">
            <Pencil class="mr-1.5 h-3.5 w-3.5" />
            Edit
          </Button>
          <Button
            variant="outline"
            size="sm"
            class="text-destructive"
            :disabled="isArchiving"
            @click="onArchive"
          >
            <Archive class="mr-1.5 h-3.5 w-3.5" />
            {{ isArchiving ? 'Archiving...' : 'Archive' }}
          </Button>
        </div>
      </div>
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
