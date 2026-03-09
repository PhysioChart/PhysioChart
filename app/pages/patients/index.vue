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
        <DialogContent class="max-h-[90vh] overflow-y-auto sm:max-w-md">
          <DialogHeader class="-mx-6 -mt-6 border-b px-6 py-4">
            <DialogTitle>Register New Patient</DialogTitle>
            <DialogDescription>
              Enter the patient's details. Phone number is the primary identifier.
            </DialogDescription>
          </DialogHeader>
          <form class="space-y-4 pt-2" @submit.prevent="createPatient">
            <div class="grid gap-4 sm:grid-cols-2">
              <div class="space-y-2 sm:col-span-2">
                <Label for="name">Full Name *</Label>
                <Input id="name" v-model="newPatient.full_name" placeholder="Patient name" />
              </div>
              <div class="space-y-2">
                <Label for="phone">Phone *</Label>
                <PhoneInput id="phone" v-model="newPatient.phone" placeholder="98765 43210" />
              </div>
              <div class="space-y-2">
                <Label for="email">Email</Label>
                <Input id="email" v-model="newPatient.email" type="email" placeholder="Optional" />
              </div>
              <div class="space-y-2">
                <Label for="dob">Date of Birth</Label>
                <Popover v-model:open="dobPickerOpen" modal>
                  <PopoverTrigger as-child>
                    <Button
                      id="dob"
                      type="button"
                      variant="outline"
                      :class="
                        cn(
                          'w-full justify-start text-left font-normal',
                          !newPatient.date_of_birth && 'text-muted-foreground',
                        )
                      "
                    >
                      <CalendarIcon class="mr-2 size-4" />
                      {{ formattedDob || 'Pick a date' }}
                    </Button>
                  </PopoverTrigger>
                  <PopoverContent class="w-auto p-0" align="start">
                    <Calendar v-model="dobCalendarValue" />
                  </PopoverContent>
                </Popover>
              </div>
              <div class="space-y-2">
                <Label for="gender">Gender</Label>
                <Select v-model="newPatient.gender">
                  <SelectTrigger class="w-full">
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
              <div class="space-y-2 sm:col-span-2">
                <Label for="address">Address</Label>
                <Textarea
                  id="address"
                  v-model="newPatient.address"
                  placeholder="Optional"
                  rows="2"
                />
              </div>
              <div class="space-y-2">
                <Label for="ec-name">Emergency Contact Name</Label>
                <Input
                  id="ec-name"
                  v-model="newPatient.emergency_contact_name"
                  placeholder="Optional"
                />
              </div>
              <div class="space-y-2">
                <Label for="ec-phone">Emergency Contact Phone</Label>
                <PhoneInput
                  id="ec-phone"
                  v-model="newPatient.emergency_contact_phone"
                  placeholder="Optional"
                />
              </div>
              <div class="space-y-2 sm:col-span-2">
                <Label for="notes">Notes</Label>
                <Textarea
                  id="notes"
                  v-model="newPatient.notes"
                  placeholder="Any additional notes"
                  rows="2"
                />
              </div>
            </div>
            <DialogFooter class="-mx-6 -mb-6 border-t px-6 py-4">
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
import type { DateValue } from 'reka-ui'
import { CalendarDate } from '@internationalized/date'
import { Users, UserPlus, Search, Phone, CalendarIcon } from 'lucide-vue-next'
import { PhoneInput } from '~/components/ui/input'
import { Calendar } from '~/components/ui/calendar'
import { Popover, PopoverContent, PopoverTrigger } from '~/components/ui/popover'
import { cn } from '~/lib/utils'
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

const dobPickerOpen = ref(false)

const dobCalendarValue = computed<DateValue | undefined>({
  get() {
    if (!newPatient.value.date_of_birth) return undefined
    const [year, month, day] = newPatient.value.date_of_birth.split('-').map(Number) as [number, number, number]
    return new CalendarDate(year, month, day)
  },
  set(val: DateValue | undefined) {
    if (val) {
      const y = String(val.year).padStart(4, '0')
      const m = String(val.month).padStart(2, '0')
      const d = String(val.day).padStart(2, '0')
      newPatient.value.date_of_birth = `${y}-${m}-${d}`
    } else {
      newPatient.value.date_of_birth = ''
    }
    dobPickerOpen.value = false
  },
})

const formattedDob = computed(() => {
  if (!newPatient.value.date_of_birth) return ''
  return new Date(newPatient.value.date_of_birth + 'T00:00:00').toLocaleDateString('en-IN', {
    year: 'numeric',
    month: 'short',
    day: 'numeric',
  })
})
</script>
