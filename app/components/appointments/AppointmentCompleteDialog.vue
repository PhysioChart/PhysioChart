<template>
  <Dialog v-model:open="open">
    <DialogContent class="sm:max-w-lg">
      <DialogHeader>
        <DialogTitle>Complete Appointment</DialogTitle>
        <DialogDescription>
          Finalize this appointment and optionally add a note for treatment history.
        </DialogDescription>
      </DialogHeader>

      <div v-if="appointment" class="space-y-4">
        <div class="bg-muted/50 rounded-md border p-3">
          <p class="text-sm font-medium">
            {{ appointment.patient?.full_name ?? 'Unknown patient' }}
          </p>
          <p class="text-muted-foreground text-xs">{{ formatDateTime(appointment.start_time) }}</p>
          <p class="text-muted-foreground text-xs">
            {{ planLabel }}
          </p>
        </div>

        <div class="space-y-2">
          <Label for="sessionNote">Session note (optional)</Label>
          <Textarea
            id="sessionNote"
            v-model="noteModel"
            :maxlength="maxLength"
            rows="4"
            placeholder="What was done in this session?"
          />
          <div class="text-muted-foreground flex items-center justify-between text-xs">
            <span>{{ helperText }}</span>
            <span>{{ noteModel.length }}/{{ maxLength }}</span>
          </div>
        </div>

        <p v-if="error" class="text-sm text-red-600">{{ error }}</p>

        <DialogFooter>
          <Button type="button" variant="outline" :disabled="isSubmitting" @click="emit('cancel')">
            Cancel
          </Button>
          <Button
            type="button"
            :disabled="isSubmitting || noteModel.length > maxLength"
            @click="emit('submit')"
          >
            <span v-if="isSubmitting">Completing...</span>
            <span v-else>{{ primaryCta }}</span>
          </Button>
        </DialogFooter>
      </div>
    </DialogContent>
  </Dialog>
</template>

<script setup lang="ts">
import type { IAppointmentWithRelations } from '~/types/models/appointment.types'
import { formatDateTime } from '~/lib/formatters'

const props = withDefaults(
  defineProps<{
    appointment: IAppointmentWithRelations | null
    isSubmitting: boolean
    variant: 'withPlan' | 'withoutPlan'
    maxLength?: number
    error?: string | null
  }>(),
  {
    maxLength: 1000,
    error: null,
  },
)

const open = defineModel<boolean>('open', { required: true })
const noteModel = defineModel<string>('note', { required: true })

const emit = defineEmits<{
  (e: 'submit' | 'cancel'): void
}>()

const planLabel = computed(() => {
  if (!props.appointment) return '—'
  return props.appointment?.treatment_plan?.name ?? 'No treatment plan linked'
})

const helperText = computed(() =>
  props.variant === 'withPlan'
    ? "Note will be saved to this treatment plan's history."
    : "Note will be saved to this visit's session history (no treatment plan linked).",
)

const primaryCta = computed(() =>
  props.variant === 'withPlan' ? 'Complete & Save Note' : 'Mark Completed',
)
</script>
