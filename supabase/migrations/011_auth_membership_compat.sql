-- Auth + membership compatibility layer.
-- This migration is additive so old and new clients can coexist during rollout.

create table if not exists public.clinic_memberships (
  id uuid primary key default gen_random_uuid(),
  clinic_id uuid not null references public.clinics(id) on delete cascade,
  user_id uuid not null references public.profiles(id) on delete cascade,
  role public.user_role not null default 'staff',
  created_by_user_id uuid references public.profiles(id) on delete set null,
  created_at timestamptz not null default now(),
  ended_at timestamptz
);

create unique index if not exists idx_clinic_memberships_id_user_id
  on public.clinic_memberships(id, user_id);

create unique index if not exists idx_clinic_memberships_active_user_clinic
  on public.clinic_memberships(clinic_id, user_id)
  where ended_at is null;

create index if not exists idx_clinic_memberships_user_id
  on public.clinic_memberships(user_id);

create table if not exists public.owner_onboardings (
  user_id uuid primary key references public.profiles(id) on delete cascade,
  clinic_id uuid not null unique references public.clinics(id) on delete cascade,
  membership_id uuid not null unique references public.clinic_memberships(id) on delete cascade,
  created_at timestamptz not null default now()
);

create table if not exists public.clinic_invites (
  id uuid primary key default gen_random_uuid(),
  clinic_id uuid not null references public.clinics(id) on delete cascade,
  email_normalized text not null,
  role public.user_role not null default 'staff',
  token_hash text not null unique,
  expires_at timestamptz not null,
  accepted_at timestamptz,
  revoked_at timestamptz,
  invited_by_user_id uuid not null references public.profiles(id) on delete cascade,
  accepted_by_user_id uuid references public.profiles(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create unique index if not exists idx_clinic_invites_open_invite
  on public.clinic_invites(clinic_id, email_normalized)
  where accepted_at is null and revoked_at is null;

create index if not exists idx_clinic_invites_token_hash
  on public.clinic_invites(token_hash);

alter table public.profiles
  add column if not exists default_membership_id uuid;

do $$
begin
  if not exists (
    select 1
    from pg_constraint
    where conname = 'profiles_default_membership_same_user_fkey'
  ) then
    alter table public.profiles
      add constraint profiles_default_membership_same_user_fkey
      foreign key (default_membership_id, id)
      references public.clinic_memberships (id, user_id)
      on delete set null (default_membership_id);
  end if;
end $$;

insert into public.clinic_memberships (
  clinic_id,
  user_id,
  role,
  created_at
)
select
  p.clinic_id,
  p.id,
  p.role,
  p.created_at
from public.profiles p
where p.clinic_id is not null
on conflict (clinic_id, user_id) where ended_at is null
do update
set
  role = excluded.role,
  ended_at = null;

update public.profiles p
set default_membership_id = cm.id
from public.clinic_memberships cm
where cm.user_id = p.id
  and cm.clinic_id = p.clinic_id
  and cm.ended_at is null
  and p.default_membership_id is null;

insert into public.owner_onboardings (user_id, clinic_id, membership_id, created_at)
select
  p.id,
  p.clinic_id,
  cm.id,
  p.created_at
from public.profiles p
join public.clinic_memberships cm
  on cm.user_id = p.id
 and cm.clinic_id = p.clinic_id
 and cm.ended_at is null
where p.role = 'admin'
on conflict (user_id) do nothing;

create or replace function public.normalize_email(input text)
returns text
language sql
immutable
as $$
  select lower(trim(coalesce(input, '')));
$$;

create or replace function public.mask_email(input text)
returns text
language sql
immutable
as $$
  select
    case
      when input is null or position('@' in input) = 0 then ''
      else
        left(split_part(input, '@', 1), 1)
        || repeat('*', greatest(length(split_part(input, '@', 1)) - 1, 1))
        || '@'
        || split_part(input, '@', 2)
    end;
$$;

create or replace function public.handle_clinic_invites_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

drop trigger if exists set_clinic_invites_updated_at on public.clinic_invites;

create trigger set_clinic_invites_updated_at
before update on public.clinic_invites
for each row execute function public.handle_clinic_invites_updated_at();

create or replace function public.handle_new_user_compat()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_clinic_id uuid;
  v_role public.user_role;
  v_full_name text;
  v_membership_id uuid;
begin
  v_clinic_id := nullif(new.raw_user_meta_data->>'clinic_id', '')::uuid;
  v_role := coalesce((new.raw_user_meta_data->>'role')::public.user_role, 'staff');
  v_full_name := coalesce(nullif(new.raw_user_meta_data->>'full_name', ''), split_part(new.email, '@', 1));

  if v_clinic_id is null then
    return new;
  end if;

  insert into public.profiles (
    id,
    clinic_id,
    full_name,
    email,
    role,
    is_active
  )
  values (
    new.id,
    v_clinic_id,
    v_full_name,
    new.email,
    v_role,
    true
  )
  on conflict (id) do update
  set
    clinic_id = excluded.clinic_id,
    full_name = excluded.full_name,
    email = excluded.email,
    role = excluded.role,
    is_active = true;

  insert into public.clinic_memberships (
    clinic_id,
    user_id,
    role
  )
  values (
    v_clinic_id,
    new.id,
    v_role
  )
  on conflict (clinic_id, user_id) where ended_at is null
  do update
  set
    role = excluded.role,
    ended_at = null
  returning id into v_membership_id;

  update public.profiles
  set default_membership_id = coalesce(default_membership_id, v_membership_id)
  where id = new.id;

  return new;
end;
$$;

drop trigger if exists on_auth_user_created on auth.users;

create trigger on_auth_user_created
after insert on auth.users
for each row execute function public.handle_new_user_compat();

create or replace function public.sync_profile_active_to_membership()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  if old.is_active and not new.is_active and old.clinic_id is not null then
    update public.clinic_memberships
    set ended_at = coalesce(ended_at, now())
    where user_id = new.id
      and clinic_id = old.clinic_id
      and ended_at is null;
  end if;

  return new;
end;
$$;

drop trigger if exists sync_profile_active_to_membership on public.profiles;

create trigger sync_profile_active_to_membership
after update of is_active on public.profiles
for each row execute function public.sync_profile_active_to_membership();

alter table public.clinic_memberships enable row level security;
alter table public.clinic_invites enable row level security;
alter table public.owner_onboardings enable row level security;

drop policy if exists "Users can view own or clinic memberships" on public.clinic_memberships;

create policy "Users can view own or clinic memberships"
  on public.clinic_memberships for select
  using (
    user_id = auth.uid()
    or (
      clinic_id = public.get_user_clinic_id()
      and public.is_clinic_admin()
    )
  );

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
    clinic_id,
    full_name,
    email,
    role,
    is_active
  )
  values (
    v_user_id,
    v_clinic_id,
    trim(full_name),
    v_email,
    'admin',
    true
  )
  on conflict (id) do update
  set
    clinic_id = excluded.clinic_id,
    full_name = excluded.full_name,
    email = excluded.email,
    role = 'admin',
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
    clinic_id = v_clinic_id,
    role = 'admin',
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

  if v_clinic_id is null or not public.is_clinic_admin() then
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
    clinic_id,
    full_name,
    email,
    role,
    is_active
  )
  values (
    v_user_id,
    v_invite.clinic_id,
    trim(p_full_name),
    v_email,
    v_invite.role,
    true
  )
  on conflict (id) do update
  set
    clinic_id = excluded.clinic_id,
    full_name = case
      when coalesce(trim(excluded.full_name), '') = '' then public.profiles.full_name
      else excluded.full_name
    end,
    email = excluded.email,
    role = excluded.role,
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
    clinic_id = v_invite.clinic_id,
    role = v_invite.role,
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
  set
    default_membership_id = v_membership.id,
    clinic_id = v_membership.clinic_id,
    role = v_membership.role,
    is_active = true
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

  if not public.is_clinic_admin() or public.get_user_clinic_id() <> v_membership.clinic_id then
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
      clinic_id = v_fallback.clinic_id,
      role = v_fallback.role,
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

revoke all on function public.complete_registration(text, text) from public;
revoke all on function public.create_staff_invite(text, public.user_role) from public;
revoke all on function public.get_invite_preview(text) from public;
revoke all on function public.accept_invite(text, text) from public;
revoke all on function public.set_default_membership(uuid) from public;
revoke all on function public.deactivate_membership(uuid) from public;

grant execute on function public.complete_registration(text, text) to authenticated;
grant execute on function public.create_staff_invite(text, public.user_role) to authenticated;
grant execute on function public.get_invite_preview(text) to anon, authenticated;
grant execute on function public.accept_invite(text, text) to authenticated;
grant execute on function public.set_default_membership(uuid) to authenticated;
grant execute on function public.deactivate_membership(uuid) to authenticated;
