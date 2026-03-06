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
6. `supabase/migrations/006_payment_recording.sql`
7. `supabase/migrations/007_dashboard_overview.sql`
8. `supabase/migrations/008_treatment_progress_automation.sql`
9. `supabase/migrations/009_treatment_linked_appointments.sql`
10. `supabase/migrations/010_invoice_creation_from_treatment.sql`

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

6. `006_payment_recording.sql`
   - Hardens payments schema with audit/idempotency columns:
     - `payments.recorded_by`
     - `payments.idempotency_key`
   - Adds payment constraints:
     - positive amount check
     - reference note max length check
   - Adds indexes:
     - unique partial idempotency index on `(invoice_id, idempotency_key)` when key is not null
     - stable payment-history index on `(invoice_id, paid_at desc, created_at desc)`
   - Adds invoice total guard trigger:
     - blocks `invoices.total` from dropping below `invoices.amount_paid`
   - Adds atomic RPC `record_invoice_payment` with:
     - invoice status gate (`sent`, `overdue`, `partially_paid`)
     - overpayment prevention
     - deterministic status recompute (`paid`/`overdue`/`partially_paid`)
     - idempotent replay handling

7. `007_dashboard_overview.sql`
   - Adds scoped dashboard overview RPC with timezone-safe day boundaries and bounded lists.

8. `008_treatment_progress_automation.sql`
   - Adds treatment session history RPC and automates treatment status recompute in completion/reopen RPCs.

9. `009_treatment_linked_appointments.sql`
   - Adds idempotency key support for appointments.
   - Adds DB-level appointment relationship validation trigger (clinic/patient/therapist/treatment consistency).
   - Adds atomic idempotent RPC `create_treatment_linked_appointment`.
   - Adds bulk linked appointments RPC `get_treatment_linked_appointments_bulk`.
   - Adds read-optimized index for clinic + treatment-linked appointment lookups.

10. `010_invoice_creation_from_treatment.sql`

- Adds invoice idempotency key + unique partial index on `(clinic_id, idempotency_key)`.
- Adds invoice write guardrails (`NOT VALID` checks for money/line-items).
- Adds trigger-based line-item normalization and invoice relationship validation.
- Adds atomic idempotent RPC `create_invoice` for server-side invoice creation.

### 3) How to run in production (SQL Editor)

1. Open Supabase Dashboard -> Project -> SQL Editor.
2. Run file `001_initial_schema.sql`.
3. Run file `002_recurring_appointments.sql`.
4. Run file `003_doctor_conflict_enforcement.sql`.
5. After success, run file `004_doctor_conflict_atomic_series.sql`.
6. Run file `005_session_notes_completion.sql`.
7. Run file `006_payment_recording.sql`.
8. Run file `007_dashboard_overview.sql`.
9. Run file `008_treatment_progress_automation.sql`.
10. Run file `009_treatment_linked_appointments.sql`.
11. Run file `010_invoice_creation_from_treatment.sql`.

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
7. Ensure payment RPC exists:
   ```sql
   select proname
   from pg_proc
   where pronamespace = 'public'::regnamespace
     and proname = 'record_invoice_payment';
   ```
8. Ensure payment schema hardening columns exist:
   ```sql
   select column_name
   from information_schema.columns
   where table_schema = 'public'
     and table_name = 'payments'
     and column_name in ('recorded_by', 'idempotency_key');
   ```
9. Ensure invoice total guard trigger exists:
   ```sql
   select trigger_name
   from information_schema.triggers
   where event_object_schema = 'public'
     and event_object_table = 'invoices'
     and trigger_name = 'enforce_invoice_total_not_below_paid';
   ```
10. Ensure no invoice is in an impossible state (`amount_paid > total`):

```sql
select id, invoice_number, total, amount_paid
from public.invoices
where amount_paid > total;
```

11. Ensure invoice creation RPC exists:

```sql
select proname
from pg_proc
where pronamespace = 'public'::regnamespace
  and proname = 'create_invoice';
```

12. Ensure invoice idempotency key column exists:

```sql
select column_name
from information_schema.columns
where table_schema = 'public'
  and table_name = 'invoices'
  and column_name = 'idempotency_key';
```

13. Validate newly added invoice constraints during an off-hours maintenance step:

```sql
alter table public.invoices validate constraint invoices_idempotency_key_non_blank_check;
alter table public.invoices validate constraint invoices_subtotal_nonnegative_check;
alter table public.invoices validate constraint invoices_tax_nonnegative_check;
alter table public.invoices validate constraint invoices_total_nonnegative_check;
alter table public.invoices validate constraint invoices_amount_paid_nonnegative_check;
alter table public.invoices validate constraint invoices_amount_paid_lte_total_check;
alter table public.invoices validate constraint invoices_total_matches_sum_check;
alter table public.invoices validate constraint invoices_line_items_array_check;
```
