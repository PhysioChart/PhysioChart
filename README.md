# MedPractice

Physiotherapy clinic management SaaS — appointments, patient records, billing, treatment tracking, and staff management.

## Tech Stack

| Layer         | Technology                                              |
| ------------- | ------------------------------------------------------- |
| Framework     | [Nuxt 4](https://nuxt.com) / [Vue 3](https://vuejs.org) |
| Language      | TypeScript (strict)                                     |
| Styling       | [Tailwind CSS v4](https://tailwindcss.com)              |
| UI Components | [shadcn-vue](https://www.shadcn-vue.com)                |
| Backend       | [Supabase](https://supabase.com)                        |
| Icons         | [Lucide](https://lucide.dev)                            |

## Prerequisites

- Node.js >= 22 ([install via nvm](https://github.com/nvm-sh/nvm))
- A [Supabase](https://supabase.com) project (free tier works)

## Quick Start

```bash
# Switch to correct Node version
nvm use

# Install dependencies
npm install

# Copy environment variables
cp .env.example .env
# Edit .env with your Supabase project URL and anon key

# Start development server
npm run dev
```

The app will be available at [http://localhost:3000](http://localhost:3000).

## Scripts

| Command              | Description              |
| -------------------- | ------------------------ |
| `npm run dev`        | Start development server |
| `npm run build`      | Build for production     |
| `npm run preview`    | Preview production build |
| `npm run generate`   | Generate static site     |
| `npx nuxi typecheck` | Run TypeScript checks    |

## Adding UI Components

This project uses [shadcn-vue](https://www.shadcn-vue.com) — components are copied into `app/components/ui/` and fully customizable.

```bash
# Add a component
npx shadcn-vue@latest add button

# Add multiple components
npx shadcn-vue@latest add card table dialog
```

Browse available components at [shadcn-vue.com/docs/components](https://www.shadcn-vue.com/docs/components).

## Deployment

Hosted on [Vercel](https://vercel.com). Pushes to `develop` trigger preview deployments, `main` triggers production.

## Production DB Migration Runbook

Run these in order against the production Supabase project.

### 1) Full migration order (old + new)

1. `supabase/migrations/001_initial_schema.sql`
2. `supabase/migrations/002_recurring_appointments.sql`
3. `supabase/migrations/003_doctor_conflict_enforcement.sql`
4. `supabase/migrations/004_doctor_conflict_atomic_series.sql`
5. `supabase/migrations/005_session_notes_completion.sql`

Important: run `003` and `004` as separate executions in SQL Editor (or via `supabase db push` in sequence). `003` must commit before `004` because `004` uses the new enum value.

### 2) What each migration does

1. `001_initial_schema.sql`
   - Creates base schema, tables, indexes, triggers, and RLS policies.

2. `002_recurring_appointments.sql`
   - Adds recurring-series support columns/index (`series_id`, `series_index`).

3. `003_doctor_conflict_enforcement.sql`
   - Adds appointment status `checked_in` to enum `appointment_status`.

4. `004_doctor_conflict_atomic_series.sql`
   - Adds duration constraints (`end_time > start_time`, max 12 hours).
   - Auto-resolves legacy overlapping doctor appointments by cancelling later conflicting rows and appending note:
     - `[System] Auto-cancelled during overlap-enforcement migration`
   - Adds DB exclusion constraint to block same-doctor overlapping appointments for blocking statuses (`scheduled`, `checked_in`).
   - Creates RPC function `create_appointment_series` for atomic all-or-nothing recurring booking.

5. `005_session_notes_completion.sql`
   - Introduces canonical session lifecycle (`draft`, `final`, `voided`) on `treatment_sessions`.
   - Adds appointment completion/reopen metadata fields on `appointments`.
   - Backfills missing sessions for completed appointments and populates session ordering/finalization metadata.
   - Keeps legacy orphan `treatment_sessions.appointment_id` rows nullable for this release (non-destructive hardening); all new completion/reopen writes are appointment-bound.
   - Deduplicates active sessions per appointment, then enforces one active session via partial unique index:
     - `UNIQUE(appointment_id) WHERE status != 'voided'`
   - Adds bulk plan progress RPC `get_treatment_plan_progress_bulk` (no N+1 reads).
   - Replaces completion flow with atomic RPC `complete_appointment_with_session_note`.
   - Adds atomic reopen RPC `reopen_completed_appointment`.
   - Drops `treatment_plans.completed_sessions` in favor of derived progress.

### 3) How to run in production (SQL Editor)

1. Open Supabase Dashboard -> Project -> SQL Editor.
2. Run file `001_initial_schema.sql`.
3. Run file `002_recurring_appointments.sql`.
4. Run file `003_doctor_conflict_enforcement.sql`.
5. After success, run file `004_doctor_conflict_atomic_series.sql`.
6. Run file `005_session_notes_completion.sql`.

### 4) Post-migration verification

1. Same doctor + overlapping time should fail.
2. Different doctors at same time should succeed.
3. Series with one conflicting occurrence should fail atomically (no partial inserts).
4. Check for any auto-cancelled legacy rows:
   ```sql
   select id, clinic_id, therapist_id, start_time, end_time, status, notes
   from public.appointments
   where notes ilike '%Auto-cancelled during overlap-enforcement migration%';
   ```
5. Ensure no completed appointment is missing an active session:
   ```sql
   select count(*)
   from public.appointments a
   left join public.treatment_sessions ts
     on ts.appointment_id = a.id
     and ts.status <> 'voided'
   where a.status = 'completed'
     and ts.id is null;
   ```
6. Ensure no appointment has more than one active session:
   ```sql
   select appointment_id, count(*)
   from public.treatment_sessions
   where status <> 'voided'
   group by appointment_id
   having count(*) > 1;
   ```
