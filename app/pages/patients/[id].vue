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

const route = useRoute()
const supabase = useSupabase()
const { profile: _profile } = useAuth()

const patient = ref<Tables<'patients'> | null>(null)
const isLoading = ref(true)
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
  const { data, error } = await supabase
    .from('patients')
    .select('*')
    .eq('id', route.params.id as string)
    .single()

  if (error || !data) {
    toast.error('Patient not found')
    navigateTo('/patients')
    return
  }
  patient.value = data
  isLoading.value = false
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

async function saveEdit() {
  if (!patient.value || !editForm.value.full_name) return

  const { error } = await supabase
    .from('patients')
    .update({
      full_name: editForm.value.full_name,
      phone: editForm.value.phone,
      email: editForm.value.email || null,
      date_of_birth: editForm.value.date_of_birth || null,
      gender: (editForm.value.gender as 'male' | 'female' | 'other') || null,
      address: editForm.value.address || null,
      emergency_contact_name: editForm.value.emergency_contact_name || null,
      emergency_contact_phone: editForm.value.emergency_contact_phone || null,
      notes: editForm.value.notes || null,
    })
    .eq('id', patient.value.id)

  if (error) {
    toast.error('Failed to update patient')
    return
  }

  toast.success('Patient updated')
  isEditing.value = false
  await loadPatient()
}

async function archivePatient() {
  if (!patient.value) return

  const { error } = await supabase
    .from('patients')
    .update({ is_archived: true })
    .eq('id', patient.value.id)

  if (error) {
    toast.error('Failed to archive patient')
    return
  }

  toast.success('Patient archived')
  navigateTo('/patients')
}

function formatDate(dateStr: string | null) {
  if (!dateStr) return '—'
  return new Date(dateStr).toLocaleDateString('en-IN', {
    day: 'numeric',
    month: 'long',
    year: 'numeric',
  })
}

const medicalHistory = computed(() => {
  return (patient.value?.medical_history as MedicalHistory) ?? {}
})

onMounted(loadPatient)
</script>

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
              Patient since {{ formatDate(patient.created_at) }}
            </p>
          </div>
        </div>
        <div class="flex gap-2">
          <Button variant="outline" @click="startEdit">
            <Pencil class="mr-2 h-4 w-4" />
            Edit
          </Button>
          <Button variant="outline" class="text-destructive" @click="archivePatient">
            <Archive class="mr-2 h-4 w-4" />
            Archive
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
                        <SelectItem value="male">Male</SelectItem>
                        <SelectItem value="female">Female</SelectItem>
                        <SelectItem value="other">Other</SelectItem>
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
                  <Button type="submit">Save Changes</Button>
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
                    <dd class="text-sm font-medium">{{ formatDate(patient.date_of_birth) }}</dd>
                  </div>
                </div>
                <div class="flex items-center gap-2">
                  <User class="text-muted-foreground h-4 w-4" />
                  <div>
                    <dt class="text-muted-foreground text-xs">Gender</dt>
                    <dd class="text-sm font-medium capitalize">{{ patient.gender ?? '—' }}</dd>
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
          <Card>
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
