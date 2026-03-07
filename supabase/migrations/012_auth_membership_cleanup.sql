-- Finalize the auth + membership migration after the rollout compatibility window.

drop trigger if exists on_auth_user_created on auth.users;
drop function if exists public.handle_new_user_compat();
drop function if exists public.handle_new_user();

drop trigger if exists sync_profile_active_to_membership on public.profiles;
drop function if exists public.sync_profile_active_to_membership();

drop function if exists public.create_clinic_and_admin(text, text, text, text);

create or replace function public.is_member_of_clinic(target_clinic_id uuid)
returns boolean
language sql
security definer
stable
set search_path = ''
as $$
  select exists (
    select 1
    from public.clinic_memberships membership
    where membership.user_id = auth.uid()
      and membership.clinic_id = target_clinic_id
      and membership.ended_at is null
  );
$$;

create or replace function public.is_admin_of_clinic(target_clinic_id uuid)
returns boolean
language sql
security definer
stable
set search_path = ''
as $$
  select exists (
    select 1
    from public.clinic_memberships membership
    where membership.user_id = auth.uid()
      and membership.clinic_id = target_clinic_id
      and membership.role = 'admin'
      and membership.ended_at is null
  );
$$;

create or replace function public.get_user_clinic_id()
returns uuid
language sql
security definer
stable
set search_path = ''
as $$
  select membership.clinic_id
  from public.profiles profile
  join public.clinic_memberships membership
    on membership.id = profile.default_membership_id
   and membership.user_id = profile.id
   and membership.ended_at is null
  where profile.id = auth.uid();
$$;

create or replace function public.is_clinic_admin()
returns boolean
language sql
security definer
stable
set search_path = ''
as $$
  select exists (
    select 1
    from public.profiles profile
    join public.clinic_memberships membership
      on membership.id = profile.default_membership_id
     and membership.user_id = profile.id
     and membership.ended_at is null
    where profile.id = auth.uid()
      and membership.role = 'admin'
  );
$$;

drop policy if exists "Users can view their clinic" on public.clinics;
drop policy if exists "Admins can update their clinic" on public.clinics;
drop policy if exists "Users can view clinic profiles" on public.profiles;
drop policy if exists "Users can update own profile" on public.profiles;
drop policy if exists "Admins can insert profiles" on public.profiles;
drop policy if exists "Admins can delete profiles" on public.profiles;
drop policy if exists "Users can view clinic patients" on public.patients;
drop policy if exists "Users can insert clinic patients" on public.patients;
drop policy if exists "Users can update clinic patients" on public.patients;
drop policy if exists "Users can view clinic treatment plans" on public.treatment_plans;
drop policy if exists "Users can insert clinic treatment plans" on public.treatment_plans;
drop policy if exists "Users can update clinic treatment plans" on public.treatment_plans;
drop policy if exists "Users can view clinic appointments" on public.appointments;
drop policy if exists "Users can insert clinic appointments" on public.appointments;
drop policy if exists "Users can update clinic appointments" on public.appointments;
drop policy if exists "Users can view clinic sessions" on public.treatment_sessions;
drop policy if exists "Users can insert clinic sessions" on public.treatment_sessions;
drop policy if exists "Users can update clinic sessions" on public.treatment_sessions;
drop policy if exists "Users can view clinic invoices" on public.invoices;
drop policy if exists "Users can insert clinic invoices" on public.invoices;
drop policy if exists "Users can update clinic invoices" on public.invoices;
drop policy if exists "Users can view clinic payments" on public.payments;
drop policy if exists "Users can insert clinic payments" on public.payments;
drop policy if exists "Users can view clinic expenses" on public.expenses;
drop policy if exists "Users can insert clinic expenses" on public.expenses;
drop policy if exists "Users can update clinic expenses" on public.expenses;
drop policy if exists "Admins can delete clinic expenses" on public.expenses;
drop policy if exists "Users can view own or clinic memberships" on public.clinic_memberships;

create policy "Users can view their clinic"
  on public.clinics for select
  using (public.is_member_of_clinic(id));

create policy "Admins can update their clinic"
  on public.clinics for update
  using (public.is_admin_of_clinic(id));

create policy "Users can view clinic profiles"
  on public.profiles for select
  using (
    id = auth.uid()
    or exists (
      select 1
      from public.clinic_memberships viewer_membership
      join public.clinic_memberships target_membership
        on target_membership.clinic_id = viewer_membership.clinic_id
       and target_membership.user_id = public.profiles.id
       and target_membership.ended_at is null
      where viewer_membership.user_id = auth.uid()
        and viewer_membership.ended_at is null
    )
  );

create policy "Users can update own profile"
  on public.profiles for update
  using (id = auth.uid());

create policy "Users can view own or clinic memberships"
  on public.clinic_memberships for select
  using (
    user_id = auth.uid()
    or public.is_member_of_clinic(clinic_id)
  );

create policy "Users can view clinic patients"
  on public.patients for select
  using (public.is_member_of_clinic(clinic_id));

create policy "Users can insert clinic patients"
  on public.patients for insert
  with check (public.is_member_of_clinic(clinic_id));

create policy "Users can update clinic patients"
  on public.patients for update
  using (public.is_member_of_clinic(clinic_id));

create policy "Users can view clinic treatment plans"
  on public.treatment_plans for select
  using (public.is_member_of_clinic(clinic_id));

create policy "Users can insert clinic treatment plans"
  on public.treatment_plans for insert
  with check (public.is_member_of_clinic(clinic_id));

create policy "Users can update clinic treatment plans"
  on public.treatment_plans for update
  using (public.is_member_of_clinic(clinic_id));

create policy "Users can view clinic appointments"
  on public.appointments for select
  using (public.is_member_of_clinic(clinic_id));

create policy "Users can insert clinic appointments"
  on public.appointments for insert
  with check (public.is_member_of_clinic(clinic_id));

create policy "Users can update clinic appointments"
  on public.appointments for update
  using (public.is_member_of_clinic(clinic_id));

create policy "Users can view clinic sessions"
  on public.treatment_sessions for select
  using (public.is_member_of_clinic(clinic_id));

create policy "Users can insert clinic sessions"
  on public.treatment_sessions for insert
  with check (public.is_member_of_clinic(clinic_id));

create policy "Users can update clinic sessions"
  on public.treatment_sessions for update
  using (public.is_member_of_clinic(clinic_id));

create policy "Users can view clinic invoices"
  on public.invoices for select
  using (public.is_member_of_clinic(clinic_id));

create policy "Users can insert clinic invoices"
  on public.invoices for insert
  with check (public.is_member_of_clinic(clinic_id));

create policy "Users can update clinic invoices"
  on public.invoices for update
  using (public.is_member_of_clinic(clinic_id));

create policy "Users can view clinic payments"
  on public.payments for select
  using (public.is_member_of_clinic(clinic_id));

create policy "Users can insert clinic payments"
  on public.payments for insert
  with check (public.is_member_of_clinic(clinic_id));

create policy "Users can view clinic expenses"
  on public.expenses for select
  using (public.is_member_of_clinic(clinic_id));

create policy "Users can insert clinic expenses"
  on public.expenses for insert
  with check (public.is_member_of_clinic(clinic_id));

create policy "Users can update clinic expenses"
  on public.expenses for update
  using (public.is_member_of_clinic(clinic_id));

create policy "Admins can delete clinic expenses"
  on public.expenses for delete
  using (public.is_admin_of_clinic(clinic_id));

create or replace function public.complete_registration(
  clinic_name text,
  full_name text
)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_user_id uuid := auth.uid();
  v_email text := auth.jwt()->>'email';
  v_existing public.owner_onboardings%rowtype;
  v_clinic_id uuid;
  v_membership_id uuid;
begin
  if v_user_id is null then
    raise exception 'Authentication required';
  end if;

  perform 1 from auth.users where id = v_user_id for update;

  select *
  into v_existing
  from public.owner_onboardings
  where user_id = v_user_id;

  if found then
    return jsonb_build_object(
      'clinic_id', v_existing.clinic_id,
      'membership_id', v_existing.membership_id,
      'profile_id', v_existing.user_id
    );
  end if;

  insert into public.clinics (name)
  values (trim(clinic_name))
  returning id into v_clinic_id;

  insert into public.profiles (
    id,
    full_name,
    email,
    is_active
  )
  values (
    v_user_id,
    trim(full_name),
    v_email,
    true
  )
  on conflict (id) do update
  set
    full_name = excluded.full_name,
    email = excluded.email,
    is_active = true;

  insert into public.clinic_memberships (
    clinic_id,
    user_id,
    role
  )
  values (
    v_clinic_id,
    v_user_id,
    'admin'
  )
  on conflict (clinic_id, user_id) where ended_at is null
  do update
  set
    role = 'admin',
    ended_at = null
  returning id into v_membership_id;

  update public.profiles
  set
    default_membership_id = v_membership_id,
    is_active = true
  where id = v_user_id;

  insert into public.owner_onboardings (user_id, clinic_id, membership_id)
  values (v_user_id, v_clinic_id, v_membership_id)
  on conflict (user_id) do update
  set
    clinic_id = excluded.clinic_id,
    membership_id = excluded.membership_id;

  return jsonb_build_object(
    'clinic_id', v_clinic_id,
    'membership_id', v_membership_id,
    'profile_id', v_user_id
  );
end;
$$;

create or replace function public.create_staff_invite(
  p_email text,
  p_role public.user_role
)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_user_id uuid := auth.uid();
  v_clinic_id uuid := public.get_user_clinic_id();
  v_token text;
  v_token_hash text;
  v_invite_id uuid;
begin
  if v_user_id is null then
    raise exception 'Authentication required';
  end if;

  if v_clinic_id is null or not public.is_admin_of_clinic(v_clinic_id) then
    raise exception 'Admin access required';
  end if;

  update public.clinic_invites
  set revoked_at = now()
  where clinic_id = v_clinic_id
    and email_normalized = public.normalize_email(p_email)
    and accepted_at is null
    and revoked_at is null
    and expires_at <= now();

  v_token := encode(extensions.gen_random_bytes(32), 'hex');
  v_token_hash := encode(extensions.digest(v_token, 'sha256'), 'hex');

  insert into public.clinic_invites (
    clinic_id,
    email_normalized,
    role,
    token_hash,
    expires_at,
    invited_by_user_id
  )
  values (
    v_clinic_id,
    public.normalize_email(p_email),
    p_role,
    v_token_hash,
    now() + interval '7 days',
    v_user_id
  )
  returning id into v_invite_id;

  return jsonb_build_object(
    'clinic_invite_id', v_invite_id,
    'invite_token', v_token,
    'invite_url', '/invite/' || v_token
  );
end;
$$;

create or replace function public.get_invite_preview(
  p_invite_token text
)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_invite public.clinic_invites%rowtype;
  v_clinic_name text;
begin
  select *
  into v_invite
  from public.clinic_invites
  where token_hash = encode(extensions.digest(p_invite_token, 'sha256'), 'hex')
    and accepted_at is null
    and revoked_at is null
    and expires_at > now();

  if not found then
    return jsonb_build_object('is_valid', false);
  end if;

  select name
  into v_clinic_name
  from public.clinics
  where id = v_invite.clinic_id;

  return jsonb_build_object(
    'is_valid', true,
    'clinic_name', v_clinic_name,
    'role', v_invite.role,
    'masked_email', public.mask_email(v_invite.email_normalized),
    'expires_at', v_invite.expires_at
  );
end;
$$;

create or replace function public.accept_invite(
  p_invite_token text,
  p_full_name text
)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_user_id uuid := auth.uid();
  v_email text := public.normalize_email(auth.jwt()->>'email');
  v_invite public.clinic_invites%rowtype;
  v_membership_id uuid;
begin
  if v_user_id is null then
    raise exception 'Authentication required';
  end if;

  select *
  into v_invite
  from public.clinic_invites
  where token_hash = encode(extensions.digest(p_invite_token, 'sha256'), 'hex')
  for update;

  if not found or v_invite.accepted_at is not null or v_invite.revoked_at is not null or v_invite.expires_at <= now() then
    raise exception 'Invite is invalid or expired';
  end if;

  if v_email <> v_invite.email_normalized then
    raise exception 'Invite email does not match the signed-in user';
  end if;

  insert into public.profiles (
    id,
    full_name,
    email,
    is_active
  )
  values (
    v_user_id,
    trim(p_full_name),
    v_email,
    true
  )
  on conflict (id) do update
  set
    full_name = case
      when coalesce(trim(excluded.full_name), '') = '' then public.profiles.full_name
      else excluded.full_name
    end,
    email = excluded.email,
    is_active = true;

  insert into public.clinic_memberships (
    clinic_id,
    user_id,
    role,
    created_by_user_id
  )
  values (
    v_invite.clinic_id,
    v_user_id,
    v_invite.role,
    v_invite.invited_by_user_id
  )
  on conflict (clinic_id, user_id) where ended_at is null
  do update
  set
    role = excluded.role,
    ended_at = null
  returning id into v_membership_id;

  update public.profiles
  set
    default_membership_id = coalesce(default_membership_id, v_membership_id),
    is_active = true
  where id = v_user_id;

  update public.clinic_invites
  set
    accepted_at = coalesce(accepted_at, now()),
    accepted_by_user_id = coalesce(accepted_by_user_id, v_user_id)
  where id = v_invite.id;

  return jsonb_build_object(
    'clinic_id', v_invite.clinic_id,
    'membership_id', v_membership_id,
    'profile_id', v_user_id
  );
end;
$$;

create or replace function public.set_default_membership(
  p_membership_id uuid
)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_user_id uuid := auth.uid();
  v_membership public.clinic_memberships%rowtype;
begin
  if v_user_id is null then
    raise exception 'Authentication required';
  end if;

  select *
  into v_membership
  from public.clinic_memberships
  where id = p_membership_id
    and user_id = v_user_id
    and ended_at is null;

  if not found then
    raise exception 'Membership not found';
  end if;

  update public.profiles
  set default_membership_id = v_membership.id
  where id = v_user_id;

  return jsonb_build_object(
    'default_membership_id', v_membership.id,
    'clinic_id', v_membership.clinic_id
  );
end;
$$;

create or replace function public.deactivate_membership(
  p_membership_id uuid
)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_actor_id uuid := auth.uid();
  v_membership public.clinic_memberships%rowtype;
  v_fallback public.clinic_memberships%rowtype;
begin
  if v_actor_id is null then
    raise exception 'Authentication required';
  end if;

  select *
  into v_membership
  from public.clinic_memberships
  where id = p_membership_id
  for update;

  if not found then
    raise exception 'Membership not found';
  end if;

  if v_membership.user_id = v_actor_id then
    raise exception 'You cannot deactivate your own membership';
  end if;

  if not public.is_admin_of_clinic(v_membership.clinic_id) then
    raise exception 'Admin access required';
  end if;

  update public.clinic_memberships
  set ended_at = coalesce(ended_at, now())
  where id = p_membership_id;

  select *
  into v_fallback
  from public.clinic_memberships
  where user_id = v_membership.user_id
    and ended_at is null
  order by created_at asc, id asc
  limit 1;

  if found then
    update public.profiles
    set
      default_membership_id = v_fallback.id,
      is_active = true
    where id = v_membership.user_id;
  else
    update public.profiles
    set
      default_membership_id = null,
      is_active = false
    where id = v_membership.user_id;
  end if;

  return jsonb_build_object(
    'membership_id', v_membership.id,
    'user_id', v_membership.user_id,
    'clinic_id', v_membership.clinic_id
  );
end;
$$;

drop index if exists public.idx_profiles_clinic_id;

alter table public.profiles
  drop column if exists clinic_id,
  drop column if exists role;
