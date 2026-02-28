<template>
  <div class="space-y-4">
    <!-- Header -->
    <div class="flex items-center justify-between">
      <div>
        <h1 class="text-2xl font-bold tracking-tight">Patients</h1>
        <p class="text-muted-foreground text-sm">Manage your clinic's patient records</p>
      </div>
      <Dialog v-model:open="showNewPatientDialog">
        <DialogTrigger as-child>
          <Button size="lg">
            <UserPlus class="mr-2 h-4 w-4" />
            New Patient
          </Button>
        </DialogTrigger>
        <DialogContent class="max-h-[90vh] overflow-y-auto sm:max-w-lg">
          <DialogHeader>
            <DialogTitle>Register New Patient</DialogTitle>
            <DialogDescription>
              Enter the patient's details. Phone number is the primary identifier.
            </DialogDescription>
          </DialogHeader>
          <form class="space-y-4" @submit.prevent="createPatient">
            <div class="grid gap-4 sm:grid-cols-2">
              <div class="sm:col-span-2">
                <Label for="name">Full Name *</Label>
                <Input id="name" v-model="newPatient.full_name" placeholder="Patient name" />
              </div>
              <div>
                <Label for="phone">Phone *</Label>
                <Input id="phone" v-model="newPatient.phone" placeholder="+91 98765 43210" />
              </div>
              <div>
                <Label for="email">Email</Label>
                <Input id="email" v-model="newPatient.email" type="email" placeholder="Optional" />
              </div>
              <div>
                <Label for="dob">Date of Birth</Label>
                <Input id="dob" v-model="newPatient.date_of_birth" type="date" />
              </div>
              <div>
                <Label for="gender">Gender</Label>
                <Select v-model="newPatient.gender">
                  <SelectTrigger>
                    <SelectValue placeholder="Select" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem :value="Gender.MALE">{{ GENDER_LABELS[Gender.MALE] }}</SelectItem>
                    <SelectItem :value="Gender.FEMALE">{{
                      GENDER_LABELS[Gender.FEMALE]
                    }}</SelectItem>
                    <SelectItem :value="Gender.OTHER">{{ GENDER_LABELS[Gender.OTHER] }}</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div class="sm:col-span-2">
                <Label for="address">Address</Label>
                <Textarea
                  id="address"
                  v-model="newPatient.address"
                  placeholder="Optional"
                  rows="2"
                />
              </div>
              <div>
                <Label for="ec-name">Emergency Contact Name</Label>
                <Input
                  id="ec-name"
                  v-model="newPatient.emergency_contact_name"
                  placeholder="Optional"
                />
              </div>
              <div>
                <Label for="ec-phone">Emergency Contact Phone</Label>
                <Input
                  id="ec-phone"
                  v-model="newPatient.emergency_contact_phone"
                  placeholder="Optional"
                />
              </div>
              <div class="sm:col-span-2">
                <Label for="notes">Notes</Label>
                <Textarea
                  id="notes"
                  v-model="newPatient.notes"
                  placeholder="Any additional notes"
                  rows="2"
                />
              </div>
            </div>
            <DialogFooter>
              <Button type="button" variant="outline" @click="showNewPatientDialog = false">
                Cancel
              </Button>
              <Button
                type="submit"
                :disabled="isSubmitting || !newPatient.full_name || !newPatient.phone"
              >
                {{ isSubmitting ? 'Registering...' : 'Register Patient' }}
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>
    </div>

    <!-- Search -->
    <div class="relative max-w-sm">
      <Search class="text-muted-foreground absolute top-1/2 left-3 h-4 w-4 -translate-y-1/2" />
      <Input v-model="searchQuery" class="pl-9" placeholder="Search by name or phone..." />
    </div>

    <!-- Patients Table -->
    <Card>
      <CardContent class="p-0">
        <div v-if="isLoading" class="space-y-3 p-6">
          <Skeleton v-for="i in 5" :key="i" class="h-12 w-full" />
        </div>
        <div
          v-else-if="filteredPatients.length === 0"
          class="flex flex-col items-center justify-center py-12 text-center"
        >
          <Users class="text-muted-foreground/50 mb-3 h-10 w-10" />
          <p class="text-muted-foreground text-sm">
            {{ searchQuery ? 'No patients match your search' : 'No patients registered yet' }}
          </p>
          <Button
            v-if="!searchQuery"
            variant="outline"
            class="mt-3"
            @click="showNewPatientDialog = true"
          >
            Register your first patient
          </Button>
        </div>
        <Table v-else>
          <TableHeader>
            <TableRow>
              <TableHead>Name</TableHead>
              <TableHead>Phone</TableHead>
              <TableHead class="hidden md:table-cell">Gender</TableHead>
              <TableHead class="hidden md:table-cell">Registered</TableHead>
              <TableHead class="text-right">Actions</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            <TableRow
              v-for="patient in filteredPatients"
              :key="patient.id"
              role="link"
              tabindex="0"
              class="cursor-pointer"
              @click="navigateTo(`/patients/${patient.id}`)"
              @keydown.enter="navigateTo(`/patients/${patient.id}`)"
            >
              <TableCell class="font-medium">{{ patient.full_name }}</TableCell>
              <TableCell>
                <div class="flex items-center gap-1">
                  <Phone class="text-muted-foreground h-3 w-3" />
                  {{ patient.phone }}
                </div>
              </TableCell>
              <TableCell class="hidden md:table-cell">
                {{ patient.gender ? GENDER_LABELS[patient.gender] : '—' }}
              </TableCell>
              <TableCell class="hidden md:table-cell">
                {{ formatDateWithYear(patient.created_at) }}
              </TableCell>
              <TableCell class="text-right">
                <Button
                  variant="ghost"
                  size="sm"
                  @click.stop="navigateTo(`/patients/${patient.id}`)"
                >
                  View
                </Button>
              </TableCell>
            </TableRow>
          </TableBody>
        </Table>
      </CardContent>
    </Card>
  </div>
</template>

<script setup lang="ts">
import { Users, UserPlus, Search, Phone } from 'lucide-vue-next'
import { storeToRefs } from 'pinia'
import { toast } from 'vue-sonner'
import { Gender, GENDER_LABELS } from '~/enums/gender.enum'
import { patientService } from '~/services/patient.service'
import { usePatientsStore } from '~/stores/patients.store'
import { formatDateWithYear } from '~/lib/formatters'

const supabase = useSupabase()
const { profile } = useAuth()
const route = useRoute()
const patientsStore = usePatientsStore()
const { byClinic } = storeToRefs(patientsStore)

const searchQuery = ref('')
const isLoading = ref(true)
const showNewPatientDialog = ref(route.query.action === 'new')
const patients = computed(() => {
  if (!profile.value) return []
  return byClinic.value[profile.value.clinic_id] ?? []
})

// Form state for new patient
const newPatient = ref({
  full_name: '',
  phone: '',
  email: '',
  date_of_birth: '',
  gender: '' as '' | 'male' | 'female' | 'other',
  address: '',
  emergency_contact_name: '',
  emergency_contact_phone: '',
  notes: '',
  medical_history: {
    past_surgeries: [] as string[],
    current_medications: [] as string[],
    allergies: [] as string[],
    conditions: [] as string[],
    notes: '',
  },
})

const isSubmitting = ref(false)

async function loadPatients() {
  if (!profile.value) return
  isLoading.value = true

  try {
    await patientsStore.fetchList(profile.value.clinic_id, { force: true })
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : 'Failed to load patients'
    toast.error(message)
  } finally {
    isLoading.value = false
  }
}

const filteredPatients = computed(() => {
  if (!searchQuery.value) return patients.value
  const q = searchQuery.value.toLowerCase()
  return patients.value.filter((p) => p.full_name.toLowerCase().includes(q) || p.phone.includes(q))
})

async function createPatient() {
  if (!profile.value || !newPatient.value.full_name || !newPatient.value.phone) return
  isSubmitting.value = true

  try {
    const created = await patientService(supabase).create({
      clinic_id: profile.value.clinic_id,
      full_name: newPatient.value.full_name,
      phone: newPatient.value.phone,
      email: newPatient.value.email || null,
      date_of_birth: newPatient.value.date_of_birth || null,
      gender: (newPatient.value.gender as Gender) || null,
      address: newPatient.value.address || null,
      emergency_contact_name: newPatient.value.emergency_contact_name || null,
      emergency_contact_phone: newPatient.value.emergency_contact_phone || null,
      notes: newPatient.value.notes || null,
      medical_history: newPatient.value.medical_history,
    })

    patientsStore.upsertPatient(profile.value.clinic_id, created)
    patientsStore.invalidate(profile.value.clinic_id)
    toast.success('Patient registered successfully')
    await loadPatients()
    showNewPatientDialog.value = false
    resetForm()
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : 'Failed to create patient'
    toast.error(message)
  } finally {
    isSubmitting.value = false
  }
}

function resetForm() {
  newPatient.value = {
    full_name: '',
    phone: '',
    email: '',
    date_of_birth: '',
    gender: '',
    address: '',
    emergency_contact_name: '',
    emergency_contact_phone: '',
    notes: '',
    medical_history: {
      past_surgeries: [],
      current_medications: [],
      allergies: [],
      conditions: [],
      notes: '',
    },
  }
}

onMounted(loadPatients)
</script>
