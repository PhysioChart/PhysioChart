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
│   ├── assets/css/main.css        # Tailwind + shadcn CSS variables
│   ├── components/ui/             # shadcn-vue components (added via CLI)
│   ├── composables/               # useSupabase, useAuth
│   ├── layouts/                   # auth.vue (public), default.vue (sidebar)
│   ├── lib/utils.ts               # cn() utility
│   ├── middleware/auth.global.ts   # Auth guard (redirects to /login)
│   ├── pages/                     # File-based routing
│   │   ├── login.vue, register.vue
│   │   ├── dashboard.vue
│   │   ├── patients/ (index, [id])
│   │   ├── appointments.vue
│   │   ├── treatments.vue
│   │   ├── billing.vue
│   │   └── settings.vue
│   └── types/database.ts          # Supabase DB types
├── supabase/migrations/           # SQL schema + RLS policies
├── server/api/                    # Nitro server routes
├── components.json                # shadcn-vue config
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
- **Types**: import `Tables`, `InsertDto`, `UpdateDto` from `~/types/database`
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

## Code Rules

- **Loading states**: Any async function that sets a loading/submitting flag MUST use `try/catch/finally`. Set the flag `true` before `try`, set it `false` in `finally`. Never set it inline after an `await`.
- **Lazy-load secondary data**: Only fetch what the page needs on mount. Defer dropdowns, lookups, and supporting data until the user actually needs them (e.g. opening a dialog, switching tabs).
- **No duplicate computation in templates**: Don't call the same function twice for different props (`:top="fn(x).top" :height="fn(x).height"`). Pre-compute into a mapped array or computed property.
- **Await before resetting UI**: When an async action completes (e.g. form submit), await the data refresh first, then reset the form/close the dialog — not the other way around.
- **Clamp computed positions**: Any pixel math derived from data (e.g. calendar grids) must clamp values to valid bounds. Never assume data falls within the visible range.
- **Accessibility on interactive elements**: Any clickable `<div>` or non-semantic element must have `role="button"`, `tabindex="0"`, `aria-label`, and a `@keydown.enter` handler.

## Node.js

- Requires Node.js >= 22 (see `.nvmrc`)
- Use `nvm use` to switch to the correct version
