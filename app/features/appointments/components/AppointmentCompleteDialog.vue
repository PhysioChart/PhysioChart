<template>
  <Dialog :open="open" @update:open="emit('update:open', $event)">
    <DialogContent class="sm:max-w-lg">
      <DialogHeader>
        <DialogTitle>Complete Appointment</DialogTitle>
        <DialogDescription>
          Finalize this appointment and optionally add a note for treatment history.
        </DialogDescription>
      </DialogHeader>

      <div class="space-y-4">
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
            v-model="note"
            :maxlength="MAX_LENGTH"
            rows="4"
            placeholder="What was done in this session?"
          />
          <div class="text-muted-foreground flex items-center justify-between text-xs">
            <span>{{ helperText }}</span>
            <span>{{ note.length }}/{{ MAX_LENGTH }}</span>
          </div>
        </div>

        <DialogFooter>
          <Button
            type="button"
            variant="outline"
            :disabled="isSubmitting"
            @click="emit('update:open', false)"
          >
            Cancel
          </Button>
          <Button
            type="button"
            :disabled="isSubmitting || note.length > MAX_LENGTH"
            @click="handleSubmit"
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
import type { ICompleteAppointmentPayload } from '~/features/appointments/types'
import { formatDateTime } from '~/lib/formatters'

const MAX_LENGTH = 1000

const props = defineProps<{
  open: boolean
  appointment: IAppointmentWithRelations
}>()

const emit = defineEmits<{
  'update:open': [value: boolean]
  submit: [payload: ICompleteAppointmentPayload]
}>()

const note = ref('')
const isSubmitting = ref(false)

const hasPlan = computed(() => Boolean(props.appointment.treatment_plan_id))

const planLabel = computed(() => {
  return props.appointment.treatment_plan?.name ?? 'No treatment plan linked'
})

const helperText = computed(() =>
  hasPlan.value
    ? "Note will be saved to this treatment plan's history."
    : "Note will be saved to this visit's session history (no treatment plan linked).",
)

const primaryCta = computed(() => (hasPlan.value ? 'Complete & Save Note' : 'Mark Completed'))

function handleSubmit() {
  isSubmitting.value = true
  emit('submit', {
    appointmentId: props.appointment.id,
    note: note.value.trim() || null,
  })
}

function markSubmitted() {
  isSubmitting.value = false
}

watch(
  () => props.open,
  (isOpen) => {
    if (!isOpen) {
      note.value = ''
      isSubmitting.value = false
    }
  },
)

defineExpose({ markSubmitted })
</script>
