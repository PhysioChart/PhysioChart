# MedPractice

B2B SaaS for physiotherapy clinic management — appointments, patient records, billing, treatment tracking, staff management.

## Tech Stack

- **Framework**: Nuxt 4.3 / Vue 3.5 / TypeScript (strict mode)
- **Styling**: Tailwind CSS v4 + shadcn-vue (zinc theme, new-york style)
- **Backend**: Supabase (hosted) via `@supabase/supabase-js` client SDK
- **Icons**: lucide-vue-next
- **UI Primitives**: Reka UI (underlying shadcn-vue headless components)
- **Forms**: vee-validate + zod
- **Toasts**: vue-sonner

## Project Structure

```
MedPractice/
├── app/
│   ├── assets/css/main.css          # Tailwind + shadcn CSS variables
│   ├── components/
│   │   ├── ui/                      # shadcn-vue (CLI-managed, NEVER manually edit)
│   │   ├── common/                  # Shared components used across 2+ features
│   │   ├── appointments/            # Appointment domain components
│   │   ├── patients/                # Patient domain components
│   │   ├── billing/                 # Billing domain components
│   │   └── treatments/              # Treatment domain components
│   ├── composables/                 # useSupabase, useAuth, useCalendar
│   ├── enums/                       # Domain enums (one file per domain)
│   ├── layouts/                     # auth.vue (public), default.vue (sidebar)
│   ├── lib/                         # Pure utility functions (formatters, cn())
│   ├── middleware/                   # Route middleware (numbered prefix)
│   ├── pages/                       # File-based routing
│   │   ├── login.vue, register.vue
│   │   ├── dashboard.vue
│   │   ├── patients/ (index, [id])
│   │   ├── appointments.vue
│   │   ├── treatments.vue
│   │   ├── billing.vue
│   │   └── settings.vue
│   ├── services/                    # Supabase query wrappers (one per domain)
│   └── types/
│       ├── database.ts              # Supabase-generated DB types
│       └── models/                  # Domain model interfaces (joined/computed)
├── supabase/migrations/             # SQL schema + RLS policies
├── server/api/                      # Nitro server routes
├── components.json                  # shadcn-vue config
├── nuxt.config.ts
└── .env.example
```

## Commands

- `npm run dev` — start dev server (localhost:3000)
- `npm run build` — production build
- `npx nuxi typecheck` — TypeScript type checking
- `npx shadcn-vue@latest add <component>` — add a shadcn component

## Conventions

- **Components**: PascalCase in `app/components/`
- **shadcn components**: added via CLI to `app/components/ui/`, never manually created
- **Pages**: kebab-case files in `app/pages/`
- **Composables**: `use` prefix, in `app/composables/`
- **Enums**: one file per domain in `app/enums/`, import from `~/enums/{domain}.enum`
- **Services**: one file per domain in `app/services/`, import from `~/services/{domain}.service`
- **Types**: import `Tables`, `InsertDto`, `UpdateDto` from `~/types/database`. Import domain models from `~/types/models/{domain}.types`
- **Locale**: Always use `'en-IN'` for all `toLocaleDateString`, `toLocaleTimeString`, and `toLocaleString` calls. This will be swapped for i18n later, so consistent usage now makes migration easier.
- **Vue SFC order**: `<template>` → `<script>` → `<style>` (always in this order)
- **Utilities**: Reusable/common functions (e.g. `formatDate`, `formatCurrency`) go in `app/lib/` so they can be imported anywhere. Don't duplicate helpers inline across components.

## Auth & Multi-tenancy

- Supabase Auth with email/password
- Signup creates a clinic + admin profile via `create_clinic_and_admin` RPC
- All tables have `clinic_id` with RLS policies for tenant isolation
- Roles: `admin` (clinic owner) and `staff` (therapist/receptionist)
- Auth middleware: `app/middleware/auth.global.ts` — public pages: `/login`, `/register`
- `useAuth()` composable: `user`, `profile`, `clinic`, `isAdmin`, `signIn`, `signUp`, `signOut`

## Database

- Schema: `supabase/migrations/001_initial_schema.sql` (run in Supabase SQL Editor)
- Tables: clinics, profiles, patients, treatment_plans, appointments, treatment_sessions, invoices, payments, expenses
- RLS helper functions: `get_user_clinic_id()`, `is_clinic_admin()`
- Auto-trigger: new auth user → auto-creates profile row

## Supabase Free Tier (MANDATORY)

**Before ANY change that touches Supabase (schema, data, storage, RLS, auth, edge functions, realtime, or frontend code that calls Supabase):**

1. Read `dev.md` and follow the pre-change checklist
2. Warn in chat about any free-tier impact before proceeding
3. Do NOT add unnecessary features that consume quotas (extra indexes, realtime subscriptions, frequent edge function calls, large file uploads)

This project uses Supabase Free plan — 500 MB DB, 1 GB storage, 10 GB egress, 500k edge function calls/month. See `dev.md` for full limits and emergency procedures.

## Migration Documentation Rule (MANDATORY)

- If any file in `supabase/migrations/` is added, removed, or modified, update the migration runbook in `README.md` in the same change.
- The README update must include:
  - exact migration order
  - what each changed migration does
  - any special execution notes (for example: separate transactions, data cleanup behavior, manual steps)

## Code Rules

- **Loading states**: Any async function that sets a loading/submitting flag MUST use `try/catch/finally`. Set the flag `true` before `try`, set it `false` in `finally`. Never set it inline after an `await`.
- **Lazy-load secondary data**: Only fetch what the page needs on mount. Defer dropdowns, lookups, and supporting data until the user actually needs them (e.g. opening a dialog, switching tabs).
- **Page size and decomposition**: Keep page SFCs focused on orchestration. If a page approaches 300 lines, extract domain UI sections into `app/components/{domain}/` and move page-specific logic into a `use{Page}...` composable unless true global shared state is needed.
- **Service tenant scoping**: In services, always apply `.eq('clinic_id', clinicId)` for tenant-owned tables in addition to record-level filters (defense-in-depth), and include `clinicId` in method signatures where required.
- **Supabase changes checklist**: Before changing any Supabase query/schema/RLS/auth/storage behavior, read `dev.md` and explicitly mention expected free-tier impact in chat before implementation.
- **No duplicate computation in templates**: Don't call the same function twice for different props (`:top="fn(x).top" :height="fn(x).height"`). Pre-compute into a mapped array or computed property.
- **Await before resetting UI**: When an async action completes (e.g. form submit), await the data refresh first, then reset the form/close the dialog — not the other way around.
- **Clamp computed positions**: Any pixel math derived from data (e.g. calendar grids) must clamp values to valid bounds. Never assume data falls within the visible range.
- **Accessibility on interactive elements**: Any clickable `<div>` or non-semantic element must have `role="button"`, `tabindex="0"`, `aria-label`, and a `@keydown.enter` handler.

### Page/Composable Data Flow

- Pages and composables should orchestrate state and UI only.
- Data queries must go through services/stores, not inline Supabase queries in pages.
- Prefer this flow: `page/composable -> store/service -> supabase`.

### Async Flag Pattern

- Any async function using `isLoading` / `isSubmitting` must follow:
  1. Set flag `true` before `try`
  2. Handle error in `catch`
  3. Set flag `false` in `finally`
- Never set loading flags back to `false` inline right after an `await`.

### Mutation Refresh Order

- After create/update/delete/archive/deactivate:
  1. `await` data refresh first
  2. Then close dialog / reset form / navigate
- Do not reset UI before fresh data is loaded.

### Date Key Standard

- For date-only comparison keys (e.g., `YYYY-MM-DD`), use the shared helper in `app/lib/date.ts` (e.g., `toLocalDateKey`).
- Do not use locale hacks like `toLocaleDateString('en-CA')` for key generation.
- Keep user-facing formatting on `'en-IN'` for `toLocaleDateString`, `toLocaleTimeString`, and `toLocaleString`.

## Node.js

- Requires Node.js >= 22 (see `.nvmrc`)
- Use `nvm use` to switch to the correct version

## Enum Conventions

Enums live in `app/enums/` with one file per domain. They replace inline string unions and hardcoded status strings.

### File naming

`{domain}.enum.ts` — e.g., `appointment.enum.ts`, `invoice.enum.ts`, `payment.enum.ts`

### Structure

Use `const` objects with `as const` (not the TS `enum` keyword). Export the const object, a derived type, a labels map, and a values array.

```ts
// app/enums/appointment.enum.ts

export const AppointmentStatus = {
  SCHEDULED: 'scheduled',
  COMPLETED: 'completed',
  CANCELLED: 'cancelled',
  NO_SHOW: 'no_show',
} as const

export type AppointmentStatus = (typeof AppointmentStatus)[keyof typeof AppointmentStatus]

export const APPOINTMENT_STATUS_VALUES = Object.values(AppointmentStatus)

export const APPOINTMENT_STATUS_LABELS: Record<AppointmentStatus, string> = {
  [AppointmentStatus.SCHEDULED]: 'Scheduled',
  [AppointmentStatus.COMPLETED]: 'Completed',
  [AppointmentStatus.CANCELLED]: 'Cancelled',
  [AppointmentStatus.NO_SHOW]: 'No Show',
}
```

### Usage

```ts
// Good — use enum reference
if (appointment.status === AppointmentStatus.COMPLETED) { ... }

// Bad — hardcoded string
if (appointment.status === 'completed') { ... }
```

### When to create an enum

- The value set appears in 2+ files (status filters, badge colors, form selects)
- The database column has a constrained set of values

### Enums to create

| File                  | Keys                                                              |
| --------------------- | ----------------------------------------------------------------- |
| `appointment.enum.ts` | `SCHEDULED`, `COMPLETED`, `CANCELLED`, `NO_SHOW`                  |
| `treatment.enum.ts`   | `ACTIVE`, `COMPLETED`, `CANCELLED`                                |
| `invoice.enum.ts`     | `DRAFT`, `SENT`, `PAID`, `PARTIALLY_PAID`, `OVERDUE`, `CANCELLED` |
| `payment.enum.ts`     | `CASH`, `UPI`, `CARD`, `BANK_TRANSFER`, `OTHER`                   |
| `user-role.enum.ts`   | `ADMIN`, `STAFF`                                                  |
| `gender.enum.ts`      | `MALE`, `FEMALE`, `OTHER`                                         |

## Type Conventions

### File organization

- `app/types/database.ts` — Supabase-generated types only. Do not add manual types here (except `Tables`, `InsertDto`, `UpdateDto` helpers).
- `app/types/models/{domain}.types.ts` — Domain model interfaces for joined/computed types used across components.

### Naming rules

| Category                      | Convention                  | Example                     |
| ----------------------------- | --------------------------- | --------------------------- |
| Interfaces (object shapes)    | `I` prefix + PascalCase     | `IAppointmentWithRelations` |
| Type aliases (unions, mapped) | PascalCase, no prefix       | `AppointmentStatus`         |
| DB row types                  | Use `Tables<'table'>`       | `Tables<'patients'>`        |
| DB insert types               | Use `InsertDto<'table'>`    | `InsertDto<'appointments'>` |
| Props interfaces              | `I{Component}Props`         | `ICalendarDayViewProps`     |
| Emit interfaces               | `I{Component}Emits`         | `ICalendarDayViewEmits`     |
| Zod form schemas              | camelCase + `Schema` suffix | `appointmentFormSchema`     |

### Example

```ts
// app/types/models/appointment.types.ts
import type { Tables } from '~/types/database'
import type { AppointmentStatus } from '~/enums/appointment.enum'

export interface IAppointmentWithRelations extends Tables<'appointments'> {
  patient: Tables<'patients'> | null
  therapist: Tables<'profiles'> | null
}

export interface IAppointmentFilters {
  status?: AppointmentStatus
  therapistId?: string
  dateFrom?: string
  dateTo?: string
}
```

### Rules

- Never use `any`. Use `unknown` and narrow, or define a specific type.
- Prefer `interface` for object shapes (extendable, better error messages). Use `type` for unions, intersections, and mapped types.
- For Supabase query results with joins, define a named interface in `app/types/models/` rather than using inline `(Tables<'x'> & { rel: Tables<'y'> | null })`.

## Service Layer

Services encapsulate all Supabase data operations for a domain. Pages and composables call service functions instead of building Supabase queries inline.

### File naming

`app/services/{domain}.service.ts` — e.g., `patient.service.ts`, `appointment.service.ts`

### Pattern

Each service is a plain function that takes the Supabase client and returns typed methods. Services are stateless (no `ref`, no `reactive`).

```ts
// app/services/patient.service.ts
import type { SupabaseClient } from '@supabase/supabase-js'
import type { Database, Tables, InsertDto } from '~/types/database'

export function patientService(supabase: SupabaseClient<Database>) {
  async function list(clinicId: string): Promise<Tables<'patients'>[]> {
    const { data, error } = await supabase
      .from('patients')
      .select('*')
      .eq('clinic_id', clinicId)
      .eq('is_archived', false)
      .order('created_at', { ascending: false })

    if (error) throw error
    return data ?? []
  }

  async function getById(id: string): Promise<Tables<'patients'> | null> {
    const { data, error } = await supabase.from('patients').select('*').eq('id', id).single()

    if (error) throw error
    return data
  }

  async function create(patient: InsertDto<'patients'>): Promise<Tables<'patients'>> {
    const { data, error } = await supabase.from('patients').insert(patient).select().single()

    if (error) throw error
    return data
  }

  async function update(id: string, updates: Partial<Tables<'patients'>>): Promise<void> {
    const { error } = await supabase.from('patients').update(updates).eq('id', id)

    if (error) throw error
  }

  return { list, getById, create, update }
}
```

### Usage in a page

```ts
const supabase = useSupabase()
const { profile } = useAuth()
const patients = patientService(supabase)

const data = await patients.list(profile.value!.clinic_id)
```

### Rules

- Services **always throw** on error. They never call `toast()` or handle UI.
- Services receive `clinicId` as a parameter — they do **not** call `useAuth()` (services are not composables).
- Every public method has explicit parameter types and return types.
- Services do NOT hold state. They are pure async query wrappers.
- Always apply `.eq('clinic_id', clinicId)` in queries for multi-tenancy defense-in-depth (even though RLS is the primary guard).

### Services to create

| File                     | Methods                                                    |
| ------------------------ | ---------------------------------------------------------- |
| `patient.service.ts`     | `list`, `getById`, `create`, `update`, `archive`, `search` |
| `appointment.service.ts` | `list`, `listForDate`, `create`, `updateStatus`, `delete`  |
| `treatment.service.ts`   | `list`, `getById`, `create`, `update`                      |
| `invoice.service.ts`     | `list`, `create`, `nextInvoiceNumber`                      |
| `payment.service.ts`     | `listForInvoice`, `create`                                 |
| `clinic.service.ts`      | `get`, `update`                                            |
| `staff.service.ts`       | `list`, `invite`, `deactivate`                             |

## Store Conventions

Use Pinia stores for cross-page shared state. Keep route-local UI state in pages/composables.

- **Syntax**: Stores must use Pinia setup syntax only: `defineStore('name', () => {})`.
- **Scope**: Put shared clinic lists and reused domain data in stores; keep page-only state (`activeTab`, dialog open flags, local form drafts) local.
- **Data boundary**: Stores call service functions in `app/services/`; no raw Supabase queries in stores/pages.
- **Tenant safety**: Store actions for tenant-owned data must require `clinicId` and pass it through to service methods.
- **Caching policy**: Use TTL + SWR by default (serve cache, background refresh when stale). Expose `fetch*`, `refresh*`, and `invalidate` actions.
- **Mutation coherence**: After create/update/archive/deactivate, upsert or invalidate the relevant store cache.
- **Auth transitions**: Clear clinic-scoped caches on sign-out and clinic switch.
- **Meta shape**: Standardize per-clinic cache meta as `loadedAt`, `isLoading`, `error`.
- **Naming**: `app/stores/{domain}.store.ts`, accessor `use{Domain}Store`, and use `storeToRefs` in components/pages.
- **Persistence**: Do not enable localStorage/session persistence by default unless explicitly required and documented.

## Component Organization

### Directory structure

```
app/components/
├── ui/                    # shadcn-vue primitives (CLI-managed, NEVER edit)
├── common/                # Shared components used across 2+ features
│   ├── EmptyState.vue
│   ├── PageHeader.vue
│   ├── StatusBadge.vue
│   └── ConfirmDialog.vue
├── appointments/          # Appointment domain
│   ├── AppointmentDetailSheet.vue
│   ├── AppointmentBookingDialog.vue
│   ├── CalendarDayView.vue
│   └── CalendarWeekView.vue
├── patients/              # Patient domain
│   ├── PatientCreateDialog.vue
│   └── PatientEditForm.vue
├── billing/               # Billing domain
│   ├── InvoiceCreateDialog.vue
│   └── InvoiceLineItems.vue
└── treatments/            # Treatment domain
    └── TreatmentCreateDialog.vue
```

### Naming

- PascalCase filenames matching the component name: `AppointmentDetailSheet.vue`
- Feature prefix for domain components: `Appointment*`, `Patient*`, `Invoice*`
- No `The` prefix

### When to extract a component

1. A template section exceeds ~80 lines
2. The same UI pattern appears in 2+ pages
3. The component has its own logical state (props in, events out)

### Sizing targets

- **Pages** (`app/pages/`): orchestrate layout, call services, manage page-level state. Target <200 lines of `<script>`.
- **Feature components** (`app/components/{feature}/`): self-contained with props/emits. Target <150 lines total.
- **Common components** (`app/components/common/`): fully generic, zero domain knowledge.

## Script Block Organization

Within `<script setup lang="ts">`, follow this order. Separate each section with a blank line.

```
1.  Imports (external packages, then ~/types, ~/enums, ~/services, ~/lib)
2.  Page meta (definePageMeta)
3.  Props & Emits (defineProps, defineModel, defineEmits)
4.  Composables & services (useAuth, useSupabase, patientService, etc.)
5.  Reactive state (ref, reactive — grouped: form state, UI state, data state)
6.  Computed properties
7.  Data-fetching functions (loadXxx, fetchXxx)
8.  Mutation functions (createXxx, updateXxx, deleteXxx)
9.  UI handler functions (openDialog, resetForm, handleClick)
10. Watchers (watch, watchEffect)
11. Lifecycle (onMounted, onUnmounted)
```

### Import ordering within section 1

1. External packages (`vue`, `@vueuse/core`, `lucide-vue-next`, `vue-sonner`, `zod`, `vee-validate`)
2. Types (`~/types/...`)
3. Enums (`~/enums/...`)
4. Services (`~/services/...`)
5. Lib/utils (`~/lib/...`)
6. Auto-imported composables (`useAuth`, `useSupabase`) do NOT need explicit imports

## Naming Conventions

| Category               | Convention                              | Example                            |
| ---------------------- | --------------------------------------- | ---------------------------------- |
| **Components**         | PascalCase                              | `PatientCreateDialog.vue`          |
| **Pages**              | kebab-case                              | `patients/[id].vue`                |
| **Composables**        | camelCase + `use` prefix                | `useCalendar.ts`                   |
| **Services**           | kebab-case + `.service.ts`              | `patient.service.ts`               |
| **Enum files**         | kebab-case + `.enum.ts`                 | `appointment.enum.ts`              |
| **Type files**         | kebab-case + `.types.ts`                | `appointment.types.ts`             |
| **Utility files**      | camelCase                               | `formatters.ts`                    |
| **Variables**          | camelCase                               | `isLoading`, `selectedDate`        |
| **Functions**          | camelCase                               | `loadPatients`, `handleSubmit`     |
| **Constants**          | UPPER_SNAKE_CASE                        | `SLOT_HEIGHT_PX`, `DAY_START_HOUR` |
| **Enum keys**          | UPPER_SNAKE_CASE                        | `AppointmentStatus.NO_SHOW`        |
| **Enum values**        | snake_case (matching DB)                | `'no_show'`, `'partially_paid'`    |
| **Interfaces**         | `I` prefix + PascalCase                 | `IAppointmentWithRelations`        |
| **Type aliases**       | PascalCase (no prefix)                  | `AppointmentStatus`                |
| **Zod schemas**        | camelCase + `Schema` suffix             | `appointmentFormSchema`            |
| **Loading refs**       | `isXxx` pattern                         | `isLoading`, `isSubmitting`        |
| **Visibility refs**    | `showXxx` pattern                       | `showNewDialog`, `showDetailSheet` |
| **Fetch functions**    | `loadXxx` or `fetchXxx`                 | `loadPatients()`                   |
| **Mutation functions** | `createXxx` / `updateXxx` / `deleteXxx` | `createAppointment()`              |
| **Event handlers**     | `handleXxx` or `onXxx`                  | `handleSlotClick()`, `onSubmit()`  |

## Error Handling

### Architecture: service throws → page catches → toast displays

- **Services** always `throw` the Supabase error on failure. They never call `toast` or return `{ data, error }` tuples.
- **Pages/composables** wrap service calls in `try/catch` and display errors via `toast.error()`.

### Standard fetch pattern

```ts
async function loadPatients() {
  if (!profile.value) return
  isLoading.value = true

  try {
    patients.value = await patientService(supabase).list(profile.value.clinic_id)
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : 'Failed to load patients'
    toast.error(message)
  } finally {
    isLoading.value = false
  }
}
```

### Standard mutation pattern

```ts
async function createPatient() {
  if (!profile.value) return
  isSubmitting.value = true

  try {
    await patientService(supabase).create({ ... })
    toast.success('Patient registered successfully')
    await loadPatients()          // Refresh data BEFORE closing dialog
    showNewDialog.value = false   // Close dialog AFTER data refreshed
    resetForm()
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : 'Failed to create patient'
    toast.error(message)
  } finally {
    isSubmitting.value = false
  }
}
```

### Rules

- Loading flags: set `true` before `try`, set `false` in `finally`.
- Always extract error messages: `err instanceof Error ? err.message : 'Fallback'`. Never pass raw error objects to `toast.error()`.
- No silent failures: every `catch` must either `toast.error()` or rethrow. Never use empty `catch {}`.
- `toast.success()` for successful mutations, `toast.error()` for failures.

## Data Flow Architecture

### Request/response flow

```
Page (onMounted / handler)
  → Service function (Supabase query)
    → Supabase client SDK
      → Supabase REST API (with RLS + clinic_id filter)
        → PostgreSQL

PostgreSQL
  → Supabase REST API (applies RLS)
    → Service function (throws on error, returns typed data)
      → Page (sets ref, catches error, shows toast)
        → Template (reads reactive refs)
```

### State management

MedPractice uses **local component state** (`ref`/`reactive` in pages), not Pinia stores. Auth is the only global state (via `useAuth()` composable singleton).

Introduce a Pinia store only when:

- 2+ pages need to read/write the same reactive data simultaneously
- Offline caching or optimistic updates are needed
- Realtime subscriptions need a single shared listener

### Data loading patterns

1. **Primary data**: load in `onMounted`. Set `isLoading = true` before, `false` in `finally`.
2. **Dropdown/lookup data**: lazy-load when dialog opens. Guard with a `dropdownsLoaded` flag to avoid re-fetching.
3. **Joined data**: use Supabase select joins: `.select('*, patient:patients(*), therapist:profiles(*)')`.
4. **Count-only**: use `{ count: 'exact', head: true }` to avoid transferring rows.
5. **After mutations**: always re-fetch the list (`await loadXxx()`) rather than optimistically patching local arrays.

### Form data flow

- **Complex forms** (login, register, multi-field validation): use vee-validate + zod schema → `toTypedSchema()` → `useForm()` → `handleSubmit()`.
- **Simple forms** (patient create, quick edit): use plain `ref({})` + `v-model` → `@submit.prevent` handler.
