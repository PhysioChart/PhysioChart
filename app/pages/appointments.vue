<template>
  <div class="space-y-4">
    <AppointmentsHeader @open-booking="openBookingDialog" />

    <AppointmentsBookingDialog
      v-model:open="showBookingDialog"
      v-model:form="newAppointment"
      v-model:booking-mode="bookingMode"
      v-model:series-config="seriesConfig"
      :is-submitting="isSubmitting"
      :patients="patients"
      :therapists="therapists"
      :active-treatment-plans="activeTreatmentPlansForSelectedPatient"
      :can-select-treatment="canSelectTreatment"
      :treatment-select-placeholder="treatmentSelectPlaceholder"
      :no-treatment-plan-value="NO_TREATMENT_PLAN_VALUE"
      :day-names="DAY_NAMES"
      :series-dates="seriesDates"
      :conflicts="conflicts"
      :time-options="timeOptions"
      :is-doctor-selected="isDoctorSelected"
      :has-selected-slot-conflict="hasSelectedSlotConflict"
      :selected-slot-conflict="selectedSlotConflict"
      @submit="createAppointment"
      @cancel="closeBookingDialog"
      @toggle-day="toggleDay"
    />

    <AppointmentsViewControls
      v-model:view-mode="viewMode"
      v-model:list-filter="listFilter"
      :day-view-label="dayViewLabel"
      :week-view-label="weekViewLabel"
      @today="goToToday"
      @prev-day="goToPrevDay"
      @next-day="goToNextDay"
      @prev-week="goToPrevWeek"
      @next-week="goToNextWeek"
    />

    <AppointmentsTherapistLegend v-if="viewMode !== 'list'" :items="therapistLegend" />

    <Card v-if="isLoading">
      <CardContent class="space-y-3 p-6">
        <Skeleton v-for="i in 5" :key="i" class="h-16 w-full" />
      </CardContent>
    </Card>

    <AppointmentsListView
      v-else-if="viewMode === 'list'"
      :appointments="filteredAppointments"
      :list-filter="listFilter"
      :get-series-total="getSeriesTotal"
      @open-booking="openBookingDialog"
      @update-status="updateStatus"
      @cancel-series="cancelRemainingSeries"
    />

    <AppointmentsCalendarPanel
      v-else
      :view-mode="viewMode"
      :appointments="appointments"
      :week-days="weekDays"
      :current-day-date-str="currentDay.dateStr"
      :color-map="therapistColorMap"
      @click-slot="handleSlotClick"
      @click-appointment="handleAppointmentClick"
    />

    <AppointmentDetailSheet
      v-model:open="showDetailSheet"
      :appointment="selectedAppointment"
      @update-status="updateStatus"
    />
  </div>
</template>

<script setup lang="ts">
import { storeToRefs } from 'pinia'
import { useAppointmentsPageStore } from '~/features/appointments/store/appointmentsPage.store'

const route = useRoute()
const appointmentsPageStore = useAppointmentsPageStore()

const {
  NO_TREATMENT_PLAN_VALUE,
  DAY_NAMES,
  isLoading,
  showBookingDialog,
  viewMode,
  listFilter,
  showDetailSheet,
  selectedAppointment,
  newAppointment,
  isSubmitting,
  bookingMode,
  seriesConfig,
  conflicts,
  timeOptions,
  isDoctorSelected,
  hasSelectedSlotConflict,
  selectedSlotConflict,
  weekDays,
  currentDay,
  dayViewLabel,
  weekViewLabel,
  patients,
  therapists,
  appointments,
  therapistColorMap,
  therapistLegend,
  seriesDates,
  filteredAppointments,
  activeTreatmentPlansForSelectedPatient,
  canSelectTreatment,
  treatmentSelectPlaceholder,
} = storeToRefs(appointmentsPageStore)

const {
  goToToday,
  goToPrevDay,
  goToNextDay,
  goToPrevWeek,
  goToNextWeek,
  openBookingDialog,
  closeBookingDialog,
  toggleDay,
  getSeriesTotal,
  handleAppointmentClick,
  handleSlotClick,
  createAppointment,
  updateStatus,
  cancelRemainingSeries,
  initialize,
} = appointmentsPageStore

onMounted(async () => {
  await initialize(route.query as Record<string, unknown>)
})
</script>
