<script setup lang="ts">
import { CalendarDays, CalendarPlus, MessageCircle } from 'lucide-vue-next'
import { toast } from 'vue-sonner'
import type { Tables } from '~/types/database'

const supabase = useSupabase()
const { profile } = useAuth()
const route = useRoute()

const appointments = ref<
  (Tables<'appointments'> & {
    patient: Tables<'patients'> | null
    therapist: Tables<'profiles'> | null
  })[]
>([])
const patients = ref<Tables<'patients'>[]>([])
const therapists = ref<Tables<'profiles'>[]>([])
const isLoading = ref(true)
const showNewDialog = ref(route.query.action === 'new')
const viewMode = ref<'today' | 'all'>('today')

const newAppointment = ref({
  patient_id: '',
  therapist_id: '',
  date: new Date().toISOString().split('T')[0],
  start_time: '09:00',
  duration: '30',
  notes: '',
})
const isSubmitting = ref(false)

async function loadData() {
  if (!profile.value) return
  isLoading.value = true
  const clinicId = profile.value.clinic_id

  const [apptRes, patientRes, staffRes] = await Promise.all([
    supabase
      .from('appointments')
      .select('*, patient:patients(*), therapist:profiles(*)')
      .eq('clinic_id', clinicId)
      .order('start_time', { ascending: true }),
    supabase
      .from('patients')
      .select('*')
      .eq('clinic_id', clinicId)
      .eq('is_archived', false)
      .order('full_name'),
    supabase
      .from('profiles')
      .select('*')
      .eq('clinic_id', clinicId)
      .eq('is_active', true)
      .order('full_name'),
  ])

  appointments.value = (apptRes.data ?? []) as typeof appointments.value
  patients.value = patientRes.data ?? []
  therapists.value = staffRes.data ?? []
  isLoading.value = false
}

const filteredAppointments = computed(() => {
  if (viewMode.value === 'today') {
    const today = new Date().toISOString().split('T')[0] ?? ''
    return appointments.value.filter((a) => a.start_time.startsWith(today))
  }
  return appointments.value
})

async function createAppointment() {
  if (!profile.value || !newAppointment.value.patient_id) return
  isSubmitting.value = true

  const startDateTime = `${newAppointment.value.date}T${newAppointment.value.start_time}:00`
  const endDate = new Date(startDateTime)
  endDate.setMinutes(endDate.getMinutes() + parseInt(newAppointment.value.duration))

  const { error } = await supabase.from('appointments').insert({
    clinic_id: profile.value.clinic_id,
    patient_id: newAppointment.value.patient_id,
    therapist_id: newAppointment.value.therapist_id || null,
    start_time: new Date(startDateTime).toISOString(),
    end_time: endDate.toISOString(),
    notes: newAppointment.value.notes || null,
  })

  isSubmitting.value = false
  if (error) {
    toast.error('Failed to book appointment')
    return
  }

  toast.success('Appointment booked')
  showNewDialog.value = false
  newAppointment.value = {
    patient_id: '',
    therapist_id: '',
    date: new Date().toISOString().split('T')[0],
    start_time: '09:00',
    duration: '30',
    notes: '',
  }
  await loadData()
}

function formatTime(dateStr: string) {
  return new Date(dateStr).toLocaleTimeString('en-IN', {
    hour: '2-digit',
    minute: '2-digit',
    hour12: true,
  })
}

function formatDate(dateStr: string) {
  return new Date(dateStr).toLocaleDateString('en-IN', {
    day: 'numeric',
    month: 'short',
  })
}

function getStatusColor(status: string) {
  switch (status) {
    case 'completed':
      return 'bg-green-500/10 text-green-700'
    case 'cancelled':
      return 'bg-red-500/10 text-red-700'
    case 'no_show':
      return 'bg-amber-500/10 text-amber-700'
    default:
      return 'bg-blue-500/10 text-blue-700'
  }
}

async function updateStatus(id: string, status: 'completed' | 'cancelled' | 'no_show') {
  const { error } = await supabase.from('appointments').update({ status }).eq('id', id)
  if (error) {
    toast.error('Failed to update status')
    return
  }
  toast.success(`Appointment marked as ${status.replace('_', ' ')}`)
  await loadData()
}

function getWhatsAppLink(patient: Tables<'patients'> | null, startTime: string) {
  if (!patient) return ''
  const phone = patient.phone.replace(/\D/g, '')
  const date = new Date(startTime)
  const dateStr = date.toLocaleDateString('en-IN', { day: 'numeric', month: 'long' })
  const timeStr = date.toLocaleTimeString('en-IN', {
    hour: '2-digit',
    minute: '2-digit',
    hour12: true,
  })
  const msg = encodeURIComponent(
    `Hi ${patient.full_name}, this is a reminder for your appointment on ${dateStr} at ${timeStr}. Please arrive 10 minutes early. Thank you!`,
  )
  return `https://wa.me/${phone}?text=${msg}`
}

onMounted(loadData)
</script>

<template>
  <div class="space-y-4">
    <div class="flex items-center justify-between">
      <div>
        <h1 class="text-2xl font-bold tracking-tight">Appointments</h1>
        <p class="text-muted-foreground text-sm">Manage your clinic's schedule</p>
      </div>
      <Dialog v-model:open="showNewDialog">
        <DialogTrigger as-child>
          <Button>
            <CalendarPlus class="mr-2 h-4 w-4" />
            Book Appointment
          </Button>
        </DialogTrigger>
        <DialogContent class="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Book Appointment</DialogTitle>
            <DialogDescription>Schedule a new appointment for a patient.</DialogDescription>
          </DialogHeader>
          <form class="space-y-4" @submit.prevent="createAppointment">
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
                <Label>Date *</Label>
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
            <div>
              <Label>Notes</Label>
              <Textarea v-model="newAppointment.notes" placeholder="Optional notes" rows="2" />
            </div>
            <DialogFooter>
              <Button type="button" variant="outline" @click="showNewDialog = false">Cancel</Button>
              <Button type="submit" :disabled="isSubmitting || !newAppointment.patient_id">
                {{ isSubmitting ? 'Booking...' : 'Book Appointment' }}
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>
    </div>

    <!-- View Toggle -->
    <div class="flex gap-2">
      <Button
        :variant="viewMode === 'today' ? 'default' : 'outline'"
        size="sm"
        @click="viewMode = 'today'"
      >
        Today
      </Button>
      <Button
        :variant="viewMode === 'all' ? 'default' : 'outline'"
        size="sm"
        @click="viewMode = 'all'"
      >
        All
      </Button>
    </div>

    <!-- Appointments List -->
    <Card>
      <CardContent class="p-0">
        <div v-if="isLoading" class="space-y-3 p-6">
          <Skeleton v-for="i in 5" :key="i" class="h-16 w-full" />
        </div>
        <div
          v-else-if="filteredAppointments.length === 0"
          class="flex flex-col items-center justify-center py-12 text-center"
        >
          <CalendarDays class="text-muted-foreground/50 mb-3 h-10 w-10" />
          <p class="text-muted-foreground text-sm">
            {{ viewMode === 'today' ? 'No appointments today' : 'No appointments yet' }}
          </p>
          <Button variant="outline" class="mt-3" @click="showNewDialog = true">
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
            <Badge :class="getStatusColor(appt.status)" variant="secondary" class="capitalize">
              {{ appt.status.replace('_', ' ') }}
            </Badge>
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
              <DropdownMenu v-if="appt.status === 'scheduled'">
                <DropdownMenuTrigger as-child>
                  <Button variant="ghost" size="sm">Update</Button>
                </DropdownMenuTrigger>
                <DropdownMenuContent>
                  <DropdownMenuItem @click="updateStatus(appt.id, 'completed')">
                    Mark Completed
                  </DropdownMenuItem>
                  <DropdownMenuItem @click="updateStatus(appt.id, 'cancelled')">
                    Mark Cancelled
                  </DropdownMenuItem>
                  <DropdownMenuItem @click="updateStatus(appt.id, 'no_show')">
                    Mark No-Show
                  </DropdownMenuItem>
                </DropdownMenuContent>
              </DropdownMenu>
            </div>
          </div>
        </div>
      </CardContent>
    </Card>
  </div>
</template>
