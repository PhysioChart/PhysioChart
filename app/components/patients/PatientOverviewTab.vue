<template>
  <div class="space-y-4">
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
              <dd class="text-sm font-medium">{{ formatIndianPhoneDisplay(patient.phone) }}</dd>
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
            <dd class="text-sm font-medium">
              {{ formatIndianPhoneDisplay(patient.emergency_contact_phone) }}
            </dd>
          </div>
        </dl>
      </CardContent>
    </Card>

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
              <Badge v-for="m in medicalHistory.current_medications" :key="m" variant="secondary">
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

    <Card v-if="patient.notes">
      <CardHeader>
        <CardTitle class="text-base">Notes</CardTitle>
      </CardHeader>
      <CardContent>
        <p class="text-sm">{{ patient.notes }}</p>
      </CardContent>
    </Card>
  </div>
</template>

<script setup lang="ts">
import { Phone, Mail, MapPin, Calendar, AlertCircle, User } from 'lucide-vue-next'
import type { Tables, MedicalHistory } from '~/types/database'
import { GENDER_LABELS } from '~/enums/gender.enum'
import { formatDateLong } from '~/lib/formatters'
import { formatIndianPhoneDisplay } from '~/lib/phone'

defineProps<{
  patient: Tables<'patients'>
  medicalHistory: MedicalHistory
}>()
</script>
