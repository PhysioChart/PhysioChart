<template>
  <div class="space-y-6">
    <div>
      <h1 class="text-2xl font-bold tracking-tight">Settings</h1>
      <p class="text-muted-foreground text-sm">Manage your clinic profile and team</p>
    </div>

    <Tabs default-value="clinic">
      <TabsList class="w-full justify-start overflow-x-auto">
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
              <Button v-if="isAdmin" type="submit" size="lg" :disabled="isSavingClinic">
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
                  <Button size="lg">
                    <UserPlus class="mr-2 h-4 w-4" />
                    Add Staff
                  </Button>
                </DialogTrigger>
                <DialogContent class="sm:max-w-md">
                  <DialogHeader>
                    <DialogTitle>Invite Staff Member</DialogTitle>
                    <DialogDescription>
                      Send a secure invite link for a new staff member.
                    </DialogDescription>
                  </DialogHeader>
                  <form class="space-y-4" @submit.prevent="inviteStaffMember">
                    <div>
                      <Label>Email *</Label>
                      <Input
                        v-model="inviteForm.email"
                        type="email"
                        placeholder="staff@clinic.com"
                      />
                    </div>
                    <div>
                      <Label>Role</Label>
                      <Select v-model="inviteForm.role">
                        <SelectTrigger>
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem :value="UserRole.STAFF"
                            >Staff (Therapist/Receptionist)</SelectItem
                          >
                          <SelectItem :value="UserRole.ADMIN">Admin (Full access)</SelectItem>
                        </SelectContent>
                      </Select>
                    </div>
                    <DialogFooter>
                      <Button type="button" variant="outline" @click="showInviteDialog = false">
                        Cancel
                      </Button>
                      <Button type="submit" :disabled="isInviting || !inviteForm.email">
                        {{ isInviting ? 'Creating...' : 'Create Invite Link' }}
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
            <div
              v-else-if="staffMembers.length === 0"
              class="flex flex-col items-center justify-center py-12 text-center"
            >
              <Users class="text-muted-foreground/50 mb-3 h-10 w-10" />
              <p class="text-muted-foreground text-sm">No staff members yet</p>
            </div>
            <div v-else class="divide-y">
              <div
                v-for="member in staffMembers"
                :key="member.id"
                class="flex flex-wrap items-center gap-3 p-4 sm:flex-nowrap sm:gap-4"
                :class="{ 'opacity-50': !member.is_active }"
              >
                <Avatar class="h-10 w-10 shrink-0">
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
                <div class="min-w-0 flex-1">
                  <p class="truncate font-medium">
                    {{ member.full_name }}
                    <span v-if="member.id === profile?.id" class="text-muted-foreground text-xs"
                      >(You)</span
                    >
                  </p>
                  <p class="text-muted-foreground truncate text-sm">{{ member.email }}</p>
                </div>
                <div class="flex items-center gap-2">
                  <Badge variant="secondary">
                    <Shield v-if="member.role === UserRole.ADMIN" class="mr-1 h-3 w-3" />
                    {{ USER_ROLE_LABELS[member.role] }}
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
            </div>
          </CardContent>
        </Card>
      </TabsContent>
    </Tabs>
  </div>
</template>

<script setup lang="ts">
import { Building2, Users, UserPlus, Trash2, Shield } from 'lucide-vue-next'
import { UserRole, USER_ROLE_LABELS } from '~/enums/user-role.enum'
import { useSettingsPage } from '~/composables/useSettingsPage'

definePageMeta({ layout: 'protected' })

const {
  profile,
  isAdmin,
  clinicForm,
  isSavingClinic,
  isLoadingStaff,
  showInviteDialog,
  inviteForm,
  isInviting,
  staffMembers,
  saveClinicProfile,
  inviteStaffMember,
  deactivateStaff,
} = useSettingsPage()
</script>
