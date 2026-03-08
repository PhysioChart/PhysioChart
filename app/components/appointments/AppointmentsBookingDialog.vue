<template>
  <Dialog v-model:open="open">
    <DialogContent class="sm:max-w-md">
      <DialogHeader class="-mx-6 -mt-6 border-b px-6 py-4">
        <DialogTitle>Book Appointment</DialogTitle>
        <DialogDescription>Schedule a new appointment for a patient.</DialogDescription>
      </DialogHeader>

      <form class="space-y-4 pt-2" @submit.prevent="emit('submit')">
        <p v-if="linkedTreatmentName" class="text-xs text-blue-600">
          Linked booking: {{ linkedTreatmentName }} (patient and treatment are locked)
        </p>

        <div class="space-y-2">
          <Label>Booking Type</Label>
          <div class="flex gap-2">
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

        <div class="grid gap-4 sm:grid-cols-2">
          <div class="space-y-2">
            <Label>Patient *</Label>
            <Select v-model="form.patient_id" :disabled="lockPatient">
              <SelectTrigger class="w-full">
                <SelectValue placeholder="Select patient" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem v-for="p in patients" :key="p.id" :value="p.id">
                  {{ p.full_name }} ({{ p.phone }})
                </SelectItem>
              </SelectContent>
            </Select>
          </div>

          <div class="space-y-2">
            <Label>Doctor *</Label>
            <Select v-model="form.therapist_id">
              <SelectTrigger class="w-full">
                <SelectValue placeholder="Select doctor" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem v-for="t in therapists" :key="t.id" :value="t.id">
                  {{ t.full_name }}
                </SelectItem>
              </SelectContent>
            </Select>
          </div>
        </div>

        <div class="grid gap-4 sm:grid-cols-2">
          <div class="space-y-2">
            <Label>Treatment Plan (Optional)</Label>
            <Select
              v-model="form.treatment_plan_id"
              :disabled="!canSelectTreatment || lockTreatmentPlan"
            >
              <SelectTrigger class="w-full">
                <SelectValue :placeholder="treatmentSelectPlaceholder" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem :value="noTreatmentPlanValue">No linked plan</SelectItem>
                <SelectItem v-for="plan in activeTreatmentPlans" :key="plan.id" :value="plan.id">
                  <span v-if="plan.total_sessions !== null">
                    {{ plan.name }} ({{ plan.derived_completed_sessions }}/{{
                      plan.total_sessions
                    }})
                  </span>
                  <span v-else
                    >{{ plan.name }} ({{ plan.derived_completed_sessions }} sessions)</span
                  >
                </SelectItem>
              </SelectContent>
            </Select>
          </div>

          <div class="space-y-2">
            <Label>{{ bookingMode === 'series' ? 'Start Date *' : 'Date *' }}</Label>
            <Popover v-model:open="datePickerOpen" modal>
              <PopoverTrigger as-child>
                <Button
                  type="button"
                  variant="outline"
                  :class="
                    cn(
                      'w-full justify-start text-left font-normal',
                      !form.date && 'text-muted-foreground',
                    )
                  "
                >
                  <CalendarIcon class="mr-2 size-4" />
                  {{ formattedDate || 'Pick a date' }}
                </Button>
              </PopoverTrigger>
              <PopoverContent class="w-auto p-0" align="start">
                <Calendar v-model="calendarValue" />
              </PopoverContent>
            </Popover>
          </div>
        </div>

        <div class="grid gap-4 sm:grid-cols-2">
          <div class="space-y-2">
            <Label>Time *</Label>
            <Select v-model="form.start_time" :disabled="!isDoctorSelected">
              <SelectTrigger class="w-full">
                <SelectValue placeholder="Select time" />
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
            <p v-if="!isDoctorSelected" class="text-muted-foreground text-xs">
              Choose a doctor to view available time slots.
            </p>
          </div>
          <div class="space-y-2">
            <Label>Duration</Label>
            <Select v-model="form.duration">
              <SelectTrigger class="w-full">
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
          <div class="space-y-2">
            <Label>Total Sessions *</Label>
            <NumberInput v-model="seriesConfig.totalSessions" :min="2" :max="60" />
          </div>

          <div class="space-y-2">
            <Label>Days of Week *</Label>
            <div class="flex flex-wrap gap-1.5">
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

          <div v-if="seriesDates.length > 0" class="rounded-md border p-3">
            <div class="flex items-start justify-between gap-3">
              <div>
                <p class="text-sm font-medium">{{ seriesDates.length }} sessions scheduled</p>
                <p v-if="formattedTime" class="text-muted-foreground text-xs">
                  Starting {{ formatSeriesDate(seriesDates[0]!) }} at {{ formattedTime }}
                </p>
              </div>
              <Badge v-if="conflicts.size === 0" variant="secondary" class="shrink-0 text-[10px]">
                Ready
              </Badge>
            </div>

            <div class="mt-3 flex flex-wrap gap-2">
              <Badge
                v-for="date in seriesDates"
                :key="date"
                variant="outline"
                class="px-2 py-1 text-[10px]"
              >
                {{ formatSeriesDate(date)
                }}<template v-if="formattedTime"> at {{ formattedTime }}</template>
              </Badge>
            </div>

            <p v-if="conflicts.size > 0" class="mt-3 text-xs text-amber-600">
              {{ conflicts.size }} slot(s) have conflicts. Resolve them before booking.
            </p>
          </div>
        </template>

        <p v-if="hasSelectedSlotConflict && selectedSlotConflict" class="text-sm text-red-600">
          This doctor is already booked from
          {{ formatTime(selectedSlotConflict.start_time) }} to
          {{ formatTime(selectedSlotConflict.end_time) }}.
        </p>

        <div class="space-y-2">
          <Label>Notes</Label>
          <Textarea v-model="form.notes" placeholder="Optional notes" rows="2" />
        </div>

        <DialogFooter class="-mx-6 -mb-6 border-t px-6 py-4">
          <Button type="button" variant="outline" @click="emit('cancel')">Cancel</Button>
          <Button
            type="submit"
            :disabled="
              isSubmitting ||
              !form.patient_id ||
              !form.therapist_id ||
              !form.date ||
              !form.start_time ||
              (bookingMode === 'single' && hasSelectedSlotConflict) ||
              (bookingMode === 'series' && conflicts.size > 0) ||
              (bookingMode === 'series' && seriesConfig.days.length === 0) ||
              (bookingMode === 'series' && seriesDates.length === 0)
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
import type { DateValue } from 'reka-ui'
import { CalendarDate } from '@internationalized/date'
import { CalendarIcon } from 'lucide-vue-next'
import { Calendar } from '~/components/ui/calendar'
import { NumberInput } from '~/components/ui/input'
import { Popover, PopoverContent, PopoverTrigger } from '~/components/ui/popover'
import type { Tables } from '~/types/database'
import type { IClinicStaffMember } from '~/services/staff.service'
import type { ITreatmentPlanWithRelations } from '~/types/models/treatment.types'
import type {
  AppointmentBookingMode,
  AppointmentFormState,
  AppointmentTimeOption,
  SeriesConfigState,
} from '~/features/appointments/types'
import { cn } from '~/lib/utils'
import { formatSeriesDate, formatTime } from '~/lib/formatters'
import type { IAppointmentBlockingInterval } from '~/services/appointment.service'

withDefaults(
  defineProps<{
    isSubmitting: boolean
    patients: Tables<'patients'>[]
    therapists: IClinicStaffMember[]
    activeTreatmentPlans: ITreatmentPlanWithRelations[]
    canSelectTreatment?: boolean
    lockPatient?: boolean
    lockTreatmentPlan?: boolean
    linkedTreatmentName?: string | null
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
    lockPatient: false,
    lockTreatmentPlan: false,
    linkedTreatmentName: null,
  },
)

const open = defineModel<boolean>('open', { required: true })
const form = defineModel<AppointmentFormState>('form', { required: true })
const bookingMode = defineModel<AppointmentBookingMode>('bookingMode', { required: true })
const seriesConfig = defineModel<SeriesConfigState>('seriesConfig', { required: true })

const datePickerOpen = ref(false)

const calendarValue = computed<DateValue | undefined>({
  get() {
    if (!form.value.date) return undefined
    const [year, month, day] = form.value.date.split('-').map(Number) as [number, number, number]
    return new CalendarDate(year, month, day)
  },
  set(val: DateValue | undefined) {
    if (val) {
      const y = String(val.year).padStart(4, '0')
      const m = String(val.month).padStart(2, '0')
      const d = String(val.day).padStart(2, '0')
      form.value.date = `${y}-${m}-${d}`
    } else {
      form.value.date = ''
    }
    datePickerOpen.value = false
  },
})

const formattedDate = computed(() => {
  if (!form.value.date) return ''
  return new Date(form.value.date + 'T00:00:00').toLocaleDateString('en-IN', {
    weekday: 'short',
    day: 'numeric',
    month: 'short',
    year: 'numeric',
  })
})

const formattedTime = computed(() => {
  if (!form.value.start_time) return ''
  return new Date(`2000-01-01T${form.value.start_time}:00`).toLocaleTimeString('en-IN', {
    hour: '2-digit',
    minute: '2-digit',
    hour12: true,
  })
})

const emit = defineEmits<{
  (e: 'submit' | 'cancel'): void
  (e: 'toggle-day', day: number): void
}>()
</script>
