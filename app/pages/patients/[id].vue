<template>
  <div class="space-y-6">
    <div v-if="isLoading" class="space-y-4">
      <Skeleton class="h-8 w-48" />
      <Skeleton class="h-64 w-full" />
    </div>

    <template v-else-if="patient">
      <PatientDetailHeader
        :patient="patient"
        :is-archiving="isArchiving"
        @back="navigateTo('/patients')"
        @edit="startEdit"
        @archive="archivePatient"
      />

      <PatientEditDialog
        :open="isEditing"
        :is-saving="isSaving"
        :patient="patient"
        :build-edit-form="buildEditForm"
        @update:open="isEditing = $event"
        @save="saveEdit"
      />

      <Tabs v-model="activeTab">
        <TabsList class="w-full justify-start overflow-x-auto">
          <TabsTrigger value="overview">Overview</TabsTrigger>
          <TabsTrigger value="appointments">Appointments</TabsTrigger>
          <TabsTrigger value="treatments">Treatments</TabsTrigger>
          <TabsTrigger value="billing">Billing</TabsTrigger>
        </TabsList>

        <TabsContent value="overview">
          <PatientOverviewTab :patient="patient" :medical-history="medicalHistory" />
        </TabsContent>

        <TabsContent value="appointments">
          <PatientAppointmentsTab
            :patient-id="patient.id"
            :appointments="appointments"
            :upcoming-appointments="upcomingAppointments"
            :past-appointments="pastAppointments"
            :visible-past-appointments="visiblePastAppointments"
            :remaining-past-count="remainingPastCount"
            :show-all-past="showAllPast"
            :is-loading-appointments="isLoadingAppointments"
            :get-appointment-status-badge-class="getAppointmentStatusBadgeClass"
            @show-more-past="showAllPast = true"
          />
        </TabsContent>

        <TabsContent value="treatments">
          <PatientTreatmentsTab
            :patient-id="patient.id"
            :is-loading-treatments="isLoadingTreatments"
            :treatments="treatments"
            :active-treatments="activeTreatments"
            :completed-treatments="completedTreatments"
            :get-treatment-status-badge-class="getTreatmentStatusBadgeClass"
            :treatment-progress="treatmentProgress"
          />
        </TabsContent>

        <TabsContent value="billing">
          <PatientBillingTab
            :patient-id="patient.id"
            :is-loading-invoices="isLoadingInvoices"
            :invoices="invoices"
            :unpaid-pending-invoices="unpaidPendingInvoices"
            :paid-invoices="paidInvoices"
            :get-invoice-status-badge-class="getInvoiceStatusBadgeClass"
          />
        </TabsContent>
      </Tabs>
    </template>
  </div>
</template>

<script setup lang="ts">
import { usePatientDetailPage } from '~/composables/usePatientDetailPage'
import PatientAppointmentsTab from '~/components/patients/PatientAppointmentsTab.vue'
import PatientBillingTab from '~/components/patients/PatientBillingTab.vue'
import PatientDetailHeader from '~/components/patients/PatientDetailHeader.vue'
import PatientEditDialog from '~/components/patients/PatientEditDialog.vue'
import PatientOverviewTab from '~/components/patients/PatientOverviewTab.vue'
import PatientTreatmentsTab from '~/components/patients/PatientTreatmentsTab.vue'

definePageMeta({ layout: 'protected' })

const patientDetailPage = usePatientDetailPage()

await patientDetailPage.initialize()

const {
  patient,
  appointments,
  invoices,
  treatments,
  isLoading,
  isLoadingAppointments,
  isLoadingTreatments,
  isLoadingInvoices,
  activeTab,
  showAllPast,
  isEditing,
  isSaving,
  isArchiving,
  medicalHistory,
  upcomingAppointments,
  pastAppointments,
  visiblePastAppointments,
  remainingPastCount,
  activeTreatments,
  completedTreatments,
  unpaidPendingInvoices,
  paidInvoices,
  getAppointmentStatusBadgeClass,
  getTreatmentStatusBadgeClass,
  getInvoiceStatusBadgeClass,
  treatmentProgress,
  startEdit,
  buildEditForm,
  saveEdit,
  archivePatient,
} = patientDetailPage
</script>
