<template>
  <div class="flex items-center gap-4 p-4">
    <div class="flex flex-col items-center text-center">
      <span class="text-muted-foreground text-xs">{{ formatDate(appointment.start_time) }}</span>
      <span class="text-sm font-semibold">{{ formatTime(appointment.start_time) }}</span>
      <span class="text-muted-foreground text-xs">{{ formatTime(appointment.end_time) }}</span>
    </div>

    <Separator orientation="vertical" class="h-12" />

    <div class="flex-1">
      <p class="font-medium">{{ appointment.patient?.full_name ?? 'Unknown patient' }}</p>
      <p class="text-muted-foreground text-xs">
        <span v-if="appointment.therapist">with {{ appointment.therapist.full_name }}</span>
        <span v-if="appointment.treatment_plan">
          &middot; Plan: {{ appointment.treatment_plan.name }}</span
        >
        <span v-if="appointment.notes"> &middot; {{ appointment.notes }}</span>
      </p>
    </div>

    <div class="flex items-center gap-2">
      <Badge :class="getStatusColor(appointment.status)" variant="secondary">
        {{ APPOINTMENT_STATUS_LABELS[appointment.status] }}
      </Badge>
      <Badge v-if="appointment.series_id" variant="outline" class="text-[10px]">
        {{ appointment.series_index }}/{{ seriesTotal }}
      </Badge>
    </div>

    <div class="flex gap-1">
      <Tooltip v-if="appointment.patient">
        <TooltipTrigger as-child>
          <Button
            variant="ghost"
            size="icon"
            as="a"
            :href="getWhatsAppLink(appointment.patient, appointment.start_time)"
            target="_blank"
          >
            <MessageCircle class="h-4 w-4" />
          </Button>
        </TooltipTrigger>
        <TooltipContent>Send WhatsApp reminder</TooltipContent>
      </Tooltip>

      <DropdownMenu v-if="appointment.status === AppointmentStatus.SCHEDULED">
        <DropdownMenuTrigger as-child>
          <Button variant="ghost" size="sm">Update</Button>
        </DropdownMenuTrigger>
        <DropdownMenuContent>
          <DropdownMenuItem
            @click="emit('update-status', appointment.id, AppointmentStatus.COMPLETED)"
          >
            Mark Completed
          </DropdownMenuItem>
          <DropdownMenuItem
            @click="emit('update-status', appointment.id, AppointmentStatus.CANCELLED)"
          >
            Mark Cancelled
          </DropdownMenuItem>
          <DropdownMenuItem
            @click="emit('update-status', appointment.id, AppointmentStatus.NO_SHOW)"
          >
            Mark No-Show
          </DropdownMenuItem>
          <template v-if="appointment.series_id">
            <DropdownMenuSeparator />
            <DropdownMenuItem
              class="text-destructive"
              @click="emit('cancel-series', appointment.series_id)"
            >
              Cancel Remaining in Series
            </DropdownMenuItem>
          </template>
        </DropdownMenuContent>
      </DropdownMenu>
    </div>
  </div>
</template>

<script setup lang="ts">
import { MessageCircle } from 'lucide-vue-next'
import { APPOINTMENT_STATUS_LABELS, AppointmentStatus } from '~/enums/appointment.enum'
import { formatDate, formatTime, getStatusColor, getWhatsAppLink } from '~/lib/formatters'
import type { IAppointmentWithRelations } from '~/types/models/appointment.types'

defineProps<{
  appointment: IAppointmentWithRelations
  seriesTotal: number
}>()

const emit = defineEmits<{
  (e: 'update-status', id: string, status: AppointmentStatus): void
  (e: 'cancel-series', seriesId: string): void
}>()
</script>
