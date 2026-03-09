<template>
  <Card>
    <CardContent class="p-0">
      <div v-if="isLoading" class="space-y-3 p-6">
        <Skeleton v-for="i in 5" :key="i" class="h-12 w-full" />
      </div>
      <div
        v-else-if="patients.length === 0"
        class="flex flex-col items-center justify-center py-12 text-center"
      >
        <Users class="text-muted-foreground/50 mb-3 h-10 w-10" />
        <p class="text-muted-foreground text-sm">
          {{ hasSearchQuery ? 'No patients match your search' : 'No patients registered yet' }}
        </p>
        <slot v-if="!hasSearchQuery" name="empty-action" />
      </div>
      <div v-else class="overflow-x-auto">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Name</TableHead>
              <TableHead>Phone</TableHead>
              <TableHead class="hidden md:table-cell">Gender</TableHead>
              <TableHead class="hidden md:table-cell">Registered</TableHead>
              <TableHead class="text-right">Actions</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            <TableRow
              v-for="patient in patients"
              :key="patient.id"
              role="link"
              tabindex="0"
              :aria-label="`Open patient ${patient.full_name}`"
              class="cursor-pointer"
              @click="emit('viewPatient', patient.id)"
              @keydown.enter="emit('viewPatient', patient.id)"
            >
              <TableCell class="font-medium">{{ patient.full_name }}</TableCell>
              <TableCell>
                <div class="flex items-center gap-1">
                  <Phone class="text-muted-foreground h-3 w-3" />
                  {{ patient.phone }}
                </div>
              </TableCell>
              <TableCell class="hidden md:table-cell">
                {{ patient.gender ? GENDER_LABELS[patient.gender] : '\u2014' }}
              </TableCell>
              <TableCell class="hidden md:table-cell">
                {{ formatDateWithYear(patient.created_at) }}
              </TableCell>
              <TableCell class="text-right">
                <Button variant="ghost" size="sm" @click.stop="emit('viewPatient', patient.id)">
                  View
                </Button>
              </TableCell>
            </TableRow>
          </TableBody>
        </Table>
      </div>
    </CardContent>
  </Card>
</template>

<script setup lang="ts">
import { Users, Phone } from 'lucide-vue-next'
import type { Tables } from '~/types/database'
import { GENDER_LABELS } from '~/enums/gender.enum'
import { formatDateWithYear } from '~/lib/formatters'

defineProps<{
  patients: Tables<'patients'>[]
  isLoading: boolean
  hasSearchQuery?: boolean
}>()

const emit = defineEmits<{
  (e: 'viewPatient', id: string): void
}>()
</script>
