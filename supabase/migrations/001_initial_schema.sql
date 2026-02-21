-- MedPractice: Initial Database Schema
-- Run this in the Supabase SQL Editor (Dashboard > SQL Editor)

-- ============================================================
-- 1. CLINICS TABLE
-- ============================================================
create table public.clinics (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  address text,
  phone text,
  email text,
  logo_url text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

-- ============================================================
-- 2. PROFILES TABLE (extends Supabase auth.users)
-- ============================================================
create type public.user_role as enum ('admin', 'staff');

create table public.profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  clinic_id uuid not null references public.clinics(id) on delete cascade,
  full_name text not null,
  email text not null,
  phone text,
  role public.user_role not null default 'staff',
  is_active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index idx_profiles_clinic_id on public.profiles(clinic_id);

-- ============================================================
-- 3. PATIENTS TABLE
-- ============================================================
create type public.gender as enum ('male', 'female', 'other');

create table public.patients (
  id uuid primary key default gen_random_uuid(),
  clinic_id uuid not null references public.clinics(id) on delete cascade,
  full_name text not null,
  phone text not null,
  email text,
  date_of_birth date,
  gender public.gender,
  address text,
  emergency_contact_name text,
  emergency_contact_phone text,
  medical_history jsonb not null default '{}',
  notes text,
  is_archived boolean not null default false,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index idx_patients_clinic_id on public.patients(clinic_id);
create index idx_patients_phone on public.patients(clinic_id, phone);
create index idx_patients_name on public.patients(clinic_id, full_name);

-- ============================================================
-- 4. TREATMENT PLANS TABLE
-- ============================================================
create type public.treatment_status as enum ('active', 'completed', 'cancelled');

create table public.treatment_plans (
  id uuid primary key default gen_random_uuid(),
  clinic_id uuid not null references public.clinics(id) on delete cascade,
  patient_id uuid not null references public.patients(id) on delete cascade,
  therapist_id uuid references public.profiles(id) on delete set null,
  name text not null,
  diagnosis text,
  treatment_type text,
  total_sessions integer not null default 1,
  completed_sessions integer not null default 0,
  price_per_session numeric(10,2),
  package_price numeric(10,2),
  status public.treatment_status not null default 'active',
  notes text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index idx_treatment_plans_clinic_id on public.treatment_plans(clinic_id);
create index idx_treatment_plans_patient_id on public.treatment_plans(patient_id);

-- ============================================================
-- 5. APPOINTMENTS TABLE
-- ============================================================
create type public.appointment_status as enum ('scheduled', 'completed', 'cancelled', 'no_show');

create table public.appointments (
  id uuid primary key default gen_random_uuid(),
  clinic_id uuid not null references public.clinics(id) on delete cascade,
  patient_id uuid not null references public.patients(id) on delete cascade,
  therapist_id uuid references public.profiles(id) on delete set null,
  treatment_plan_id uuid references public.treatment_plans(id) on delete set null,
  start_time timestamptz not null,
  end_time timestamptz not null,
  status public.appointment_status not null default 'scheduled',
  notes text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index idx_appointments_clinic_id on public.appointments(clinic_id);
create index idx_appointments_patient_id on public.appointments(patient_id);
create index idx_appointments_therapist_id on public.appointments(therapist_id);
create index idx_appointments_start_time on public.appointments(clinic_id, start_time);

-- ============================================================
-- 6. TREATMENT SESSIONS TABLE (session notes per appointment)
-- ============================================================
create table public.treatment_sessions (
  id uuid primary key default gen_random_uuid(),
  clinic_id uuid not null references public.clinics(id) on delete cascade,
  treatment_plan_id uuid not null references public.treatment_plans(id) on delete cascade,
  appointment_id uuid references public.appointments(id) on delete set null,
  session_number integer not null,
  complaints text,
  observations text,
  treatment_given text,
  exercises_prescribed text,
  next_session_plan text,
  notes text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index idx_treatment_sessions_clinic_id on public.treatment_sessions(clinic_id);
create index idx_treatment_sessions_plan_id on public.treatment_sessions(treatment_plan_id);

-- ============================================================
-- 7. INVOICES TABLE
-- ============================================================
create type public.invoice_status as enum ('draft', 'sent', 'paid', 'partially_paid', 'overdue', 'cancelled');

create table public.invoices (
  id uuid primary key default gen_random_uuid(),
  clinic_id uuid not null references public.clinics(id) on delete cascade,
  patient_id uuid not null references public.patients(id) on delete cascade,
  treatment_plan_id uuid references public.treatment_plans(id) on delete set null,
  invoice_number text not null,
  line_items jsonb not null default '[]',
  subtotal numeric(10,2) not null default 0,
  tax numeric(10,2) not null default 0,
  total numeric(10,2) not null default 0,
  amount_paid numeric(10,2) not null default 0,
  status public.invoice_status not null default 'draft',
  due_date date,
  notes text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index idx_invoices_clinic_id on public.invoices(clinic_id);
create index idx_invoices_patient_id on public.invoices(patient_id);
create unique index idx_invoices_number on public.invoices(clinic_id, invoice_number);

-- ============================================================
-- 8. PAYMENTS TABLE
-- ============================================================
create type public.payment_method as enum ('cash', 'upi', 'card', 'bank_transfer', 'other');

create table public.payments (
  id uuid primary key default gen_random_uuid(),
  clinic_id uuid not null references public.clinics(id) on delete cascade,
  invoice_id uuid not null references public.invoices(id) on delete cascade,
  amount numeric(10,2) not null,
  method public.payment_method not null default 'cash',
  notes text,
  paid_at timestamptz not null default now(),
  created_at timestamptz not null default now()
);

create index idx_payments_clinic_id on public.payments(clinic_id);
create index idx_payments_invoice_id on public.payments(invoice_id);

-- ============================================================
-- 9. EXPENSES TABLE
-- ============================================================
create table public.expenses (
  id uuid primary key default gen_random_uuid(),
  clinic_id uuid not null references public.clinics(id) on delete cascade,
  category text not null,
  description text,
  amount numeric(10,2) not null,
  expense_date date not null default current_date,
  created_at timestamptz not null default now()
);

create index idx_expenses_clinic_id on public.expenses(clinic_id);

-- ============================================================
-- 10. UPDATED_AT TRIGGER FUNCTION
-- ============================================================
create or replace function public.handle_updated_at()
returns trigger as $$
begin
  new.updated_at = now();
  return new;
end;
$$ language plpgsql;

-- Apply updated_at trigger to all tables that have it
create trigger set_updated_at before update on public.clinics
  for each row execute function public.handle_updated_at();

create trigger set_updated_at before update on public.profiles
  for each row execute function public.handle_updated_at();

create trigger set_updated_at before update on public.patients
  for each row execute function public.handle_updated_at();

create trigger set_updated_at before update on public.treatment_plans
  for each row execute function public.handle_updated_at();

create trigger set_updated_at before update on public.appointments
  for each row execute function public.handle_updated_at();

create trigger set_updated_at before update on public.treatment_sessions
  for each row execute function public.handle_updated_at();

create trigger set_updated_at before update on public.invoices
  for each row execute function public.handle_updated_at();

-- ============================================================
-- 11. AUTO-CREATE PROFILE ON SIGNUP
-- ============================================================
-- This trigger creates a profile row when a new user signs up.
-- The clinic_id and full_name must be passed as user metadata during signup.
create or replace function public.handle_new_user()
returns trigger as $$
begin
  insert into public.profiles (id, clinic_id, full_name, email, role)
  values (
    new.id,
    (new.raw_user_meta_data->>'clinic_id')::uuid,
    coalesce(new.raw_user_meta_data->>'full_name', ''),
    new.email,
    coalesce((new.raw_user_meta_data->>'role')::public.user_role, 'staff')
  );
  return new;
end;
$$ language plpgsql security definer;

create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function public.handle_new_user();

-- ============================================================
-- 12. ROW LEVEL SECURITY (RLS)
-- ============================================================

-- Helper: get current user's clinic_id
create or replace function public.get_user_clinic_id()
returns uuid as $$
  select clinic_id from public.profiles where id = auth.uid();
$$ language sql security definer stable;

-- Helper: check if current user is admin
create or replace function public.is_clinic_admin()
returns boolean as $$
  select exists (
    select 1 from public.profiles
    where id = auth.uid() and role = 'admin'
  );
$$ language sql security definer stable;

-- Enable RLS on all tables
alter table public.clinics enable row level security;
alter table public.profiles enable row level security;
alter table public.patients enable row level security;
alter table public.treatment_plans enable row level security;
alter table public.appointments enable row level security;
alter table public.treatment_sessions enable row level security;
alter table public.invoices enable row level security;
alter table public.payments enable row level security;
alter table public.expenses enable row level security;

-- CLINICS: users can read/update their own clinic
create policy "Users can view their clinic"
  on public.clinics for select
  using (id = public.get_user_clinic_id());

create policy "Admins can update their clinic"
  on public.clinics for update
  using (id = public.get_user_clinic_id() and public.is_clinic_admin());

-- PROFILES: users see their clinic's profiles, admins can manage
create policy "Users can view clinic profiles"
  on public.profiles for select
  using (clinic_id = public.get_user_clinic_id());

create policy "Users can update own profile"
  on public.profiles for update
  using (id = auth.uid());

create policy "Admins can insert profiles"
  on public.profiles for insert
  with check (clinic_id = public.get_user_clinic_id() and public.is_clinic_admin());

create policy "Admins can delete profiles"
  on public.profiles for delete
  using (clinic_id = public.get_user_clinic_id() and public.is_clinic_admin() and id != auth.uid());

-- PATIENTS: scoped to clinic_id
create policy "Users can view clinic patients"
  on public.patients for select
  using (clinic_id = public.get_user_clinic_id());

create policy "Users can insert clinic patients"
  on public.patients for insert
  with check (clinic_id = public.get_user_clinic_id());

create policy "Users can update clinic patients"
  on public.patients for update
  using (clinic_id = public.get_user_clinic_id());

-- TREATMENT PLANS: scoped to clinic_id
create policy "Users can view clinic treatment plans"
  on public.treatment_plans for select
  using (clinic_id = public.get_user_clinic_id());

create policy "Users can insert clinic treatment plans"
  on public.treatment_plans for insert
  with check (clinic_id = public.get_user_clinic_id());

create policy "Users can update clinic treatment plans"
  on public.treatment_plans for update
  using (clinic_id = public.get_user_clinic_id());

-- APPOINTMENTS: scoped to clinic_id
create policy "Users can view clinic appointments"
  on public.appointments for select
  using (clinic_id = public.get_user_clinic_id());

create policy "Users can insert clinic appointments"
  on public.appointments for insert
  with check (clinic_id = public.get_user_clinic_id());

create policy "Users can update clinic appointments"
  on public.appointments for update
  using (clinic_id = public.get_user_clinic_id());

-- TREATMENT SESSIONS: scoped to clinic_id
create policy "Users can view clinic sessions"
  on public.treatment_sessions for select
  using (clinic_id = public.get_user_clinic_id());

create policy "Users can insert clinic sessions"
  on public.treatment_sessions for insert
  with check (clinic_id = public.get_user_clinic_id());

create policy "Users can update clinic sessions"
  on public.treatment_sessions for update
  using (clinic_id = public.get_user_clinic_id());

-- INVOICES: scoped to clinic_id
create policy "Users can view clinic invoices"
  on public.invoices for select
  using (clinic_id = public.get_user_clinic_id());

create policy "Users can insert clinic invoices"
  on public.invoices for insert
  with check (clinic_id = public.get_user_clinic_id());

create policy "Users can update clinic invoices"
  on public.invoices for update
  using (clinic_id = public.get_user_clinic_id());

-- PAYMENTS: scoped to clinic_id
create policy "Users can view clinic payments"
  on public.payments for select
  using (clinic_id = public.get_user_clinic_id());

create policy "Users can insert clinic payments"
  on public.payments for insert
  with check (clinic_id = public.get_user_clinic_id());

-- EXPENSES: scoped to clinic_id
create policy "Users can view clinic expenses"
  on public.expenses for select
  using (clinic_id = public.get_user_clinic_id());

create policy "Users can insert clinic expenses"
  on public.expenses for insert
  with check (clinic_id = public.get_user_clinic_id());

create policy "Users can update clinic expenses"
  on public.expenses for update
  using (clinic_id = public.get_user_clinic_id());

create policy "Admins can delete clinic expenses"
  on public.expenses for delete
  using (clinic_id = public.get_user_clinic_id() and public.is_clinic_admin());

-- ============================================================
-- 13. SPECIAL: Allow clinic creation during signup (no auth yet)
-- ============================================================
-- During signup, the user isn't authenticated yet, so we need a
-- special insert policy. The signup flow will:
-- 1. Create clinic via service role (or this permissive insert)
-- 2. Sign up user with clinic_id in metadata
-- 3. Trigger auto-creates profile

-- We handle clinic creation in a server-side function instead:
create or replace function public.create_clinic_and_admin(
  clinic_name text,
  admin_email text,
  admin_password text,
  admin_full_name text
)
returns json as $$
declare
  new_clinic_id uuid;
begin
  -- Create the clinic
  insert into public.clinics (name)
  values (clinic_name)
  returning id into new_clinic_id;

  -- Return the clinic_id so the client can pass it to auth.signUp
  return json_build_object('clinic_id', new_clinic_id);
end;
$$ language plpgsql security definer;
