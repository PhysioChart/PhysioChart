<template>
  <Dialog v-model:open="open">
    <DialogContent :class="bookingMode === 'series' ? 'sm:max-w-lg' : 'sm:max-w-md'">
      <DialogHeader>
        <DialogTitle>Book Appointment</DialogTitle>
        <DialogDescription>Schedule a new appointment for a patient.</DialogDescription>
      </DialogHeader>

      <form class="space-y-4" @submit.prevent="emit('submit')">
        <div>
          <Label>Booking Type</Label>
          <div class="mt-1 flex gap-2">
            <Button
              type="button"
              size="sm"
              :variant="bookingMode === 'single' ? 'default' : 'outline'"
              @click="bookingMode = 'single'"
            >
              Single
            </Button>
            <Button
              type="button"
              size="sm"
              :variant="bookingMode === 'series' ? 'default' : 'outline'"
              @click="bookingMode = 'series'"
            >
              Series
            </Button>
          </div>
        </div>

        <div>
          <Label>Patient *</Label>
          <Select v-model="form.patient_id">
            <SelectTrigger>
              <SelectValue placeholder="Select patient" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem v-for="p in patients" :key="p.id" :value="p.id">
                {{ p.full_name }} ({{ p.phone }})
              </SelectItem>
            </SelectContent>
          </Select>
        </div>

        <div>
          <Label>Doctor *</Label>
          <Select v-model="form.therapist_id">
            <SelectTrigger>
              <SelectValue placeholder="Select doctor" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem v-for="t in therapists" :key="t.id" :value="t.id">
                {{ t.full_name }}
              </SelectItem>
            </SelectContent>
          </Select>
        </div>

        <div>
          <Label>Treatment Plan (Optional)</Label>
          <Select v-model="form.treatment_plan_id" :disabled="!canSelectTreatment">
            <SelectTrigger>
              <SelectValue :placeholder="treatmentSelectPlaceholder" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem :value="noTreatmentPlanValue">No linked plan</SelectItem>
              <SelectItem v-for="plan in activeTreatmentPlans" :key="plan.id" :value="plan.id">
                <span v-if="plan.total_sessions !== null">
                  {{ plan.name }} ({{ plan.derived_completed_sessions }}/{{ plan.total_sessions }})
                </span>
                <span v-else>{{ plan.name }} ({{ plan.derived_completed_sessions }} sessions)</span>
              </SelectItem>
            </SelectContent>
          </Select>
        </div>

        <div class="grid grid-cols-3 gap-3">
          <div>
            <Label>{{ bookingMode === 'series' ? 'Start Date *' : 'Date *' }}</Label>
            <Input v-model="form.date" type="date" />
          </div>
          <div>
            <Label>Time *</Label>
            <Select v-model="form.start_time" :disabled="!isDoctorSelected">
              <SelectTrigger>
                <SelectValue
                  :placeholder="isDoctorSelected ? 'Select time' : 'Select doctor first'"
                />
              </SelectTrigger>
              <SelectContent>
                <SelectItem
                  v-for="option in timeOptions"
                  :key="option.value"
                  :value="option.value"
                  :disabled="option.disabled"
                >
                  {{ option.label }}
                  <span v-if="option.disabledReason" class="text-muted-foreground ml-2 text-xs">
                    ({{ option.disabledReason }})
                  </span>
                </SelectItem>
              </SelectContent>
            </Select>
          </div>
          <div>
            <Label>Duration</Label>
            <Select v-model="form.duration">
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="15">15 min</SelectItem>
                <SelectItem value="30">30 min</SelectItem>
                <SelectItem value="45">45 min</SelectItem>
                <SelectItem value="60">1 hour</SelectItem>
                <SelectItem value="90">1.5 hours</SelectItem>
              </SelectContent>
            </Select>
          </div>
        </div>

        <template v-if="bookingMode === 'series'">
          <div>
            <Label>Days of Week *</Label>
            <div class="mt-1 flex flex-wrap gap-1.5">
              <Button
                v-for="(dayName, dayIndex) in dayNames"
                :key="dayIndex"
                type="button"
                size="sm"
                :variant="seriesConfig.days.includes(dayIndex) ? 'default' : 'outline'"
                class="h-8 w-11 text-xs"
                @click="emit('toggle-day', dayIndex)"
              >
                {{ dayName }}
              </Button>
            </div>
          </div>

          <div>
            <Label>Total Sessions *</Label>
            <Input
              v-model.number="seriesConfig.totalSessions"
              type="number"
              min="2"
              max="60"
              class="w-24"
            />
          </div>

          <div v-if="seriesDates.length > 0" class="max-h-40 overflow-y-auto rounded-md border p-3">
            <p class="text-muted-foreground mb-2 text-xs">
              {{ seriesDates.length }} sessions will be created:
            </p>
            <div class="space-y-1">
              <div
                v-for="(date, i) in seriesDates"
                :key="date"
                class="flex items-center justify-between text-xs"
              >
                <span>{{ i + 1 }}. {{ formatSeriesDate(date) }} at {{ form.start_time }}</span>
                <Badge v-if="conflicts.has(date)" variant="destructive" class="h-4 text-[10px]"
                  >Conflict</Badge
                >
              </div>
            </div>
            <p v-if="conflicts.size > 0" class="mt-2 text-xs text-amber-600">
              {{ conflicts.size }} slot(s) have conflicts. Resolve them before booking.
            </p>
          </div>
        </template>

        <p v-if="hasSelectedSlotConflict && selectedSlotConflict" class="text-sm text-red-600">
          This doctor is already booked from
          {{ formatTime(selectedSlotConflict.start_time) }} to
          {{ formatTime(selectedSlotConflict.end_time) }}.
        </p>

        <div>
          <Label>Notes</Label>
          <Textarea v-model="form.notes" placeholder="Optional notes" rows="2" />
        </div>

        <DialogFooter>
          <Button type="button" variant="outline" @click="emit('cancel')">Cancel</Button>
          <Button
            type="submit"
            :disabled="
              isSubmitting ||
              !form.patient_id ||
              !form.therapist_id ||
              hasSelectedSlotConflict ||
              (bookingMode === 'series' && conflicts.size > 0) ||
              (bookingMode === 'series' && seriesConfig.days.length === 0)
            "
          >
            {{
              isSubmitting
                ? 'Booking...'
                : bookingMode === 'series'
                  ? `Book ${seriesDates.length} Appointments`
                  : 'Book Appointment'
            }}
          </Button>
        </DialogFooter>
      </form>
    </DialogContent>
  </Dialog>
</template>

<script setup lang="ts">
import type { Tables } from '~/types/database'
import type { ITreatmentPlanWithRelations } from '~/types/models/treatment.types'
import type {
  AppointmentBookingMode,
  AppointmentFormState,
  AppointmentTimeOption,
  SeriesConfigState,
} from '~/features/appointments/types'
import { formatSeriesDate, formatTime } from '~/lib/formatters'
import type { IAppointmentBlockingInterval } from '~/services/appointment.service'

withDefaults(
  defineProps<{
    isSubmitting: boolean
    patients: Tables<'patients'>[]
    therapists: Tables<'profiles'>[]
    activeTreatmentPlans: ITreatmentPlanWithRelations[]
    canSelectTreatment?: boolean
    treatmentSelectPlaceholder: string
    noTreatmentPlanValue: string
    dayNames: string[]
    seriesDates: string[]
    conflicts: Set<string>
    timeOptions: AppointmentTimeOption[]
    isDoctorSelected: boolean
    hasSelectedSlotConflict: boolean
    selectedSlotConflict: IAppointmentBlockingInterval | null
  }>(),
  {
    canSelectTreatment: false,
  },
)

const open = defineModel<boolean>('open', { required: true })
const form = defineModel<AppointmentFormState>('form', { required: true })
const bookingMode = defineModel<AppointmentBookingMode>('bookingMode', { required: true })
const seriesConfig = defineModel<SeriesConfigState>('seriesConfig', { required: true })

const emit = defineEmits<{
  (e: 'submit' | 'cancel'): void
  (e: 'toggle-day', day: number): void
}>()
</script>
