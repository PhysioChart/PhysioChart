<template>
  <div class="space-y-4">
    <div class="flex items-center justify-between">
      <div>
        <h1 class="text-2xl font-bold tracking-tight">Treatment Plans</h1>
        <p class="text-muted-foreground text-sm">Track treatment progress for your patients</p>
      </div>
      <Button size="lg" @click="openDialog()">
        <Plus class="mr-2 h-4 w-4" />
        New Plan
      </Button>
    </div>

    <Dialog v-model:open="showNewDialog">
      <DialogContent class="max-h-[90vh] overflow-y-auto sm:max-w-lg">
        <DialogHeader>
          <DialogTitle>Create Treatment Plan</DialogTitle>
          <DialogDescription>Set up a treatment plan for a patient.</DialogDescription>
        </DialogHeader>
        <form class="space-y-4" @submit.prevent="createPlan">
          <div>
            <Label>Patient *</Label>
            <Select v-model="newPlan.patient_id">
              <SelectTrigger>
                <SelectValue placeholder="Select patient" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem v-for="p in patients" :key="p.id" :value="p.id">
                  {{ p.full_name }}
                </SelectItem>
              </SelectContent>
            </Select>
          </div>
          <div>
            <Label>Plan Name *</Label>
            <Input v-model="newPlan.name" placeholder="e.g., Knee Rehabilitation" />
          </div>
          <div>
            <Label>Diagnosis</Label>
            <Input v-model="newPlan.diagnosis" placeholder="e.g., ACL tear, post-operative" />
          </div>
          <div class="grid grid-cols-2 gap-3">
            <div>
              <Label>Treatment Type</Label>
              <Input v-model="newPlan.treatment_type" placeholder="e.g., Physiotherapy" />
            </div>
            <div>
              <Label>Total Sessions</Label>
              <Input v-model.number="newPlan.total_sessions" type="number" min="1" />
            </div>
          </div>
          <div>
            <Label>Therapist</Label>
            <Select v-model="newPlan.therapist_id">
              <SelectTrigger>
                <SelectValue placeholder="Assign therapist (optional)" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem v-for="t in therapists" :key="t.id" :value="t.id">
                  {{ t.full_name }}
                </SelectItem>
              </SelectContent>
            </Select>
          </div>
          <div class="grid grid-cols-2 gap-3">
            <div>
              <Label>Price per Session (Rs)</Label>
              <Input v-model="newPlan.price_per_session" type="number" placeholder="e.g., 800" />
            </div>
            <div>
              <Label>Package Price (Rs)</Label>
              <Input v-model="newPlan.package_price" type="number" placeholder="e.g., 8000" />
            </div>
          </div>
          <div>
            <Label>Notes</Label>
            <Textarea v-model="newPlan.notes" placeholder="Additional notes" rows="2" />
          </div>
          <DialogFooter>
            <Button type="button" variant="outline" @click="showNewDialog = false">Cancel</Button>
            <Button type="submit" :disabled="isSubmitting || !newPlan.patient_id || !newPlan.name">
              {{ isSubmitting ? 'Creating...' : 'Create Plan' }}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>

    <!-- Filter -->
    <div class="flex gap-2">
      <Button
        v-for="f in [TreatmentStatus.ACTIVE, TreatmentStatus.COMPLETED, 'all'] as const"
        :key="f"
        :variant="filter === f ? 'default' : 'outline'"
        size="sm"
        @click="filter = f"
      >
        {{ f === 'all' ? 'All' : TREATMENT_STATUS_LABELS[f] }}
      </Button>
    </div>

    <!-- Plans List -->
    <div v-if="isLoading" class="space-y-3">
      <Skeleton v-for="i in 3" :key="i" class="h-32 w-full" />
    </div>
    <div
      v-else-if="filteredPlans.length === 0"
      class="flex flex-col items-center justify-center py-12 text-center"
    >
      <ClipboardList class="text-muted-foreground/50 mb-3 h-10 w-10" />
      <p class="text-muted-foreground text-sm">No treatment plans yet</p>
      <Button variant="outline" class="mt-3" @click="openDialog()">
        Create your first treatment plan
      </Button>
    </div>
    <div v-else class="grid gap-4 md:grid-cols-2">
      <Card v-for="plan in filteredPlans" :key="plan.id">
        <CardHeader class="pb-2">
          <div class="flex items-start justify-between">
            <div>
              <CardTitle class="text-base">{{ plan.name }}</CardTitle>
              <CardDescription>
                {{ plan.patient?.full_name ?? 'Unknown' }}
                <template v-if="plan.therapist">
                  &middot; Dr. {{ plan.therapist.full_name }}</template
                >
              </CardDescription>
            </div>
            <Badge :class="getStatusColor(plan.status)" variant="secondary">
              {{ TREATMENT_STATUS_LABELS[plan.status] }}
            </Badge>
          </div>
        </CardHeader>
        <CardContent>
          <div v-if="plan.diagnosis" class="text-muted-foreground mb-2 text-sm">
            {{ plan.diagnosis }}
          </div>
          <!-- Progress bar -->
          <div class="space-y-1">
            <div class="flex justify-between text-xs">
              <span>{{ plan.completed_sessions }}/{{ plan.total_sessions }} sessions</span>
              <span>{{ progressPercent(plan.completed_sessions, plan.total_sessions) }}%</span>
            </div>
            <div class="bg-muted h-2 w-full rounded-full">
              <div
                class="bg-primary h-full rounded-full transition-all"
                :style="{
                  width: `${progressPercent(plan.completed_sessions, plan.total_sessions)}%`,
                }"
              />
            </div>
          </div>
          <div
            v-if="plan.package_price || plan.price_per_session"
            class="text-muted-foreground mt-2 text-sm"
          >
            <span v-if="plan.package_price">Package: {{ formatCurrency(plan.package_price) }}</span>
            <span v-else-if="plan.price_per_session"
              >{{ formatCurrency(plan.price_per_session) }}/session</span
            >
          </div>
        </CardContent>
      </Card>
    </div>
  </div>
</template>

<script setup lang="ts">
import { ClipboardList, Plus } from 'lucide-vue-next'
import { TreatmentStatus, TREATMENT_STATUS_LABELS } from '~/enums/treatment.enum'
import { useTreatmentsPage } from '~/composables/useTreatmentsPage'
import { getStatusColor, progressPercent, formatCurrency } from '~/lib/formatters'

const {
  isLoading,
  showNewDialog,
  filter,
  patients,
  therapists,
  filteredPlans,
  newPlan,
  isSubmitting,
  openDialog,
  createPlan,
} = useTreatmentsPage()
</script>
