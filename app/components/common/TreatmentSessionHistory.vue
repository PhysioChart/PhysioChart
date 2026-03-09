<template>
  <div class="space-y-2">
    <div v-if="loading" class="space-y-2">
      <Skeleton class="h-3 w-24" />
      <Skeleton class="h-3 w-36" />
    </div>
    <p v-else-if="error" class="text-xs text-amber-600">{{ error }}</p>
    <p v-else-if="history.length === 0" class="text-muted-foreground text-xs">
      No completed sessions yet
    </p>
    <ul v-else class="space-y-1">
      <li v-for="item in history" :key="item.sessionId" class="text-xs">
        <div class="text-muted-foreground inline-flex items-center gap-2">
          <span class="font-medium">{{ formatDate(item.finalizedAt) }}</span>
          <span class="text-muted-foreground/80 text-[11px]">Session note</span>
        </div>
        <div class="text-foreground/90 flex items-start gap-2">
          <span class="flex-1">
            <template v-if="isExpanded(item.sessionId) || !isTruncated(item.note)">
              {{ item.note || '—' }}
            </template>
            <template v-else>
              {{ truncated(item.note) }}
              <TooltipProvider>
                <Tooltip>
                  <TooltipTrigger as-child>
                    <Button
                      variant="ghost"
                      size="sm"
                      class="text-primary h-auto p-0 underline"
                      @click="toggleExpand(item.sessionId)"
                    >
                      View full note
                    </Button>
                  </TooltipTrigger>
                  <TooltipContent class="max-w-xs text-sm whitespace-pre-wrap">
                    {{ item.note }}
                  </TooltipContent>
                </Tooltip>
              </TooltipProvider>
            </template>
          </span>
          <Button
            v-if="isTruncated(item.note)"
            variant="ghost"
            size="icon"
            class="h-6 w-6 p-0"
            :aria-expanded="isExpanded(item.sessionId)"
            @click="toggleExpand(item.sessionId)"
          >
            <span class="sr-only">Toggle full note</span>
            <span v-if="isExpanded(item.sessionId)">−</span>
            <span v-else>+</span>
          </Button>
        </div>
      </li>
    </ul>
  </div>
</template>

<script setup lang="ts">
import { ref } from 'vue'
import { Button } from '~/components/ui/button'
import { Skeleton } from '~/components/ui/skeleton'
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '~/components/ui/tooltip'
import { formatDate } from '~/lib/formatters'
import type { ITreatmentSessionHistoryItem } from '~/types/models/treatment.types'

defineProps<{
  history: ITreatmentSessionHistoryItem[]
  loading?: boolean
  error?: string | null
}>()

const expanded = ref<Set<string>>(new Set())
const LIMIT = 140

function isTruncated(note: string | null): boolean {
  if (!note) return false
  return note.length > LIMIT
}

function truncated(note: string | null): string {
  if (!note) return '—'
  return note.length > LIMIT ? `${note.slice(0, LIMIT)}…` : note
}

function isExpanded(id: string): boolean {
  return expanded.value.has(id)
}

function toggleExpand(id: string): void {
  if (expanded.value.has(id)) {
    expanded.value.delete(id)
  } else {
    expanded.value.add(id)
  }
}
</script>
