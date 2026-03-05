# MedPractice

B2B SaaS for physiotherapy clinic management — appointments, patient records, billing, treatment tracking, staff management.

---

# Tech Stack

- **Framework**: Nuxt 4.3 / Vue 3.5 / TypeScript (strict mode)
- **Styling**: Tailwind CSS v4 + shadcn-vue (zinc theme, new-york style)
- **Backend**: Supabase (hosted) via `@supabase/supabase-js` client SDK
- **Icons**: lucide-vue-next
- **UI Primitives**: Reka UI (underlying shadcn-vue headless components)
- **Forms**: vee-validate + zod
- **Toasts**: vue-sonner

---

# Architecture Defaults

These are the default architectural rules unless there is a strong reason to deviate.

- **Core mutations should be DB-first**. If a change affects multiple tables or derives a status, implement a transactional RPC.
- **Frontend writes go through services** (`app/services/*`). Pages and components must not build Supabase queries directly.
- **Never trust client scope**. Always enforce `clinic_id` filters in queries even though RLS exists.
- **Stored statuses must be updated deterministically in the write path** (do not assume background jobs exist).
- **User-triggered create actions must support idempotency** when duplicate submissions are possible.
- **Services throw errors**. UI layers handle errors and display toasts.

---

# Project Structure

```

MedPractice/
├── app/
│ ├── assets/css/main.css # Tailwind + shadcn CSS variables
│ ├── components/
│ │ ├── ui/ # shadcn-vue (CLI-managed, NEVER manually edit)
│ │ ├── common/ # Shared components used across 2+ features
│ │ ├── appointments/ # Appointment domain components
│ │ ├── patients/ # Patient domain components
│ │ ├── billing/ # Billing domain components
│ │ └── treatments/ # Treatment domain components
│ ├── composables/ # useSupabase, useAuth, useCalendar
│ ├── enums/ # Domain enums (one file per domain)
│ ├── layouts/ # auth.vue (public), default.vue (sidebar)
│ ├── lib/ # Pure utility functions (formatters, cn())
│ ├── middleware/ # Route middleware (numbered prefix)
│ ├── pages/ # File-based routing
│ │ ├── login.vue, register.vue
│ │ ├── dashboard.vue
│ │ ├── patients/ (index, [id])
│ │ ├── appointments.vue
│ │ ├── treatments.vue
│ │ ├── billing.vue
│ │ └── settings.vue
│ ├── services/ # Supabase query wrappers (one per domain)
│ └── types/
│ ├── database.ts # Supabase-generated DB types
│ └── models/ # Domain model interfaces (joined/computed)
├── supabase/migrations/ # SQL schema + RLS policies
├── server/api/ # Nitro server routes
├── components.json # shadcn-vue config
├── nuxt.config.ts
└── .env.example

```

---

# Commands

- `npm run dev` — start dev server (localhost:3000)
- `npm run build` — production build
- `npx nuxi typecheck` — TypeScript type checking
- `npx shadcn-vue@latest add <component>` — add a shadcn component

---

# Server API Usage

`server/api/` should only be used when:

- You need **server-only secrets**
- You are integrating **external APIs**
- You need **server-side processing not possible from the client**

Otherwise, call Supabase directly from services using the client SDK.

---

# Conventions

- **Components**: PascalCase in `app/components/`
- **shadcn components**: added via CLI to `app/components/ui/`, never manually created
- **Pages**: kebab-case files in `app/pages/`
- **Composables**: `use` prefix, in `app/composables/`
- **Enums**: one file per domain in `app/enums/`, import from `~/enums/{domain}.enum`
- **Services**: one file per domain in `app/services/`, import from `~/services/{domain}.service`
- **Types**: import `Tables`, `InsertDto`, `UpdateDto` from `~/types/database`. Import domain models from `~/types/models/{domain}.types`
- **Locale**: Always use `'en-IN'` for all `toLocaleDateString`, `toLocaleTimeString`, and `toLocaleString` calls.
- **Vue SFC order**: `<template>` → `<script>` → `<style>`
- **Utilities**: reusable/common helpers belong in `app/lib/`

---

# Date and Time Rules

- For **date-only business fields**, prefer database `date` columns.
- If a date must be stored in `timestamptz`, convert to **local-noon** before saving to prevent timezone shift bugs.
- For **date-only comparison keys**, use the shared helper in `app/lib/date.ts` (e.g., `toLocalDateKey`).

---

# Database

- Schema: `supabase/migrations/001_initial_schema.sql`
- Tables: clinics, profiles, patients, treatment_plans, appointments, treatment_sessions, invoices, payments, expenses
- RLS helper functions: `get_user_clinic_id()`, `is_clinic_admin()`
- Auto-trigger: new auth user → auto-creates profile row

---

# Migration Rules

- Migration files live in `supabase/migrations/`.
- Use sequential numbering: `001_`, `002_`, `003_`, etc.
- Migrations should be **idempotent-safe** when possible (`IF EXISTS`, `IF NOT EXISTS`).
- Avoid unnecessary indexes due to Supabase free-tier storage limits.
- Any migration change must update the migration runbook in `README.md`.

---

# Error Code Conventions

- Backend/system error codes must **not be hardcoded inline**.
- Define error codes in `app/enums/` and reference them via constants.
- Services map Supabase/Postgres errors to typed error codes.
- UI maps error codes to user-facing messages.

Allowed exception:

- Third-party SDK event names documented as literal strings.

---

# Auth & Multi-tenancy

- Supabase Auth with email/password
- Signup creates clinic + admin profile via `create_clinic_and_admin` RPC
- All tables include `clinic_id` with RLS policies
- Roles:
  - `admin`
  - `staff`

Auth middleware:

```

app/middleware/auth.global.ts

```

Public pages:

```

/login
/register

```

`useAuth()` composable exposes:

- `user`
- `profile`
- `clinic`
- `isAdmin`
- `signIn`
- `signUp`
- `signOut`

---

# Supabase Free Tier (MANDATORY)

Before ANY change touching Supabase:

1. Read `dev.md`
2. Warn about free-tier impact
3. Avoid unnecessary indexes, realtime listeners, edge functions, or storage

Current limits:

- 500 MB database
- 1 GB storage
- 10 GB egress
- 500k edge function calls/month

---

# Code Rules

- Async loading flags must use `try/catch/finally`.
- Lazy-load secondary data (dropdowns, lookups).
- Keep page SFCs focused on orchestration.
- Services must enforce `.eq('clinic_id', clinicId)` in queries.
- Avoid duplicate computation in templates.
- Await data refresh before resetting UI state.
- Clamp computed UI positions derived from data.
- Add accessibility attributes to clickable non-semantic elements.

---

# Page / Composable Data Flow

Preferred flow:

```

page/composable → store/service → supabase

```

Pages orchestrate UI state.
Services perform database operations.

---

# Store Conventions

MedPractice currently relies primarily on **local component state**.

Introduce Pinia only when:

- 2+ pages must share reactive state
- Offline caching or optimistic updates are required
- Realtime subscriptions require a shared listener

If stores are introduced:

- Use Pinia **setup syntax only**
- Stores call services, never Supabase directly
- Require `clinicId` in tenant-owned queries
- Clear store state on sign-out

---

# Node.js

Requires **Node.js >= 22**

Use:

```

nvm use

```

---

# Enum Conventions

Enums live in `app/enums/`.

Use `const` objects with `as const` instead of TS enums.

Example:

```ts
export const AppointmentStatus = {
  SCHEDULED: 'scheduled',
  COMPLETED: 'completed',
  CANCELLED: 'cancelled',
  NO_SHOW: 'no_show',
} as const
```

---

# Type Conventions

- `app/types/database.ts` — Supabase generated only
- `app/types/models/` — domain interfaces

Rules:

- Never use `any`
- Prefer `interface` for objects
- Use `type` for unions and mapped types

---

# Service Layer

Services encapsulate Supabase operations.

Pattern:

```ts
export function patientService(supabase: SupabaseClient<Database>) {
  async function list(clinicId: string) { ... }
  async function create(data) { ... }
  async function update(id, updates) { ... }

  return { list, create, update }
}
```

Rules:

- Services throw errors
- Services do not call `toast`
- Services are stateless
- Always filter by `clinic_id`

---

# Error Handling

Architecture:

```
service throws → page catches → toast displays
```

Standard pattern:

```ts
try {
  await serviceCall()
} catch (err: unknown) {
  const message = err instanceof Error ? err.message : 'Something went wrong'
  toast.error(message)
}
```

Rules:

- No silent failures
- Never pass raw errors to toast
- Always reset loading flags in `finally`

---

# Data Flow Architecture

```
Page
 → Service
 → Supabase SDK
 → Supabase REST
 → PostgreSQL
```

Response returns in reverse order.

---

# Form Data Flow

Complex forms:

- vee-validate
- zod schemas

Simple forms:

- `ref()` + `v-model`
- `@submit.prevent`
