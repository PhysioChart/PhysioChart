<template>
  <div class="space-y-6">
    <div v-if="isLoading" class="space-y-4">
      <Skeleton class="h-8 w-48" />
      <Skeleton class="h-64 w-full" />
    </div>

    <template v-else-if="patient">
      <!-- Header -->
      <div class="flex items-center justify-between">
        <div class="flex items-center gap-3">
          <Button variant="ghost" size="icon" @click="navigateTo('/patients')">
            <ArrowLeft class="h-4 w-4" />
          </Button>
          <div>
            <h1 class="text-2xl font-bold tracking-tight">{{ patient.full_name }}</h1>
            <p class="text-muted-foreground text-sm">
              Patient since {{ formatDateLong(patient.created_at) }}
            </p>
          </div>
        </div>
        <div class="flex gap-2">
          <Button variant="outline" @click="startEdit">
            <Pencil class="mr-2 h-4 w-4" />
            Edit
          </Button>
          <Button
            variant="outline"
            class="text-destructive"
            :disabled="isArchiving"
            @click="archivePatient"
          >
            <Archive class="mr-2 h-4 w-4" />
            {{ isArchiving ? 'Archiving...' : 'Archive' }}
          </Button>
        </div>
      </div>

      <Tabs default-value="overview">
        <TabsList>
          <TabsTrigger value="overview">Overview</TabsTrigger>
          <TabsTrigger value="appointments">Appointments</TabsTrigger>
          <TabsTrigger value="treatments">Treatments</TabsTrigger>
          <TabsTrigger value="billing">Billing</TabsTrigger>
        </TabsList>

        <TabsContent value="overview" class="space-y-4">
          <!-- Edit Dialog -->
          <Dialog v-model:open="isEditing">
            <DialogContent class="max-h-[90vh] overflow-y-auto sm:max-w-lg">
              <DialogHeader>
                <DialogTitle>Edit Patient</DialogTitle>
              </DialogHeader>
              <form class="space-y-4" @submit.prevent="saveEdit">
                <div class="grid gap-4 sm:grid-cols-2">
                  <div class="sm:col-span-2">
                    <Label>Full Name</Label>
                    <Input v-model="editForm.full_name" />
                  </div>
                  <div>
                    <Label>Phone</Label>
                    <Input v-model="editForm.phone" />
                  </div>
                  <div>
                    <Label>Email</Label>
                    <Input v-model="editForm.email" type="email" />
                  </div>
                  <div>
                    <Label>Date of Birth</Label>
                    <Input v-model="editForm.date_of_birth" type="date" />
                  </div>
                  <div>
                    <Label>Gender</Label>
                    <Select v-model="editForm.gender">
                      <SelectTrigger>
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem :value="Gender.MALE">{{
                          GENDER_LABELS[Gender.MALE]
                        }}</SelectItem>
                        <SelectItem :value="Gender.FEMALE">{{
                          GENDER_LABELS[Gender.FEMALE]
                        }}</SelectItem>
                        <SelectItem :value="Gender.OTHER">{{
                          GENDER_LABELS[Gender.OTHER]
                        }}</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                  <div class="sm:col-span-2">
                    <Label>Address</Label>
                    <Textarea v-model="editForm.address" rows="2" />
                  </div>
                  <div>
                    <Label>Emergency Contact Name</Label>
                    <Input v-model="editForm.emergency_contact_name" />
                  </div>
                  <div>
                    <Label>Emergency Contact Phone</Label>
                    <Input v-model="editForm.emergency_contact_phone" />
                  </div>
                  <div class="sm:col-span-2">
                    <Label>Notes</Label>
                    <Textarea v-model="editForm.notes" rows="2" />
                  </div>
                </div>
                <DialogFooter>
                  <Button type="button" variant="outline" @click="isEditing = false">Cancel</Button>
                  <Button type="submit" :disabled="isSaving">
                    {{ isSaving ? 'Saving...' : 'Save Changes' }}
                  </Button>
                </DialogFooter>
              </form>
            </DialogContent>
          </Dialog>

          <!-- Contact Info -->
          <Card>
            <CardHeader>
              <CardTitle class="text-base">Contact Information</CardTitle>
            </CardHeader>
            <CardContent>
              <dl class="grid gap-3 sm:grid-cols-2">
                <div class="flex items-center gap-2">
                  <Phone class="text-muted-foreground h-4 w-4" />
                  <div>
                    <dt class="text-muted-foreground text-xs">Phone</dt>
                    <dd class="text-sm font-medium">{{ patient.phone }}</dd>
                  </div>
                </div>
                <div class="flex items-center gap-2">
                  <Mail class="text-muted-foreground h-4 w-4" />
                  <div>
                    <dt class="text-muted-foreground text-xs">Email</dt>
                    <dd class="text-sm font-medium">{{ patient.email ?? '—' }}</dd>
                  </div>
                </div>
                <div class="flex items-center gap-2">
                  <Calendar class="text-muted-foreground h-4 w-4" />
                  <div>
                    <dt class="text-muted-foreground text-xs">Date of Birth</dt>
                    <dd class="text-sm font-medium">{{ formatDateLong(patient.date_of_birth) }}</dd>
                  </div>
                </div>
                <div class="flex items-center gap-2">
                  <User class="text-muted-foreground h-4 w-4" />
                  <div>
                    <dt class="text-muted-foreground text-xs">Gender</dt>
                    <dd class="text-sm font-medium">
                      {{ patient.gender ? GENDER_LABELS[patient.gender] : '—' }}
                    </dd>
                  </div>
                </div>
                <div class="flex items-center gap-2 sm:col-span-2">
                  <MapPin class="text-muted-foreground h-4 w-4" />
                  <div>
                    <dt class="text-muted-foreground text-xs">Address</dt>
                    <dd class="text-sm font-medium">{{ patient.address ?? '—' }}</dd>
                  </div>
                </div>
              </dl>
            </CardContent>
          </Card>

          <!-- Emergency Contact -->
          <Card v-if="patient.emergency_contact_name || patient.emergency_contact_phone">
            <CardHeader>
              <CardTitle class="flex items-center gap-2 text-base">
                <AlertCircle class="text-destructive h-4 w-4" />
                Emergency Contact
              </CardTitle>
            </CardHeader>
            <CardContent>
              <dl class="grid gap-3 sm:grid-cols-2">
                <div>
                  <dt class="text-muted-foreground text-xs">Name</dt>
                  <dd class="text-sm font-medium">{{ patient.emergency_contact_name ?? '—' }}</dd>
                </div>
                <div>
                  <dt class="text-muted-foreground text-xs">Phone</dt>
                  <dd class="text-sm font-medium">{{ patient.emergency_contact_phone ?? '—' }}</dd>
                </div>
              </dl>
            </CardContent>
          </Card>

          <!-- Medical History -->
          <Card>
            <CardHeader>
              <CardTitle class="text-base">Medical History</CardTitle>
            </CardHeader>
            <CardContent>
              <dl class="space-y-3">
                <div v-if="medicalHistory.allergies?.length">
                  <dt class="text-muted-foreground text-xs">Allergies</dt>
                  <dd class="mt-1 flex flex-wrap gap-1">
                    <Badge v-for="a in medicalHistory.allergies" :key="a" variant="destructive">
                      {{ a }}
                    </Badge>
                  </dd>
                </div>
                <div v-if="medicalHistory.current_medications?.length">
                  <dt class="text-muted-foreground text-xs">Current Medications</dt>
                  <dd class="mt-1 flex flex-wrap gap-1">
                    <Badge
                      v-for="m in medicalHistory.current_medications"
                      :key="m"
                      variant="secondary"
                    >
                      {{ m }}
                    </Badge>
                  </dd>
                </div>
                <div v-if="medicalHistory.past_surgeries?.length">
                  <dt class="text-muted-foreground text-xs">Past Surgeries</dt>
                  <dd class="mt-1 flex flex-wrap gap-1">
                    <Badge v-for="s in medicalHistory.past_surgeries" :key="s" variant="outline">
                      {{ s }}
                    </Badge>
                  </dd>
                </div>
                <div v-if="medicalHistory.conditions?.length">
                  <dt class="text-muted-foreground text-xs">Conditions</dt>
                  <dd class="mt-1 flex flex-wrap gap-1">
                    <Badge v-for="c in medicalHistory.conditions" :key="c" variant="outline">
                      {{ c }}
                    </Badge>
                  </dd>
                </div>
                <div v-if="medicalHistory.notes">
                  <dt class="text-muted-foreground text-xs">Notes</dt>
                  <dd class="mt-1 text-sm">{{ medicalHistory.notes }}</dd>
                </div>
                <p
                  v-if="
                    !medicalHistory.allergies?.length &&
                    !medicalHistory.current_medications?.length &&
                    !medicalHistory.past_surgeries?.length &&
                    !medicalHistory.conditions?.length &&
                    !medicalHistory.notes
                  "
                  class="text-muted-foreground text-sm"
                >
                  No medical history recorded
                </p>
              </dl>
            </CardContent>
          </Card>

          <!-- Patient Notes -->
          <Card v-if="patient.notes">
            <CardHeader>
              <CardTitle class="text-base">Notes</CardTitle>
            </CardHeader>
            <CardContent>
              <p class="text-sm">{{ patient.notes }}</p>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="appointments">
          <Card v-if="isLoadingAppointments">
            <CardContent class="space-y-3 p-6">
              <Skeleton v-for="i in 3" :key="i" class="h-24 w-full" />
            </CardContent>
          </Card>

          <Card v-else-if="appointments.length === 0">
            <CardContent class="flex flex-col items-center justify-center py-12 text-center">
              <Calendar class="text-muted-foreground/50 mb-3 h-10 w-10" />
              <p class="text-muted-foreground text-sm">No appointments for this patient yet</p>
              <Button
                variant="outline"
                class="mt-3"
                @click="navigateTo('/appointments?action=new')"
              >
                Book an appointment
              </Button>
            </CardContent>
          </Card>

          <div v-else class="space-y-6">
            <div class="space-y-3">
              <div class="flex items-center justify-between">
                <p class="text-muted-foreground text-sm font-medium">Upcoming</p>
                <Button
                  size="sm"
                  variant="outline"
                  @click="navigateTo('/appointments?action=new&patientId=' + patient?.id)"
                >
                  + Book
                </Button>
              </div>

              <p v-if="upcomingAppointments.length === 0" class="text-muted-foreground text-sm">
                No upcoming appointments
              </p>

              <Card v-for="appt in upcomingAppointments" v-else :key="appt.id">
                <CardContent class="space-y-2 p-4">
                  <div class="flex items-start justify-between gap-3">
                    <div>
                      <p class="font-medium">{{ formatDateLong(appt.start_time) }}</p>
                      <p class="text-muted-foreground text-sm">
                        {{ formatTime(appt.start_time) }} - {{ formatTime(appt.end_time) }}
                      </p>
                    </div>
                    <Badge :class="getAppointmentStatusBadgeClass(appt.status)" variant="secondary">
                      {{ APPOINTMENT_STATUS_LABELS[appt.status] }}
                    </Badge>
                  </div>

                  <p class="text-muted-foreground text-sm">
                    Therapist: {{ appt.therapist?.full_name ?? 'Unassigned' }}
                  </p>

                  <p v-if="appt.treatment_plan" class="text-muted-foreground text-sm">
                    Plan: {{ appt.treatment_plan.name }} ({{
                      appt.treatment_plan.completed_sessions
                    }}/{{ appt.treatment_plan.total_sessions }} sessions)
                  </p>

                  <p v-if="appt.notes" class="text-sm">{{ appt.notes }}</p>
                </CardContent>
              </Card>
            </div>

            <div v-if="pastAppointments.length > 0" class="space-y-3">
              <p class="text-muted-foreground text-sm font-medium">Past</p>

              <Card v-for="appt in visiblePastAppointments" :key="appt.id">
                <CardContent class="space-y-2 p-4">
                  <div class="flex items-start justify-between gap-3">
                    <div>
                      <p class="font-medium">{{ formatDateLong(appt.start_time) }}</p>
                      <p class="text-muted-foreground text-sm">
                        {{ formatTime(appt.start_time) }} - {{ formatTime(appt.end_time) }}
                      </p>
                    </div>
                    <Badge :class="getAppointmentStatusBadgeClass(appt.status)" variant="secondary">
                      {{ APPOINTMENT_STATUS_LABELS[appt.status] }}
                    </Badge>
                  </div>

                  <p class="text-muted-foreground text-sm">
                    Therapist: {{ appt.therapist?.full_name ?? 'Unassigned' }}
                  </p>

                  <p v-if="appt.treatment_plan" class="text-muted-foreground text-sm">
                    Plan: {{ appt.treatment_plan.name }} ({{
                      appt.treatment_plan.completed_sessions
                    }}/{{ appt.treatment_plan.total_sessions }} sessions)
                  </p>

                  <p v-if="appt.notes" class="text-sm">{{ appt.notes }}</p>
                </CardContent>
              </Card>

              <Button
                v-if="pastAppointments.length > 10 && !showAllPast"
                variant="ghost"
                class="text-muted-foreground h-auto px-0 py-1 text-sm"
                @click="showAllPast = true"
              >
                Show {{ remainingPastCount }} more
              </Button>
            </div>
          </div>
        </TabsContent>

        <TabsContent value="treatments">
          <Card>
            <CardContent class="flex flex-col items-center justify-center py-12 text-center">
              <ClipboardList class="text-muted-foreground/50 mb-3 h-10 w-10" />
              <p class="text-muted-foreground text-sm">No treatment plans for this patient yet</p>
              <Button variant="outline" class="mt-3" @click="navigateTo('/treatments?action=new')">
                Create a treatment plan
              </Button>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="billing">
          <Card>
            <CardContent class="flex flex-col items-center justify-center py-12 text-center">
              <Receipt class="text-muted-foreground/50 mb-3 h-10 w-10" />
              <p class="text-muted-foreground text-sm">No invoices for this patient yet</p>
              <Button variant="outline" class="mt-3" @click="navigateTo('/billing?action=new')">
                Create an invoice
              </Button>
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </template>
  </div>
</template>

<script setup lang="ts">
import {
  ArrowLeft,
  Phone,
  Mail,
  MapPin,
  Calendar,
  AlertCircle,
  User,
  Pencil,
  Archive,
  ClipboardList,
  Receipt,
} from 'lucide-vue-next'
import { toast } from 'vue-sonner'
import type { Tables, MedicalHistory } from '~/types/database'
import type { IAppointmentWithRelations } from '~/types/models/appointment.types'
import { APPOINTMENT_STATUS_LABELS } from '~/enums/appointment.enum'
import { Gender, GENDER_LABELS } from '~/enums/gender.enum'
import { appointmentService } from '~/services/appointment.service'
import { patientService } from '~/services/patient.service'
import { formatDateLong, formatTime } from '~/lib/formatters'

const route = useRoute()
const supabase = useSupabase()
const { profile: _profile } = useAuth()

const patient = ref<Tables<'patients'> | null>(null)
const appointments = ref<IAppointmentWithRelations[]>([])
const isLoading = ref(true)
const isLoadingAppointments = ref(false)
const showAllPast = ref(false)
const isEditing = ref(false)
const editForm = ref({
  full_name: '',
  phone: '',
  email: '',
  date_of_birth: '',
  gender: '' as string,
  address: '',
  emergency_contact_name: '',
  emergency_contact_phone: '',
  notes: '',
})

async function loadPatient() {
  isLoading.value = true

  try {
    const data = await patientService(supabase).getById(route.params.id as string)
    if (!data) {
      toast.error('Patient not found')
      navigateTo('/patients')
      return
    }
    patient.value = data
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : 'Failed to load patient'
    toast.error(message)
    navigateTo('/patients')
  } finally {
    isLoading.value = false
  }
}

async function loadAppointments() {
  isLoadingAppointments.value = true
  showAllPast.value = false

  try {
    appointments.value = await appointmentService(supabase).getByPatientId(
      route.params.id as string,
    )
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : 'Failed to load appointments'
    toast.error(message)
  } finally {
    isLoadingAppointments.value = false
  }
}

const todayDateKey = computed(() => new Date().toLocaleDateString('en-CA'))

const upcomingAppointments = computed(() => {
  return appointments.value
    .filter((appt) => {
      const apptDateKey = new Date(appt.start_time).toLocaleDateString('en-CA')
      return appt.status === 'scheduled' && apptDateKey >= todayDateKey.value
    })
    .slice()
    .sort((a, b) => new Date(a.start_time).getTime() - new Date(b.start_time).getTime())
})

const pastAppointments = computed(() => {
  return appointments.value
    .filter((appt) => {
      const apptDateKey = new Date(appt.start_time).toLocaleDateString('en-CA')
      return appt.status !== 'scheduled' || apptDateKey < todayDateKey.value
    })
    .slice()
    .sort((a, b) => new Date(b.start_time).getTime() - new Date(a.start_time).getTime())
})

const visiblePastAppointments = computed(() => {
  return showAllPast.value ? pastAppointments.value : pastAppointments.value.slice(0, 10)
})

const remainingPastCount = computed(() => Math.max(0, pastAppointments.value.length - 10))

function getAppointmentStatusBadgeClass(status: string): string {
  const base = 'rounded-full px-2.5 py-0.5 text-xs font-medium'

  switch (status) {
    case 'scheduled':
      return `${base} bg-yellow-100 text-yellow-800`
    case 'completed':
      return `${base} bg-green-100 text-green-800`
    case 'cancelled':
      return `${base} bg-gray-100 text-gray-800`
    case 'no_show':
      return `${base} bg-red-100 text-red-800`
    default:
      return `${base} bg-gray-100 text-gray-800`
  }
}

function startEdit() {
  if (!patient.value) return
  editForm.value = {
    full_name: patient.value.full_name,
    phone: patient.value.phone,
    email: patient.value.email ?? '',
    date_of_birth: patient.value.date_of_birth ?? '',
    gender: patient.value.gender ?? '',
    address: patient.value.address ?? '',
    emergency_contact_name: patient.value.emergency_contact_name ?? '',
    emergency_contact_phone: patient.value.emergency_contact_phone ?? '',
    notes: patient.value.notes ?? '',
  }
  isEditing.value = true
}

const isSaving = ref(false)

async function saveEdit() {
  if (!patient.value || !editForm.value.full_name) return
  isSaving.value = true

  try {
    await patientService(supabase).update(patient.value.id, {
      full_name: editForm.value.full_name,
      phone: editForm.value.phone,
      email: editForm.value.email || null,
      date_of_birth: editForm.value.date_of_birth || null,
      gender: (editForm.value.gender as Gender) || null,
      address: editForm.value.address || null,
      emergency_contact_name: editForm.value.emergency_contact_name || null,
      emergency_contact_phone: editForm.value.emergency_contact_phone || null,
      notes: editForm.value.notes || null,
    })

    toast.success('Patient updated')
    await loadPatient()
    isEditing.value = false
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : 'Failed to update patient'
    toast.error(message)
  } finally {
    isSaving.value = false
  }
}

const isArchiving = ref(false)

async function archivePatient() {
  if (!patient.value) return
  isArchiving.value = true

  try {
    await patientService(supabase).archive(patient.value.id)
    toast.success('Patient archived')
    navigateTo('/patients')
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : 'Failed to archive patient'
    toast.error(message)
  } finally {
    isArchiving.value = false
  }
}

const medicalHistory = computed(() => {
  return (patient.value?.medical_history as MedicalHistory) ?? {}
})

onMounted(() => {
  void loadPatient()
  void loadAppointments()
})
</script>
