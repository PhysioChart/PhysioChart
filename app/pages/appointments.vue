<template>
  <div class="space-y-4">
    <!-- Header -->
    <div class="flex items-center justify-between">
      <div>
        <h1 class="text-2xl font-bold tracking-tight">Appointments</h1>
        <p class="text-muted-foreground text-sm">Manage your clinic's schedule</p>
      </div>
      <Button size="lg" @click="openBookingDialog()">
        <CalendarPlus class="mr-2 h-4 w-4" />
        Book Appointment
      </Button>
      <Dialog v-model:open="showNewDialog">
        <DialogContent :class="bookingMode === 'series' ? 'sm:max-w-lg' : 'sm:max-w-md'">
          <DialogHeader>
            <DialogTitle>Book Appointment</DialogTitle>
            <DialogDescription>Schedule a new appointment for a patient.</DialogDescription>
          </DialogHeader>
          <form class="space-y-4" @submit.prevent="createAppointment">
            <!-- Booking Type Toggle -->
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
              <Select v-model="newAppointment.patient_id">
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
              <Label>Therapist</Label>
              <Select v-model="newAppointment.therapist_id">
                <SelectTrigger>
                  <SelectValue placeholder="Select therapist (optional)" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem v-for="t in therapists" :key="t.id" :value="t.id">
                    {{ t.full_name }}
                  </SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div class="grid grid-cols-3 gap-3">
              <div>
                <Label>{{ bookingMode === 'series' ? 'Start Date *' : 'Date *' }}</Label>
                <Input v-model="newAppointment.date" type="date" />
              </div>
              <div>
                <Label>Time *</Label>
                <Input v-model="newAppointment.start_time" type="time" />
              </div>
              <div>
                <Label>Duration</Label>
                <Select v-model="newAppointment.duration">
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

            <!-- Series Options -->
            <template v-if="bookingMode === 'series'">
              <div>
                <Label>Days of Week *</Label>
                <div class="mt-1 flex flex-wrap gap-1.5">
                  <Button
                    v-for="(dayName, dayIndex) in DAY_NAMES"
                    :key="dayIndex"
                    type="button"
                    size="sm"
                    :variant="seriesConfig.days.includes(dayIndex) ? 'default' : 'outline'"
                    class="h-8 w-11 text-xs"
                    @click="toggleDay(dayIndex)"
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

              <!-- Preview -->
              <div
                v-if="seriesDates.length > 0"
                class="max-h-40 overflow-y-auto rounded-md border p-3"
              >
                <p class="text-muted-foreground mb-2 text-xs">
                  {{ seriesDates.length }} sessions will be created:
                </p>
                <div class="space-y-1">
                  <div
                    v-for="(date, i) in seriesDates"
                    :key="date"
                    class="flex items-center justify-between text-xs"
                  >
                    <span>
                      {{ i + 1 }}. {{ formatSeriesDate(date) }} at
                      {{ newAppointment.start_time }}
                    </span>
                    <Badge v-if="conflicts.has(date)" variant="destructive" class="h-4 text-[10px]">
                      Conflict
                    </Badge>
                  </div>
                </div>
                <p v-if="conflicts.size > 0" class="mt-2 text-xs text-amber-600">
                  {{ conflicts.size }} slot(s) have conflicts. You can still proceed.
                </p>
              </div>
            </template>

            <div>
              <Label>Notes</Label>
              <Textarea v-model="newAppointment.notes" placeholder="Optional notes" rows="2" />
            </div>
            <DialogFooter>
              <Button type="button" variant="outline" @click="resetForm()">Cancel</Button>
              <Button
                type="submit"
                :disabled="
                  isSubmitting ||
                  !newAppointment.patient_id ||
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
    </div>

    <!-- View Controls -->
    <div class="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
      <Tabs v-model="viewMode" class="w-auto">
        <TabsList>
          <TabsTrigger value="list">List</TabsTrigger>
          <TabsTrigger value="day">Day</TabsTrigger>
          <TabsTrigger value="week" class="hidden md:inline-flex">Week</TabsTrigger>
        </TabsList>
      </Tabs>

      <!-- List sub-filter -->
      <div v-if="viewMode === 'list'" class="flex gap-2">
        <Button
          :variant="listFilter === 'today' ? 'default' : 'outline'"
          size="sm"
          @click="listFilter = 'today'"
        >
          Today
        </Button>
        <Button
          :variant="listFilter === 'all' ? 'default' : 'outline'"
          size="sm"
          @click="listFilter = 'all'"
        >
          All
        </Button>
      </div>

      <!-- Calendar navigation -->
      <CalendarNavigation
        v-if="viewMode === 'day'"
        :label="dayViewLabel"
        @prev="goToPrevDay"
        @next="goToNextDay"
        @today="goToToday"
      />
      <CalendarNavigation
        v-if="viewMode === 'week'"
        :label="weekViewLabel"
        @prev="goToPrevWeek"
        @next="goToNextWeek"
        @today="goToToday"
      />
    </div>

    <!-- Therapist color legend -->
    <div v-if="viewMode !== 'list' && therapists.length > 0" class="flex flex-wrap gap-3">
      <div v-for="t in therapists" :key="t.id" class="flex items-center gap-1.5 text-xs">
        <span
          :class="[
            getTherapistColor(t.id, therapistColorMap).bg,
            getTherapistColor(t.id, therapistColorMap).border,
            'h-3 w-3 rounded-sm border-l-2',
          ]"
        />
        <span class="text-muted-foreground">{{ t.full_name }}</span>
      </div>
    </div>

    <!-- Loading -->
    <Card v-if="isLoading">
      <CardContent class="space-y-3 p-6">
        <Skeleton v-for="i in 5" :key="i" class="h-16 w-full" />
      </CardContent>
    </Card>

    <!-- List View -->
    <Card v-else-if="viewMode === 'list'">
      <CardContent class="p-0">
        <div
          v-if="filteredAppointments.length === 0"
          class="flex flex-col items-center justify-center py-12 text-center"
        >
          <CalendarDays class="text-muted-foreground/50 mb-3 h-10 w-10" />
          <p class="text-muted-foreground text-sm">
            {{ listFilter === 'today' ? 'No appointments today' : 'No appointments yet' }}
          </p>
          <Button variant="outline" class="mt-3" @click="openBookingDialog()">
            Book an appointment
          </Button>
        </div>
        <div v-else class="divide-y">
          <div
            v-for="appt in filteredAppointments"
            :key="appt.id"
            class="flex items-center gap-4 p-4"
          >
            <div class="flex flex-col items-center text-center">
              <span class="text-muted-foreground text-xs">{{ formatDate(appt.start_time) }}</span>
              <span class="text-sm font-semibold">{{ formatTime(appt.start_time) }}</span>
              <span class="text-muted-foreground text-xs">{{ formatTime(appt.end_time) }}</span>
            </div>
            <Separator orientation="vertical" class="h-12" />
            <div class="flex-1">
              <p class="font-medium">{{ appt.patient?.full_name ?? 'Unknown patient' }}</p>
              <p class="text-muted-foreground text-xs">
                <span v-if="appt.therapist">with {{ appt.therapist.full_name }}</span>
                <span v-if="appt.notes"> &middot; {{ appt.notes }}</span>
              </p>
            </div>
            <div class="flex items-center gap-2">
              <Badge :class="getStatusColor(appt.status)" variant="secondary">
                {{ APPOINTMENT_STATUS_LABELS[appt.status] }}
              </Badge>
              <Badge v-if="appt.series_id" variant="outline" class="text-[10px]">
                {{ appt.series_index }}/{{ getSeriesTotal(appt.series_id) }}
              </Badge>
            </div>
            <div class="flex gap-1">
              <Tooltip v-if="appt.patient">
                <TooltipTrigger as-child>
                  <Button
                    variant="ghost"
                    size="icon"
                    as="a"
                    :href="getWhatsAppLink(appt.patient, appt.start_time)"
                    target="_blank"
                  >
                    <MessageCircle class="h-4 w-4" />
                  </Button>
                </TooltipTrigger>
                <TooltipContent>Send WhatsApp reminder</TooltipContent>
              </Tooltip>
              <DropdownMenu v-if="appt.status === AppointmentStatus.SCHEDULED">
                <DropdownMenuTrigger as-child>
                  <Button variant="ghost" size="sm">Update</Button>
                </DropdownMenuTrigger>
                <DropdownMenuContent>
                  <DropdownMenuItem @click="updateStatus(appt.id, AppointmentStatus.COMPLETED)">
                    Mark Completed
                  </DropdownMenuItem>
                  <DropdownMenuItem @click="updateStatus(appt.id, AppointmentStatus.CANCELLED)">
                    Mark Cancelled
                  </DropdownMenuItem>
                  <DropdownMenuItem @click="updateStatus(appt.id, AppointmentStatus.NO_SHOW)">
                    Mark No-Show
                  </DropdownMenuItem>
                  <template v-if="appt.series_id">
                    <DropdownMenuSeparator />
                    <DropdownMenuItem
                      class="text-destructive"
                      @click="cancelRemainingSeries(appt.series_id!)"
                    >
                      Cancel Remaining in Series
                    </DropdownMenuItem>
                  </template>
                </DropdownMenuContent>
              </DropdownMenu>
            </div>
          </div>
        </div>
      </CardContent>
    </Card>

    <!-- Day View -->
    <Card v-else-if="viewMode === 'day'">
      <CardContent class="p-0">
        <CalendarDayView
          :appointments="appointments"
          :date-str="currentDay.dateStr"
          :color-map="therapistColorMap"
          @click-slot="handleSlotClick"
          @click-appointment="handleAppointmentClick"
        />
      </CardContent>
    </Card>

    <!-- Week View -->
    <Card v-else-if="viewMode === 'week'">
      <CardContent class="p-0">
        <CalendarWeekView
          :appointments="appointments"
          :week-days="weekDays"
          :color-map="therapistColorMap"
          @click-slot="handleSlotClick"
          @click-appointment="handleAppointmentClick"
        />
      </CardContent>
    </Card>

    <!-- Appointment Detail Sheet -->
    <AppointmentDetailSheet
      v-model:open="showDetailSheet"
      :appointment="selectedAppointment"
      @update-status="updateStatus"
    />
  </div>
</template>

<script setup lang="ts">
import { watchDebounced } from '@vueuse/core'
import { CalendarDays, CalendarPlus, MessageCircle } from 'lucide-vue-next'
import { toast } from 'vue-sonner'
import type { Tables } from '~/types/database'
import type { IAppointmentWithRelations } from '~/types/models/appointment.types'
import { AppointmentStatus, APPOINTMENT_STATUS_LABELS } from '~/enums/appointment.enum'
import { appointmentService } from '~/services/appointment.service'
import { patientService } from '~/services/patient.service'
import { staffService } from '~/services/staff.service'
import {
  formatTime,
  formatDate,
  formatSeriesDate,
  getStatusColor,
  getWhatsAppLink,
} from '~/lib/formatters'

const supabase = useSupabase()
const { profile } = useAuth()
const route = useRoute()

const appointments = ref<IAppointmentWithRelations[]>([])
const patients = ref<Tables<'patients'>[]>([])
const therapists = ref<Tables<'profiles'>[]>([])
const isLoading = ref(true)
const showNewDialog = ref(false)
const viewMode = ref<'list' | 'day' | 'week'>('list')
const listFilter = ref<'today' | 'all'>('today')

// Calendar composable
const {
  weekDays,
  currentDay,
  dayViewLabel,
  weekViewLabel,
  goToToday,
  goToPrevDay,
  goToNextDay,
  goToPrevWeek,
  goToNextWeek,
  buildTherapistColorMap,
  getTherapistColor,
} = useCalendar()

const therapistColorMap = computed(() => buildTherapistColorMap(therapists.value))

// Appointment detail sheet
const showDetailSheet = ref(false)
const selectedAppointment = ref<IAppointmentWithRelations | null>(null)

function handleAppointmentClick(appt: IAppointmentWithRelations) {
  selectedAppointment.value = appt
  showDetailSheet.value = true
}

function handleSlotClick(date: string, time: string) {
  newAppointment.value.date = date
  newAppointment.value.start_time = time
  bookingMode.value = 'single'
  openBookingDialog()
}

function openBookingDialog() {
  loadDropdowns()
  showNewDialog.value = true
}

// Booking form
const newAppointment = ref({
  patient_id: '',
  therapist_id: '',
  date: new Date().toISOString().split('T')[0],
  start_time: '09:00',
  duration: '30',
  notes: '',
})
const isSubmitting = ref(false)

// Recurring appointments
const bookingMode = ref<'single' | 'series'>('single')
const seriesConfig = ref({
  days: [] as number[],
  totalSessions: 10,
})

const DAY_NAMES = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat']

function toggleDay(day: number) {
  const idx = seriesConfig.value.days.indexOf(day)
  if (idx === -1) {
    seriesConfig.value.days.push(day)
    seriesConfig.value.days.sort()
  } else {
    seriesConfig.value.days.splice(idx, 1)
  }
}

const seriesDates = computed(() => {
  if (bookingMode.value !== 'series') return []
  if (seriesConfig.value.days.length === 0) return []
  if (!newAppointment.value.date) return []

  const dates: string[] = []
  const current = new Date(newAppointment.value.date + 'T00:00:00')
  const total = seriesConfig.value.totalSessions
  let safety = 0

  while (dates.length < total && safety < 365) {
    if (seriesConfig.value.days.includes(current.getDay())) {
      dates.push(current.toLocaleDateString('en-CA'))
    }
    current.setDate(current.getDate() + 1)
    safety++
  }
  return dates
})

// Conflict detection
const conflicts = ref<Set<string>>(new Set())

watchDebounced(
  [seriesDates, () => newAppointment.value.therapist_id],
  async () => {
    if (seriesDates.value.length === 0 || !newAppointment.value.therapist_id || !profile.value) {
      conflicts.value = new Set()
      return
    }

    const firstDate = seriesDates.value[0]!
    const lastDate = seriesDates.value[seriesDates.value.length - 1]!

    const data = await appointmentService(supabase).findConflicts(
      profile.value.clinic_id,
      newAppointment.value.therapist_id,
      firstDate,
      lastDate,
    )

    const existing = new Set(
      data
        .filter((startTime) => {
          const d = new Date(startTime)
          const t = `${String(d.getHours()).padStart(2, '0')}:${String(d.getMinutes()).padStart(2, '0')}`
          return t === newAppointment.value.start_time
        })
        .map((startTime) => new Date(startTime).toLocaleDateString('en-CA')),
    )

    conflicts.value = existing
  },
  { debounce: 300 },
)

// Series totals for badge display
const seriesTotals = computed(() => {
  const map = new Map<string, number>()
  for (const a of appointments.value) {
    if (a.series_id) {
      map.set(a.series_id, (map.get(a.series_id) ?? 0) + 1)
    }
  }
  return map
})

function getSeriesTotal(seriesId: string): number {
  return seriesTotals.value.get(seriesId) ?? 0
}

// Data loading — only appointments on page load
async function loadAppointments() {
  if (!profile.value) return
  isLoading.value = true

  try {
    appointments.value = await appointmentService(supabase).list(profile.value.clinic_id)
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : 'Failed to load appointments'
    toast.error(message)
  } finally {
    isLoading.value = false
  }
}

// Patients + therapists loaded lazily (for booking dialog + calendar colors)
let dropdownsLoaded = false

async function loadDropdowns() {
  if (dropdownsLoaded || !profile.value) return
  dropdownsLoaded = true
  const clinicId = profile.value.clinic_id

  try {
    const [patientData, staffData] = await Promise.all([
      patientService(supabase).listForDropdown(clinicId),
      staffService(supabase).listActive(clinicId),
    ])

    patients.value = patientData
    therapists.value = staffData
  } catch {
    dropdownsLoaded = false
  }
}

const filteredAppointments = computed(() => {
  if (listFilter.value === 'today') {
    const today = new Date().toLocaleDateString('en-CA')
    return appointments.value.filter(
      (a) => new Date(a.start_time).toLocaleDateString('en-CA') === today,
    )
  }
  return appointments.value
})

// Create appointment (single or series)
async function createAppointment() {
  if (!profile.value || !newAppointment.value.patient_id) return
  isSubmitting.value = true

  try {
    const service = appointmentService(supabase)

    if (bookingMode.value === 'single') {
      const startDateTime = `${newAppointment.value.date}T${newAppointment.value.start_time}:00`
      const endDate = new Date(startDateTime)
      endDate.setMinutes(endDate.getMinutes() + parseInt(newAppointment.value.duration))

      await service.create({
        clinic_id: profile.value.clinic_id,
        patient_id: newAppointment.value.patient_id,
        therapist_id: newAppointment.value.therapist_id || null,
        start_time: new Date(startDateTime).toISOString(),
        end_time: endDate.toISOString(),
        notes: newAppointment.value.notes || null,
      })

      toast.success('Appointment booked')
    } else {
      const seriesId = crypto.randomUUID()
      const durationMin = parseInt(newAppointment.value.duration)

      const rows = seriesDates.value.map((dateStr, index) => {
        const startDateTime = `${dateStr}T${newAppointment.value.start_time}:00`
        const endDate = new Date(startDateTime)
        endDate.setMinutes(endDate.getMinutes() + durationMin)

        return {
          clinic_id: profile.value!.clinic_id,
          patient_id: newAppointment.value.patient_id,
          therapist_id: newAppointment.value.therapist_id || null,
          start_time: new Date(startDateTime).toISOString(),
          end_time: endDate.toISOString(),
          notes: newAppointment.value.notes || null,
          series_id: seriesId,
          series_index: index + 1,
        }
      })

      await service.createSeries(rows)
      toast.success(`${rows.length} appointments booked`)
    }

    await loadAppointments()
    resetForm()
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : 'Failed to book appointment'
    toast.error(message)
  } finally {
    isSubmitting.value = false
  }
}

function resetForm() {
  showNewDialog.value = false
  bookingMode.value = 'single'
  seriesConfig.value = { days: [], totalSessions: 10 }
  conflicts.value = new Set()
  newAppointment.value = {
    patient_id: '',
    therapist_id: '',
    date: new Date().toISOString().split('T')[0],
    start_time: '09:00',
    duration: '30',
    notes: '',
  }
}

// Status updates
const isUpdatingStatus = ref(false)

async function updateStatus(id: string, status: AppointmentStatus) {
  isUpdatingStatus.value = true

  try {
    await appointmentService(supabase).updateStatus(id, status)
    toast.success(`Appointment marked as ${APPOINTMENT_STATUS_LABELS[status]}`)
    showDetailSheet.value = false
    await loadAppointments()
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : 'Failed to update status'
    toast.error(message)
  } finally {
    isUpdatingStatus.value = false
  }
}

const isCancellingSeries = ref(false)

async function cancelRemainingSeries(seriesId: string) {
  isCancellingSeries.value = true

  try {
    await appointmentService(supabase).cancelSeries(seriesId)
    toast.success('Remaining appointments in series cancelled')
    await loadAppointments()
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : 'Failed to cancel series'
    toast.error(message)
  } finally {
    isCancellingSeries.value = false
  }
}

// Load dropdowns when switching to calendar views
watch(viewMode, (mode) => {
  if (mode !== 'list') loadDropdowns()
})

onMounted(async () => {
  await loadAppointments()
  if (route.query.action === 'new') openBookingDialog()
})
</script>
