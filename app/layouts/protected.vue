<template>
  <div
    v-if="bootstrapStatus === 'loading'"
    class="bg-background text-foreground flex min-h-screen items-center justify-center"
  >
    <div class="border-primary h-8 w-8 animate-spin rounded-full border-4 border-t-transparent" />
  </div>

  <div
    v-else-if="bootstrapStatus === 'error'"
    class="bg-background text-foreground flex min-h-screen items-center justify-center px-4"
  >
    <Card class="w-full max-w-md">
      <CardHeader>
        <CardTitle>Unable to load your workspace</CardTitle>
        <CardDescription>
          We could not load your clinic profile. You can retry bootstrap or sign out safely.
        </CardDescription>
      </CardHeader>
      <CardFooter class="flex gap-3">
        <Button variant="outline" @click="retryBootstrap">Retry bootstrap</Button>
        <Button variant="destructive" @click="signOut">Sign out</Button>
      </CardFooter>
    </Card>
  </div>

  <SidebarProvider v-else>
    <Sidebar collapsible="icon">
      <SidebarHeader>
        <SidebarMenu>
          <SidebarMenuItem>
            <SidebarMenuButton size="lg" as-child>
              <NuxtLink to="/home">
                <div
                  class="bg-primary text-primary-foreground flex aspect-square size-8 items-center justify-center rounded-lg"
                >
                  <Building2 class="size-4" />
                </div>
                <div class="grid flex-1 text-left text-sm leading-tight">
                  <span class="truncate font-semibold">{{ clinic?.name ?? 'MedPractice' }}</span>
                  <span class="text-muted-foreground truncate text-xs">Clinic Management</span>
                </div>
              </NuxtLink>
            </SidebarMenuButton>
          </SidebarMenuItem>
        </SidebarMenu>
      </SidebarHeader>

      <SidebarContent>
        <SidebarGroup>
          <SidebarGroupLabel>Navigation</SidebarGroupLabel>
          <SidebarGroupContent>
            <SidebarMenu>
              <SidebarMenuItem v-for="item in navItems" :key="item.title">
                <SidebarMenuButton as-child :is-active="isActive(item.to)">
                  <NuxtLink :to="item.to">
                    <component :is="item.icon" />
                    <span>{{ item.title }}</span>
                  </NuxtLink>
                </SidebarMenuButton>
              </SidebarMenuItem>
            </SidebarMenu>
          </SidebarGroupContent>
        </SidebarGroup>

        <SidebarGroup>
          <SidebarGroupLabel>Settings</SidebarGroupLabel>
          <SidebarGroupContent>
            <SidebarMenu>
              <SidebarMenuItem>
                <SidebarMenuButton as-child :is-active="isActive('/settings')">
                  <NuxtLink to="/settings">
                    <Settings />
                    <span>Settings</span>
                  </NuxtLink>
                </SidebarMenuButton>
                <SidebarMenuBadge v-if="isAdmin">Admin</SidebarMenuBadge>
              </SidebarMenuItem>
            </SidebarMenu>
          </SidebarGroupContent>
        </SidebarGroup>
      </SidebarContent>

      <SidebarFooter>
        <SidebarMenu>
          <SidebarMenuItem>
            <DropdownMenu>
              <DropdownMenuTrigger as-child>
                <SidebarMenuButton
                  size="lg"
                  class="data-[state=open]:bg-sidebar-accent data-[state=open]:text-sidebar-accent-foreground"
                >
                  <Avatar class="h-8 w-8 rounded-lg">
                    <AvatarFallback class="rounded-lg">{{ initials }}</AvatarFallback>
                  </Avatar>
                  <div class="grid flex-1 text-left text-sm leading-tight">
                    <span class="truncate font-semibold">{{ profile?.full_name }}</span>
                    <span class="text-muted-foreground truncate text-xs">{{ profile?.email }}</span>
                  </div>
                  <ChevronsUpDown class="ml-auto size-4" />
                </SidebarMenuButton>
              </DropdownMenuTrigger>
              <DropdownMenuContent
                class="w-[--reka-popper-anchor-width] min-w-56 rounded-lg"
                side="bottom"
                align="end"
                :side-offset="4"
              >
                <DropdownMenuLabel class="p-0 font-normal">
                  <div class="flex items-center gap-2 px-1 py-1.5 text-left text-sm">
                    <Avatar class="h-8 w-8 rounded-lg">
                      <AvatarFallback class="rounded-lg">{{ initials }}</AvatarFallback>
                    </Avatar>
                    <div class="grid flex-1 text-left text-sm leading-tight">
                      <span class="truncate font-semibold">{{ profile?.full_name }}</span>
                      <span class="text-muted-foreground truncate text-xs">
                        {{ isAdmin ? 'Administrator' : 'Staff' }}
                      </span>
                    </div>
                  </div>
                </DropdownMenuLabel>
                <DropdownMenuSeparator />
                <DropdownMenuItem as-child>
                  <NuxtLink to="/settings">
                    <Settings class="mr-2 h-4 w-4" />
                    Settings
                  </NuxtLink>
                </DropdownMenuItem>
                <DropdownMenuSeparator />
                <DropdownMenuItem @click="signOut">
                  <LogOut class="mr-2 h-4 w-4" />
                  Sign out
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
          </SidebarMenuItem>
        </SidebarMenu>
      </SidebarFooter>
      <SidebarRail />
    </Sidebar>

    <SidebarInset>
      <header class="flex h-14 shrink-0 items-center gap-2 border-b px-4">
        <SidebarTrigger class="-ml-1" />
        <Separator orientation="vertical" class="mr-2 h-4" />
        <div class="flex-1" />
        <ThemeToggle />
      </header>
      <main class="flex-1 p-4 md:p-6">
        <slot />
      </main>
    </SidebarInset>
  </SidebarProvider>
</template>

<script setup lang="ts">
import {
  LayoutDashboard,
  Users,
  CalendarDays,
  ClipboardList,
  Receipt,
  Settings,
  LogOut,
  ChevronsUpDown,
  Building2,
} from 'lucide-vue-next'
import ThemeToggle from '~/components/layout/ThemeToggle.vue'

const { ensureBootstrapped, bootstrapStatus, profile, clinic, signOut, isAdmin } = useAuth()
const route = useRoute()

await ensureBootstrapped()

if (bootstrapStatus.value === 'needs_onboarding') {
  await navigateTo('/onboarding', { replace: true })
}

const navItems = [
  { title: 'Home', icon: LayoutDashboard, to: '/home' },
  { title: 'Patients', icon: Users, to: '/patients' },
  { title: 'Appointments', icon: CalendarDays, to: '/appointments' },
  { title: 'Treatments', icon: ClipboardList, to: '/treatments' },
  { title: 'Billing', icon: Receipt, to: '/billing' },
]

const initials = computed(() => {
  const name = profile.value?.full_name ?? ''
  return name
    .split(' ')
    .map((part) => part[0] ?? '')
    .join('')
    .toUpperCase()
    .slice(0, 2)
})

function isActive(to: string) {
  return route.path === to || route.path.startsWith(to + '/')
}

async function retryBootstrap() {
  await ensureBootstrapped({ force: true })
}
</script>
