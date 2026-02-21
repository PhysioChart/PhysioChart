<script setup lang="ts">
import { Building2, Users, UserPlus, Trash2, Shield } from 'lucide-vue-next'
import { toast } from 'vue-sonner'
import type { Tables } from '~/types/database'

const supabase = useSupabase()
const { clinic, profile, isAdmin, fetchProfile } = useAuth()

// Clinic form
const clinicForm = ref({
  name: '',
  address: '',
  phone: '',
  email: '',
  logo_url: '',
})

const isSavingClinic = ref(false)

// Staff management
const staffMembers = ref<Tables<'profiles'>[]>([])
const isLoadingStaff = ref(true)
const showInviteDialog = ref(false)
const inviteForm = ref({
  email: '',
  full_name: '',
  role: 'staff' as 'admin' | 'staff',
  password: '',
})
const isInviting = ref(false)

function loadClinicForm() {
  if (!clinic.value) return
  clinicForm.value = {
    name: clinic.value.name,
    address: clinic.value.address ?? '',
    phone: clinic.value.phone ?? '',
    email: clinic.value.email ?? '',
    logo_url: clinic.value.logo_url ?? '',
  }
}

async function saveClinicProfile() {
  if (!clinic.value || !isAdmin.value) return
  isSavingClinic.value = true

  const { error } = await supabase
    .from('clinics')
    .update({
      name: clinicForm.value.name,
      address: clinicForm.value.address || null,
      phone: clinicForm.value.phone || null,
      email: clinicForm.value.email || null,
      logo_url: clinicForm.value.logo_url || null,
    })
    .eq('id', clinic.value.id)

  isSavingClinic.value = false
  if (error) {
    toast.error('Failed to update clinic profile')
    return
  }

  toast.success('Clinic profile updated')
  await fetchProfile()
}

async function loadStaff() {
  if (!profile.value) return
  isLoadingStaff.value = true

  const { data } = await supabase
    .from('profiles')
    .select('*')
    .eq('clinic_id', profile.value.clinic_id)
    .order('created_at')

  staffMembers.value = data ?? []
  isLoadingStaff.value = false
}

async function inviteStaffMember() {
  if (
    !profile.value ||
    !inviteForm.value.email ||
    !inviteForm.value.full_name ||
    !inviteForm.value.password
  )
    return
  isInviting.value = true

  // Sign up the staff member via Supabase Auth
  // The trigger will auto-create their profile
  const { error } = await supabase.auth.signUp({
    email: inviteForm.value.email,
    password: inviteForm.value.password,
    options: {
      data: {
        clinic_id: profile.value.clinic_id,
        full_name: inviteForm.value.full_name,
        role: inviteForm.value.role,
      },
    },
  })

  isInviting.value = false
  if (error) {
    toast.error(error.message)
    return
  }

  toast.success('Staff member added')
  showInviteDialog.value = false
  inviteForm.value = { email: '', full_name: '', role: 'staff', password: '' }
  await loadStaff()
}

async function deactivateStaff(staffId: string) {
  if (!isAdmin.value || staffId === profile.value?.id) return

  const { error } = await supabase.from('profiles').update({ is_active: false }).eq('id', staffId)

  if (error) {
    toast.error('Failed to deactivate staff member')
    return
  }

  toast.success('Staff member deactivated')
  await loadStaff()
}

onMounted(() => {
  loadClinicForm()
  loadStaff()
})

watch(clinic, loadClinicForm)
</script>

<template>
  <div class="space-y-6">
    <div>
      <h1 class="text-2xl font-bold tracking-tight">Settings</h1>
      <p class="text-muted-foreground text-sm">Manage your clinic profile and team</p>
    </div>

    <Tabs default-value="clinic">
      <TabsList>
        <TabsTrigger value="clinic">
          <Building2 class="mr-2 h-4 w-4" />
          Clinic Profile
        </TabsTrigger>
        <TabsTrigger value="staff">
          <Users class="mr-2 h-4 w-4" />
          Staff
        </TabsTrigger>
      </TabsList>

      <!-- Clinic Profile Tab -->
      <TabsContent value="clinic">
        <Card>
          <CardHeader>
            <CardTitle>Clinic Information</CardTitle>
            <CardDescription>
              {{
                isAdmin
                  ? 'Update your clinic details.'
                  : 'View your clinic details. Only admins can edit.'
              }}
            </CardDescription>
          </CardHeader>
          <CardContent>
            <form class="space-y-4" @submit.prevent="saveClinicProfile">
              <div class="grid gap-4 sm:grid-cols-2">
                <div class="sm:col-span-2">
                  <Label for="clinic-name">Clinic Name</Label>
                  <Input
                    id="clinic-name"
                    v-model="clinicForm.name"
                    placeholder="Your clinic name"
                    :disabled="!isAdmin"
                  />
                </div>
                <div>
                  <Label for="clinic-phone">Phone</Label>
                  <Input
                    id="clinic-phone"
                    v-model="clinicForm.phone"
                    placeholder="+91 98765 43210"
                    :disabled="!isAdmin"
                  />
                </div>
                <div>
                  <Label for="clinic-email">Email</Label>
                  <Input
                    id="clinic-email"
                    v-model="clinicForm.email"
                    type="email"
                    placeholder="clinic@example.com"
                    :disabled="!isAdmin"
                  />
                </div>
                <div class="sm:col-span-2">
                  <Label for="clinic-address">Address</Label>
                  <Textarea
                    id="clinic-address"
                    v-model="clinicForm.address"
                    placeholder="Clinic address"
                    rows="2"
                    :disabled="!isAdmin"
                  />
                </div>
                <div class="sm:col-span-2">
                  <Label for="clinic-logo">Logo URL</Label>
                  <Input
                    id="clinic-logo"
                    v-model="clinicForm.logo_url"
                    placeholder="https://example.com/logo.png"
                    :disabled="!isAdmin"
                  />
                </div>
              </div>
              <Button v-if="isAdmin" type="submit" :disabled="isSavingClinic">
                {{ isSavingClinic ? 'Saving...' : 'Save Changes' }}
              </Button>
            </form>
          </CardContent>
        </Card>
      </TabsContent>

      <!-- Staff Tab -->
      <TabsContent value="staff">
        <Card>
          <CardHeader>
            <div class="flex items-center justify-between">
              <div>
                <CardTitle>Staff Members</CardTitle>
                <CardDescription>Manage your clinic's team</CardDescription>
              </div>
              <Dialog v-if="isAdmin" v-model:open="showInviteDialog">
                <DialogTrigger as-child>
                  <Button>
                    <UserPlus class="mr-2 h-4 w-4" />
                    Add Staff
                  </Button>
                </DialogTrigger>
                <DialogContent class="sm:max-w-md">
                  <DialogHeader>
                    <DialogTitle>Add Staff Member</DialogTitle>
                    <DialogDescription>
                      Create an account for a new staff member.
                    </DialogDescription>
                  </DialogHeader>
                  <form class="space-y-4" @submit.prevent="inviteStaffMember">
                    <div>
                      <Label>Full Name *</Label>
                      <Input v-model="inviteForm.full_name" placeholder="Staff member name" />
                    </div>
                    <div>
                      <Label>Email *</Label>
                      <Input
                        v-model="inviteForm.email"
                        type="email"
                        placeholder="staff@clinic.com"
                      />
                    </div>
                    <div>
                      <Label>Password *</Label>
                      <Input
                        v-model="inviteForm.password"
                        type="password"
                        placeholder="Temporary password"
                      />
                    </div>
                    <div>
                      <Label>Role</Label>
                      <Select v-model="inviteForm.role">
                        <SelectTrigger>
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="staff">Staff (Therapist/Receptionist)</SelectItem>
                          <SelectItem value="admin">Admin (Full access)</SelectItem>
                        </SelectContent>
                      </Select>
                    </div>
                    <DialogFooter>
                      <Button type="button" variant="outline" @click="showInviteDialog = false">
                        Cancel
                      </Button>
                      <Button
                        type="submit"
                        :disabled="
                          isInviting ||
                          !inviteForm.email ||
                          !inviteForm.full_name ||
                          !inviteForm.password
                        "
                      >
                        {{ isInviting ? 'Adding...' : 'Add Member' }}
                      </Button>
                    </DialogFooter>
                  </form>
                </DialogContent>
              </Dialog>
            </div>
          </CardHeader>
          <CardContent class="p-0">
            <div v-if="isLoadingStaff" class="space-y-3 p-6">
              <Skeleton v-for="i in 3" :key="i" class="h-16 w-full" />
            </div>
            <div v-else class="divide-y">
              <div
                v-for="member in staffMembers"
                :key="member.id"
                class="flex items-center gap-4 p-4"
                :class="{ 'opacity-50': !member.is_active }"
              >
                <Avatar class="h-10 w-10">
                  <AvatarFallback>
                    {{
                      member.full_name
                        .split(' ')
                        .map((n) => n[0])
                        .join('')
                        .toUpperCase()
                        .slice(0, 2)
                    }}
                  </AvatarFallback>
                </Avatar>
                <div class="flex-1">
                  <p class="font-medium">
                    {{ member.full_name }}
                    <span v-if="member.id === profile?.id" class="text-muted-foreground text-xs"
                      >(You)</span
                    >
                  </p>
                  <p class="text-muted-foreground text-sm">{{ member.email }}</p>
                </div>
                <Badge variant="secondary" class="capitalize">
                  <Shield v-if="member.role === 'admin'" class="mr-1 h-3 w-3" />
                  {{ member.role }}
                </Badge>
                <Badge v-if="!member.is_active" variant="outline" class="text-destructive">
                  Inactive
                </Badge>
                <Button
                  v-if="isAdmin && member.id !== profile?.id && member.is_active"
                  variant="ghost"
                  size="icon"
                  class="text-destructive"
                  @click="deactivateStaff(member.id)"
                >
                  <Trash2 class="h-4 w-4" />
                </Button>
              </div>
            </div>
          </CardContent>
        </Card>
      </TabsContent>
    </Tabs>
  </div>
</template>
