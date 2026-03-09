<template>
  <div class="space-y-4">
    <AppointmentsHeader @open-booking="openBookingDialog" />

    <AppointmentsBookingDialog
      ref="bookingDialogRef"
      :open="showBookingDialog"
      :patients="patients"
      :therapists="therapists"
      :initial-patient-id="initialPatientId"
      :initial-therapist-id="initialTherapistId"
      :initial-treatment-plan-id="initialTreatmentPlanId"
      :initial-date="initialDate"
      :initial-start-time="initialStartTime"
      :initial-linked-context="initialLinkedContext"
      @update:open="showBookingDialog = $event"
      @submit="handleBookAppointment"
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
      :clinic-name="clinic?.name ?? null"
      :get-series-total="getSeriesTotal"
      :can-reopen-appointment="canReopenAppointment"
      @open-booking="openBookingDialog"
      @request-complete="openCompleteDialog"
      @request-reopen="handleReopenAppointment"
      @update-status="handleUpdateStatus"
      @cancel-series="handleCancelSeries"
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

    <ClientOnly>
      <AppointmentDetailSheet
        v-model:open="showDetailSheet"
        :appointment="selectedAppointment"
        :clinic-name="clinic?.name ?? null"
        :can-reopen="selectedAppointment ? canReopenAppointment(selectedAppointment) : false"
        @request-complete="openCompleteDialog"
        @request-reopen="handleReopenAppointment"
        @update-status="handleUpdateStatus"
      />

      <AppointmentCompleteDialog
        v-if="completeTargetAppointment"
        ref="completeDialogRef"
        :open="showCompleteDialog"
        :appointment="completeTargetAppointment"
        @update:open="showCompleteDialog = $event"
        @submit="handleCompleteAppointment"
      />
    </ClientOnly>
  </div>
</template>

<script setup lang="ts">
import { storeToRefs } from 'pinia'
import { toast } from 'vue-sonner'
import { APPOINTMENT_STATUS_LABELS, type AppointmentStatus } from '~/enums/appointment.enum'
import { AppointmentErrorCode } from '~/enums/appointment-error.enum'
import { TreatmentStatus } from '~/enums/treatment.enum'
import { appointmentService } from '~/services/appointment.service'
import { AppointmentConflictError } from '~/lib/errors/appointment-conflict.error'
import { getAppointmentErrorMessage } from '~/lib/error-messages'
import type { IAppointmentWithRelations } from '~/types/models/appointment.types'
import type {
  IBookAppointmentPayload,
  ICompleteAppointmentPayload,
} from '~/features/appointments/types'
import { useTreatmentsStore } from '~/stores/treatments.store'
import AppointmentDetailSheet from '~/features/appointments/components/AppointmentDetailSheet.vue'
import AppointmentCompleteDialog from '~/features/appointments/components/AppointmentCompleteDialog.vue'
import AppointmentsBookingDialog from '~/features/appointments/components/AppointmentsBookingDialog.vue'
import AppointmentsCalendarPanel from '~/features/appointments/components/AppointmentsCalendarPanel.vue'
import AppointmentsHeader from '~/features/appointments/components/AppointmentsHeader.vue'
import AppointmentsListView from '~/features/appointments/components/AppointmentsListView.vue'
import AppointmentsTherapistLegend from '~/features/appointments/components/AppointmentsTherapistLegend.vue'
import AppointmentsViewControls from '~/features/appointments/components/AppointmentsViewControls.vue'
import { useAppointmentsPageStore } from '~/features/appointments/store/appointmentsPage.store'

definePageMeta({ layout: 'protected' })

const route = useRoute()
const router = useRouter()
const supabase = useSupabaseClient()
const { clinic, activeMembership } = useAuth()
const treatmentsStore = useTreatmentsStore()
const store = useAppointmentsPageStore()

const {
  isLoading,
  viewMode,
  listFilter,
  showDetailSheet,
  selectedAppointment,
  weekDays,
  currentDay,
  dayViewLabel,
  weekViewLabel,
  patients,
  therapists,
  appointments,
  therapistColorMap,
  therapistLegend,
  filteredAppointments,
} = storeToRefs(store)

const {
  goToToday,
  goToPrevDay,
  goToNextDay,
  goToPrevWeek,
  goToNextWeek,
  loadAppointments,
  loadDropdowns,
  getSeriesTotal,
  handleAppointmentClick,
  canReopenAppointment,
} = store

// --- Page-Owned Dialog State ---

const showBookingDialog = ref(false)
const showCompleteDialog = ref(false)
const completeTargetAppointment = ref<IAppointmentWithRelations | null>(null)

const bookingDialogRef = ref<InstanceType<typeof AppointmentsBookingDialog> | null>(null)
const completeDialogRef = ref<InstanceType<typeof AppointmentCompleteDialog> | null>(null)

// Deep-link initial state
const initialPatientId = ref<string | null>(null)
const initialTherapistId = ref<string | null>(null)
const initialTreatmentPlanId = ref<string | null>(null)
const initialDate = ref<string | null>(null)
const initialStartTime = ref<string | null>(null)
const initialLinkedContext = ref<{
  patientId: string
  treatmentPlanId: string
  treatmentName: string
} | null>(null)

// --- Dialog Openers ---

function openBookingDialog() {
  void loadDropdowns()
  showBookingDialog.value = true
}

function handleSlotClick(date: string, time: string) {
  initialDate.value = date
  initialStartTime.value = time
  openBookingDialog()
  // Clear after next tick so dialog picks them up
  nextTick(() => {
    initialDate.value = null
    initialStartTime.value = null
  })
}

function openCompleteDialog(appt: IAppointmentWithRelations) {
  completeTargetAppointment.value = appt
  showCompleteDialog.value = true
}

// --- Write Orchestration ---

async function handleBookAppointment(payload: IBookAppointmentPayload) {
  if (!activeMembership.value?.clinic_id) return

  try {
    const service = appointmentService(supabase)

    if (payload.mode === 'single') {
      if (payload.treatmentPlanId) {
        const result = await service.createTreatmentLinkedAppointment({
          clinicId: activeMembership.value.clinic_id,
          treatmentPlanId: payload.treatmentPlanId,
          therapistId: payload.therapistId,
          startTime: payload.startTime!,
          endTime: payload.endTime!,
          notes: payload.notes,
          idempotencyKey: payload.linkedIdempotencyKey!,
        })

        if (result.alreadyCreated) {
          toast.info('Appointment already booked for this request')
        } else {
          toast.success('Appointment booked')
        }
      } else {
        const result = await service.createSingle({
          clinicId: activeMembership.value.clinic_id,
          patientId: payload.patientId,
          therapistId: payload.therapistId,
          treatmentPlanId: null,
          startTime: payload.startTime!,
          endTime: payload.endTime!,
          notes: payload.notes,
          idempotencyKey: payload.singleIdempotencyKey!,
        })

        if (result.alreadyCreated) {
          toast.info('Appointment already booked for this request')
        } else {
          toast.success('Appointment booked')
        }
      }
    } else {
      await service.createSeries({
        clinicId: activeMembership.value.clinic_id,
        patientId: payload.patientId,
        therapistId: payload.therapistId,
        treatmentPlanId: payload.treatmentPlanId,
        notes: payload.notes,
        occurrences: payload.occurrences!,
        idempotencyKey: payload.seriesIdempotencyKey!,
      })
      toast.success(`${payload.occurrences!.length} appointments booked`)
    }

    await loadAppointments()
    showBookingDialog.value = false
  } catch (err: unknown) {
    if (err instanceof AppointmentConflictError) {
      if (err.conflict) {
        const start = new Date(err.conflict.conflictingStartTime).toLocaleTimeString('en-IN', {
          hour: '2-digit',
          minute: '2-digit',
          hour12: true,
        })
        const end = new Date(err.conflict.conflictingEndTime).toLocaleTimeString('en-IN', {
          hour: '2-digit',
          minute: '2-digit',
          hour12: true,
        })
        toast.error(`This doctor is booked from ${start} to ${end}`)
      } else if (err.conflicts && err.conflicts.length > 0) {
        const first = err.conflicts[0]
        if (!first) {
          toast.error(err.message)
          return
        }
        const start = new Date(first.occurrenceStartTime).toLocaleString('en-IN', {
          day: 'numeric',
          month: 'short',
          hour: '2-digit',
          minute: '2-digit',
          hour12: true,
        })
        toast.error(`Series conflict at ${start}. Resolve conflicts and retry.`)
      } else {
        toast.error(err.message)
      }
    } else {
      const message = err instanceof Error ? err.message : 'Failed to book appointment'
      toast.error(getAppointmentErrorMessage(message))
    }
  } finally {
    bookingDialogRef.value?.markSubmitted()
  }
}

async function handleCompleteAppointment(payload: ICompleteAppointmentPayload) {
  if (!activeMembership.value?.clinic_id || !completeTargetAppointment.value) return

  try {
    const result = await appointmentService(supabase).completeWithSessionNote(
      activeMembership.value.clinic_id,
      payload.appointmentId,
      payload.note,
    )

    const patientId = completeTargetAppointment.value.patient_id
    const treatmentPlanId = completeTargetAppointment.value.treatment_plan_id

    if (result.message === AppointmentErrorCode.ALREADY_COMPLETED) {
      toast.info('Appointment already completed')
    } else {
      const invoiceQuery = treatmentPlanId
        ? `/billing?action=new&patientId=${patientId}&treatmentPlanId=${treatmentPlanId}`
        : `/billing?action=new&patientId=${patientId}`

      toast.success(
        payload.note ? 'Appointment completed. Session note saved.' : 'Appointment completed.',
        {
          action: {
            label: 'Create Invoice',
            onClick: () => navigateTo(invoiceQuery),
          },
        },
      )
    }

    if (result.planCompleted) {
      toast.success('Treatment plan completed')
    }

    if (completeTargetAppointment.value.treatment_plan?.id) {
      treatmentsStore.invalidate(activeMembership.value.clinic_id)
    }

    await loadAppointments()
    showCompleteDialog.value = false
    completeTargetAppointment.value = null
    showDetailSheet.value = false
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : 'Failed to complete appointment'
    toast.error(getAppointmentErrorMessage(message))
  } finally {
    completeDialogRef.value?.markSubmitted()
  }
}

async function handleReopenAppointment(appointmentId: string) {
  if (!activeMembership.value?.clinic_id) return

  try {
    const result = await appointmentService(supabase).reopenCompletedAppointment(
      activeMembership.value.clinic_id,
      appointmentId,
    )
    toast.success(
      result.sessionVoided
        ? 'Appointment reopened.'
        : 'Appointment reopened (no active session was found).',
    )
    await loadAppointments()
    showDetailSheet.value = false
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : 'Failed to reopen appointment'
    toast.error(getAppointmentErrorMessage(message))
  }
}

async function handleUpdateStatus(id: string, status: AppointmentStatus) {
  if (!activeMembership.value?.clinic_id) return

  try {
    await appointmentService(supabase).updateStatus(activeMembership.value.clinic_id, id, status)
    toast.success(`Appointment marked as ${APPOINTMENT_STATUS_LABELS[status]}`)
    showDetailSheet.value = false
    await loadAppointments()
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : 'Failed to update status'
    toast.error(message)
  }
}

async function handleCancelSeries(seriesId: string) {
  if (!activeMembership.value?.clinic_id) return

  try {
    await appointmentService(supabase).cancelSeries(activeMembership.value.clinic_id, seriesId)
    toast.success('Remaining appointments in series cancelled')
    await loadAppointments()
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : 'Failed to cancel series'
    toast.error(message)
  }
}

// --- Helpers ---

function toSingleQueryValue(value: string | null | (string | null)[] | undefined): string | null {
  if (Array.isArray(value)) return value[0] ?? null
  return typeof value === 'string' && value ? value : null
}

// --- Deep-link Init ---

onMounted(async () => {
  await loadAppointments()
  await loadDropdowns()

  const patientIdParam = toSingleQueryValue(route.query.patientId)
  const treatmentPlanIdParam = toSingleQueryValue(route.query.treatmentPlanId)

  if (patientIdParam && patients.value.some((p) => p.id === patientIdParam)) {
    initialPatientId.value = patientIdParam
  }

  if (activeMembership.value?.clinic_id && patientIdParam && treatmentPlanIdParam) {
    try {
      await treatmentsStore.fetchByPatient(activeMembership.value.clinic_id, patientIdParam)
      const treatmentsByPatient =
        treatmentsStore.byPatientByClinic[activeMembership.value.clinic_id]?.[patientIdParam] ?? []
      const linkedPlan =
        treatmentsByPatient.find(
          (plan) => plan.id === treatmentPlanIdParam && plan.status === TreatmentStatus.ACTIVE,
        ) ?? null

      if (linkedPlan) {
        initialPatientId.value = linkedPlan.patient_id
        initialTreatmentPlanId.value = linkedPlan.id
        if (linkedPlan.therapist_id) {
          initialTherapistId.value = linkedPlan.therapist_id
        }
        initialLinkedContext.value = {
          patientId: linkedPlan.patient_id,
          treatmentPlanId: linkedPlan.id,
          treatmentName: linkedPlan.name,
        }
      } else {
        toast.error('Linked treatment plan is unavailable. Please select another plan.')
      }
    } catch {
      toast.error('Failed to load linked treatment plan.')
    }
  }

  if (route.query.action === 'new') {
    openBookingDialog()
  }

  // Clear one-shot params from URL
  if (route.query.action || route.query.patientId || route.query.treatmentPlanId) {
    const query = { ...route.query }
    delete query.action
    delete query.patientId
    delete query.treatmentPlanId
    void router.replace({ query })
  }
})
</script>
