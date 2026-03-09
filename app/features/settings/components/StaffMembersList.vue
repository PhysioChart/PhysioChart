<template>
  <Card>
    <CardHeader>
      <div class="flex items-center justify-between">
        <div>
          <CardTitle>Staff Members</CardTitle>
          <CardDescription>Manage your clinic's team</CardDescription>
        </div>
        <slot v-if="isAdmin" name="header-action" />
      </div>
    </CardHeader>
    <CardContent class="p-0">
      <div v-if="isLoading" class="space-y-3 p-6">
        <Skeleton v-for="i in 3" :key="i" class="h-16 w-full" />
      </div>
      <div
        v-else-if="members.length === 0"
        class="flex flex-col items-center justify-center py-12 text-center"
      >
        <Users class="text-muted-foreground/50 mb-3 h-10 w-10" />
        <p class="text-muted-foreground text-sm">No staff members yet</p>
      </div>
      <div v-else class="divide-y">
        <div
          v-for="member in members"
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
              <span v-if="member.id === currentUserId" class="text-muted-foreground text-xs"
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
              v-if="isAdmin && member.id !== currentUserId && member.is_active"
              variant="ghost"
              size="icon"
              class="text-destructive"
              @click="emit('remove', member.id)"
            >
              <Trash2 class="h-4 w-4" />
            </Button>
          </div>
        </div>
      </div>
    </CardContent>
  </Card>
</template>

<script setup lang="ts">
import { Users, Shield, Trash2 } from 'lucide-vue-next'
import type { IClinicStaffMember } from '~/services/staff.service'
import { UserRole, USER_ROLE_LABELS } from '~/enums/user-role.enum'

defineProps<{
  members: IClinicStaffMember[]
  isAdmin: boolean
  isLoading: boolean
  currentUserId?: string
}>()

const emit = defineEmits<{
  (e: 'invite'): void
  (e: 'remove', memberId: string): void
}>()
</script>
