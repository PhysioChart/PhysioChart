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
    <div v-if="viewMode !== 'list' && therapistLegend.length > 0" class="flex flex-wrap gap-3">
      <div v-for="item in therapistLegend" :key="item.id" class="flex items-center gap-1.5 text-xs">
        <span :class="[item.color.bg, item.color.border, 'h-3 w-3 rounded-sm border-l-2']" />
        <span class="text-muted-foreground">{{ item.name }}</span>
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
import { CalendarDays, CalendarPlus, MessageCircle } from 'lucide-vue-next'
import { AppointmentStatus, APPOINTMENT_STATUS_LABELS } from '~/enums/appointment.enum'
import { useAppointmentsPage } from '~/composables/useAppointmentsPage'
import {
  formatTime,
  formatDate,
  formatSeriesDate,
  getStatusColor,
  getWhatsAppLink,
} from '~/lib/formatters'

const {
  appointments,
  isLoading,
  showNewDialog,
  viewMode,
  listFilter,
  patients,
  therapists,
  weekDays,
  currentDay,
  dayViewLabel,
  weekViewLabel,
  goToToday,
  goToPrevDay,
  goToNextDay,
  goToPrevWeek,
  goToNextWeek,
  therapistColorMap,
  therapistLegend,
  showDetailSheet,
  selectedAppointment,
  newAppointment,
  isSubmitting,
  bookingMode,
  seriesConfig,
  DAY_NAMES,
  seriesDates,
  conflicts,
  filteredAppointments,
  handleAppointmentClick,
  handleSlotClick,
  openBookingDialog,
  toggleDay,
  getSeriesTotal,
  createAppointment,
  resetForm,
  updateStatus,
  cancelRemainingSeries,
} = useAppointmentsPage()
</script>
