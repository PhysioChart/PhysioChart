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
    <div class="relative w-full max-w-sm">
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
        <div v-else class="overflow-x-auto">
          <Table>
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
                :aria-label="`Open patient ${patient.full_name}`"
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
        </div>
      </CardContent>
    </Card>
  </div>
</template>

<script setup lang="ts">
import { Users, UserPlus, Search, Phone } from 'lucide-vue-next'
import { Gender, GENDER_LABELS } from '~/enums/gender.enum'
import { usePatientsIndexPage } from '~/composables/usePatientsIndexPage'
import { formatDateWithYear } from '~/lib/formatters'

definePageMeta({ layout: 'protected' })

const {
  searchQuery,
  isLoading,
  showNewPatientDialog,
  newPatient,
  isSubmitting,
  filteredPatients,
  createPatient,
} = usePatientsIndexPage()
</script>
