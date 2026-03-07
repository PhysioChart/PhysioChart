-- Replace stale profile.clinic_id checks with membership-aware scope checks.

create or replace function public.get_dashboard_overview(
  p_clinic_id uuid,
  p_now timestamptz default now(),
  p_range_end timestamptz default (now() + interval '7 days'),
  p_today_local date default current_date,
  p_tz_offset_minutes integer default null
) returns jsonb
language plpgsql
security invoker
as $$
declare
  v_day_start timestamptz;
  v_day_end timestamptz;
  v_total_patients bigint := 0;
  v_active_treatments bigint := 0;
  v_upcoming_7d bigint := 0;
  v_today_appts bigint := 0;
  v_pending_invoices bigint := 0;
  v_overdue_invoices bigint := 0;
  v_outstanding_amount numeric(10,2) := 0;
  v_upcoming jsonb := '[]'::jsonb;
  v_recent jsonb := '[]'::jsonb;
begin
  if p_clinic_id is null then
    raise exception using message = 'INVALID_CLINIC_ID';
  end if;

  if p_range_end <= p_now then
    raise exception using message = 'INVALID_RANGE';
  end if;

  if not public.is_member_of_clinic(p_clinic_id) then
    raise exception using message = 'CLINIC_SCOPE_MISMATCH';
  end if;

  if p_today_local is not null then
    v_day_start := (p_today_local::timestamp + make_interval(mins => coalesce(p_tz_offset_minutes, 0)))::timestamptz;
    v_day_end := v_day_start + interval '1 day';
  else
    v_day_start := date_trunc('day', p_now);
    v_day_end := v_day_start + interval '1 day';
  end if;

  select
    (select count(*) from public.patients p where p.clinic_id = p_clinic_id),
    (select count(*) from public.treatment_plans tp where tp.clinic_id = p_clinic_id and tp.status = 'active'),
    count(*) filter (where a.end_time >= p_now and a.start_time < p_range_end),
    count(*) filter (where a.end_time >= v_day_start and a.start_time < v_day_end)
  into v_total_patients, v_active_treatments, v_upcoming_7d, v_today_appts
  from public.appointments a
  where a.clinic_id = p_clinic_id
    and a.status in ('scheduled','checked_in');

  with inv as (
    select
      count(*) filter (where i.status in ('sent','partially_paid','overdue')) as pending_invoices,
      count(*) filter (where i.status = 'overdue') as overdue_invoices,
      coalesce(sum(greatest(i.total - i.amount_paid, 0)), 0)::numeric(10,2) as outstanding_amount
    from public.invoices i
    where i.clinic_id = p_clinic_id
      and i.status in ('sent','partially_paid','overdue')
  )
  select pending_invoices, overdue_invoices, outstanding_amount
  into v_pending_invoices, v_overdue_invoices, v_outstanding_amount
  from inv;

  select coalesce(jsonb_agg(row_to_json(t)), '[]'::jsonb) into v_upcoming
  from (
    select
      a.id,
      a.start_time as "startTime",
      a.end_time as "endTime",
      a.status::text,
      a.patient_id as "patientId",
      p.full_name as "patientName",
      pr.full_name as "therapistName"
    from public.appointments a
    left join public.patients p on p.id = a.patient_id
    left join public.profiles pr on pr.id = a.therapist_id
    where a.clinic_id = p_clinic_id
      and a.status in ('scheduled','checked_in')
      and a.end_time >= p_now
      and a.start_time < p_range_end
    order by a.start_time asc
    limit 10
  ) t;

  with combined as (
    (
      select
        a.id,
        'appointment'::text as kind,
        coalesce(a.updated_at, a.created_at) as occurred_at,
        a.status::text as status,
        a.start_time,
        a.patient_id,
        p.full_name as patient_name,
        pr.full_name as therapist_name,
        null::text as invoice_number,
        null::numeric as total,
        null::numeric as amount_paid
      from public.appointments a
      left join public.patients p on p.id = a.patient_id
      left join public.profiles pr on pr.id = a.therapist_id
      where a.clinic_id = p_clinic_id
      order by occurred_at desc
      limit 20
    )
    union all
    (
      select
        i.id,
        'invoice'::text as kind,
        coalesce(i.updated_at, i.created_at) as occurred_at,
        i.status::text as status,
        null::timestamptz as start_time,
        i.patient_id,
        p.full_name as patient_name,
        null::text as therapist_name,
        i.invoice_number,
        i.total,
        i.amount_paid
      from public.invoices i
      left join public.patients p on p.id = i.patient_id
      where i.clinic_id = p_clinic_id
      order by occurred_at desc
      limit 20
    )
  )
  select coalesce(
    jsonb_agg(
      jsonb_build_object(
        'id', c.id,
        'kind', c.kind,
        'occurredAt', c.occurred_at,
        'status', c.status,
        'patientId', c.patient_id,
        'patientName', c.patient_name,
        'therapistName', c.therapist_name,
        'invoiceNumber', c.invoice_number,
        'total', c.total,
        'amountPaid', c.amount_paid,
        'outstanding', case
          when c.total is null then null
          else greatest(c.total - c.amount_paid, 0)
        end,
        'startTime', c.start_time
      )
      order by c.occurred_at desc
    ),
    '[]'::jsonb
  ) into v_recent
  from (select * from combined order by occurred_at desc limit 15) c;

  return jsonb_build_object(
    'counts', jsonb_build_object(
      'totalPatients', v_total_patients,
      'activeTreatments', v_active_treatments,
      'upcomingAppointments7d', v_upcoming_7d,
      'todayAppointments', v_today_appts,
      'pendingInvoices', v_pending_invoices,
      'overdueInvoices', v_overdue_invoices,
      'outstandingAmount', v_outstanding_amount
    ),
    'upcomingAppointments', v_upcoming,
    'recentActivity', v_recent
  );
end;
$$;

create or replace function public.validate_appointment_relationship_scope()
returns trigger
language plpgsql
as $$
declare
  v_patient_clinic uuid;
  v_plan_clinic uuid;
  v_plan_patient uuid;
begin
  if tg_op = 'UPDATE'
    and new.clinic_id is not distinct from old.clinic_id
    and new.patient_id is not distinct from old.patient_id
    and new.therapist_id is not distinct from old.therapist_id
    and new.treatment_plan_id is not distinct from old.treatment_plan_id then
    return new;
  end if;

  select p.clinic_id
  into v_patient_clinic
  from public.patients p
  where p.id = new.patient_id;

  if v_patient_clinic is null then
    raise exception using message = 'PATIENT_NOT_FOUND';
  end if;

  if v_patient_clinic <> new.clinic_id then
    raise exception using message = 'PATIENT_CLINIC_MISMATCH';
  end if;

  if new.therapist_id is not null then
    if not exists (
      select 1
      from public.profiles profile
      where profile.id = new.therapist_id
    ) then
      raise exception using message = 'THERAPIST_NOT_FOUND';
    end if;

    if not exists (
      select 1
      from public.clinic_memberships membership
      where membership.user_id = new.therapist_id
        and membership.clinic_id = new.clinic_id
        and membership.ended_at is null
    ) then
      raise exception using message = 'THERAPIST_CLINIC_MISMATCH';
    end if;
  end if;

  if new.treatment_plan_id is not null then
    select tp.clinic_id, tp.patient_id
    into v_plan_clinic, v_plan_patient
    from public.treatment_plans tp
    where tp.id = new.treatment_plan_id;

    if v_plan_clinic is null then
      raise exception using message = 'TREATMENT_PLAN_NOT_FOUND';
    end if;

    if v_plan_clinic <> new.clinic_id then
      raise exception using message = 'TREATMENT_PLAN_CLINIC_MISMATCH';
    end if;

    if v_plan_patient <> new.patient_id then
      raise exception using message = 'PATIENT_PLAN_MISMATCH';
    end if;
  end if;

  return new;
end;
$$;

create or replace function public.create_treatment_linked_appointment(
  p_clinic_id uuid,
  p_treatment_plan_id uuid,
  p_therapist_id uuid,
  p_start_time timestamptz,
  p_end_time timestamptz,
  p_notes text default null,
  p_idempotency_key text default null
)
returns jsonb
language plpgsql
security invoker
as $$
declare
  v_plan public.treatment_plans%rowtype;
  v_created public.appointments%rowtype;
  v_existing public.appointments%rowtype;
  v_note text := nullif(btrim(coalesce(p_notes, '')), '');
  v_idempotency_key text := nullif(btrim(coalesce(p_idempotency_key, '')), '');
  v_constraint text;
begin
  if p_clinic_id is null then
    raise exception using message = 'INVALID_CLINIC_ID';
  end if;

  if p_start_time is null
    or p_end_time is null
    or p_end_time <= p_start_time
    or (p_end_time - p_start_time) > interval '12 hours' then
    raise exception using message = 'INVALID_APPOINTMENT_RANGE';
  end if;

  if p_therapist_id is null then
    raise exception using message = 'PRACTITIONER_REQUIRED';
  end if;

  if v_idempotency_key is null then
    raise exception using message = 'IDEMPOTENCY_KEY_REQUIRED';
  end if;

  if not public.is_member_of_clinic(p_clinic_id) then
    raise exception using message = 'CLINIC_SCOPE_MISMATCH';
  end if;

  select *
  into v_plan
  from public.treatment_plans tp
  where tp.id = p_treatment_plan_id
    and tp.clinic_id = p_clinic_id
  for update;

  if not found then
    raise exception using message = 'TREATMENT_PLAN_NOT_FOUND';
  end if;

  if v_plan.status <> 'active'::public.treatment_status then
    raise exception using message = 'TREATMENT_PLAN_NOT_ACTIVE';
  end if;

  select *
  into v_existing
  from public.appointments a
  where a.clinic_id = p_clinic_id
    and a.idempotency_key = v_idempotency_key
  order by a.created_at desc
  limit 1;

  if found then
    return jsonb_build_object(
      'appointmentId', v_existing.id,
      'alreadyCreated', true,
      'message', 'APPOINTMENT_ALREADY_CREATED',
      'appointment', jsonb_build_object(
        'id', v_existing.id,
        'patientId', v_existing.patient_id,
        'therapistId', v_existing.therapist_id,
        'treatmentPlanId', v_existing.treatment_plan_id,
        'startTime', v_existing.start_time,
        'endTime', v_existing.end_time,
        'status', v_existing.status,
        'notes', v_existing.notes
      ),
      'treatmentSummary', jsonb_build_object(
        'id', v_plan.id,
        'patientId', v_plan.patient_id,
        'name', v_plan.name,
        'status', v_plan.status,
        'totalSessions', v_plan.total_sessions
      )
    );
  end if;

  begin
    insert into public.appointments (
      clinic_id,
      patient_id,
      therapist_id,
      treatment_plan_id,
      start_time,
      end_time,
      status,
      notes,
      idempotency_key
    )
    values (
      p_clinic_id,
      v_plan.patient_id,
      p_therapist_id,
      v_plan.id,
      p_start_time,
      p_end_time,
      'scheduled'::public.appointment_status,
      v_note,
      v_idempotency_key
    )
    returning * into v_created;
  exception
    when sqlstate '23505' then
      get stacked diagnostics v_constraint = constraint_name;

      if v_constraint = 'uq_appointments_clinic_idempotency' then
        select *
        into v_existing
        from public.appointments a
        where a.clinic_id = p_clinic_id
          and a.idempotency_key = v_idempotency_key
        order by a.created_at desc
        limit 1;

        if found then
          return jsonb_build_object(
            'appointmentId', v_existing.id,
            'alreadyCreated', true,
            'message', 'APPOINTMENT_ALREADY_CREATED',
            'appointment', jsonb_build_object(
              'id', v_existing.id,
              'patientId', v_existing.patient_id,
              'therapistId', v_existing.therapist_id,
              'treatmentPlanId', v_existing.treatment_plan_id,
              'startTime', v_existing.start_time,
              'endTime', v_existing.end_time,
              'status', v_existing.status,
              'notes', v_existing.notes
            ),
            'treatmentSummary', jsonb_build_object(
              'id', v_plan.id,
              'patientId', v_plan.patient_id,
              'name', v_plan.name,
              'status', v_plan.status,
              'totalSessions', v_plan.total_sessions
            )
          );
        end if;
      end if;

      raise;
  end;

  return jsonb_build_object(
    'appointmentId', v_created.id,
    'alreadyCreated', false,
    'message', null,
    'appointment', jsonb_build_object(
      'id', v_created.id,
      'patientId', v_created.patient_id,
      'therapistId', v_created.therapist_id,
      'treatmentPlanId', v_created.treatment_plan_id,
      'startTime', v_created.start_time,
      'endTime', v_created.end_time,
      'status', v_created.status,
      'notes', v_created.notes
    ),
    'treatmentSummary', jsonb_build_object(
      'id', v_plan.id,
      'patientId', v_plan.patient_id,
      'name', v_plan.name,
      'status', v_plan.status,
      'totalSessions', v_plan.total_sessions
    )
  );
end;
$$;

create or replace function public.get_treatment_linked_appointments_bulk(
  p_clinic_id uuid,
  p_plan_ids uuid[],
  p_now timestamptz default now(),
  p_limit_per_plan integer default 3
)
returns table (
  plan_id uuid,
  appointment_id uuid,
  start_time timestamptz,
  end_time timestamptz,
  status public.appointment_status
)
language plpgsql
security invoker
stable
as $$
begin
  if not public.is_member_of_clinic(p_clinic_id) then
    raise exception using message = 'CLINIC_SCOPE_MISMATCH';
  end if;

  if p_plan_ids is null or cardinality(p_plan_ids) = 0 then
    return;
  end if;

  if cardinality(p_plan_ids) > 100 then
    raise exception using message = 'PLAN_IDS_TOO_LARGE';
  end if;

  if p_limit_per_plan is null or p_limit_per_plan < 1 or p_limit_per_plan > 10 then
    raise exception using message = 'INVALID_LIMIT_PER_PLAN';
  end if;

  return query
  with ranked as (
    select
      a.treatment_plan_id as plan_id,
      a.id as appointment_id,
      a.start_time,
      a.end_time,
      a.status,
      row_number() over (
        partition by a.treatment_plan_id
        order by
          case
            when a.status in ('scheduled', 'checked_in') and a.start_time >= p_now then 0
            when a.status in ('scheduled', 'checked_in') then 1
            when a.status = 'completed' then 2
            when a.status = 'no_show' then 3
            else 4
          end asc,
          case
            when a.status in ('scheduled', 'checked_in') and a.start_time >= p_now then a.start_time
          end asc nulls last,
          case
            when not (a.status in ('scheduled', 'checked_in') and a.start_time >= p_now) then a.start_time
          end desc nulls last,
          a.id asc
      ) as rn
    from public.appointments a
    where a.clinic_id = p_clinic_id
      and a.treatment_plan_id = any(p_plan_ids)
  )
  select
    r.plan_id,
    r.appointment_id,
    r.start_time,
    r.end_time,
    r.status
  from ranked r
  where r.rn <= p_limit_per_plan;
end;
$$;

create or replace function public.create_invoice(
  p_clinic_id uuid,
  p_patient_id uuid,
  p_treatment_plan_id uuid default null,
  p_line_items jsonb default '[]'::jsonb,
  p_due_date date default null,
  p_notes text default null,
  p_idempotency_key text default null
)
returns jsonb
language plpgsql
security invoker
as $$
declare
  v_existing public.invoices%rowtype;
  v_invoice public.invoices%rowtype;
  v_patient public.patients%rowtype;
  v_patient_json jsonb;
  v_plan_clinic uuid;
  v_plan_patient uuid;
  v_plan_status public.treatment_status;
  v_patient_clinic uuid;
  v_normalized_line_items jsonb;
  v_subtotal numeric(10,2);
  v_tax numeric(10,2) := 0;
  v_total numeric(10,2);
  v_status public.invoice_status;
  v_invoice_number text;
  v_sequence integer;
  v_constraint text;
  v_today_text text := to_char(current_date, 'YYYYMMDD');
  v_note text := nullif(btrim(coalesce(p_notes, '')), '');
  v_idempotency_key text := nullif(btrim(coalesce(p_idempotency_key, '')), '');
  v_created boolean := false;
  v_create_attempt integer;
  v_number_attempt integer;
begin
  if p_clinic_id is null then
    raise exception using message = 'INVALID_CLINIC_ID';
  end if;

  if v_idempotency_key is null then
    raise exception using message = 'IDEMPOTENCY_KEY_REQUIRED';
  end if;

  if not public.is_member_of_clinic(p_clinic_id) then
    raise exception using message = 'CLINIC_SCOPE_MISMATCH';
  end if;

  select p.clinic_id
  into v_patient_clinic
  from public.patients p
  where p.id = p_patient_id;

  if v_patient_clinic is null then
    raise exception using message = 'PATIENT_NOT_FOUND';
  end if;

  if v_patient_clinic <> p_clinic_id then
    raise exception using message = 'PATIENT_CLINIC_MISMATCH';
  end if;

  if p_treatment_plan_id is not null then
    select tp.clinic_id, tp.patient_id, tp.status
    into v_plan_clinic, v_plan_patient, v_plan_status
    from public.treatment_plans tp
    where tp.id = p_treatment_plan_id;

    if v_plan_clinic is null then
      raise exception using message = 'TREATMENT_PLAN_NOT_FOUND';
    end if;

    if v_plan_clinic <> p_clinic_id then
      raise exception using message = 'TREATMENT_PLAN_CLINIC_MISMATCH';
    end if;

    if v_plan_patient <> p_patient_id then
      raise exception using message = 'PATIENT_PLAN_MISMATCH';
    end if;

    if v_plan_status = 'cancelled'::public.treatment_status then
      raise exception using message = 'TREATMENT_PLAN_CANCELLED';
    end if;
  end if;

  select n.sanitized_line_items, n.sanitized_subtotal
  into v_normalized_line_items, v_subtotal
  from public.normalize_invoice_line_items(p_line_items) as n;

  v_total := round(v_subtotal + v_tax, 2);
  if v_total <= 0 then
    raise exception using message = 'INVALID_INVOICE_TOTAL';
  end if;

  if p_due_date is not null and p_due_date < current_date then
    v_status := 'overdue'::public.invoice_status;
  else
    v_status := 'sent'::public.invoice_status;
  end if;

  -- Keep p_idempotency_key default NULL for Supabase RPC compatibility;
  -- function still enforces non-null/non-blank keys for callers.
  for v_create_attempt in 1..10 loop
    select *
    into v_existing
    from public.invoices i
    where i.clinic_id = p_clinic_id
      and i.idempotency_key = v_idempotency_key
    order by i.created_at desc
    limit 1;

    if found then
      v_invoice := v_existing;
      exit;
    end if;

    for v_number_attempt in 1..10 loop
      select coalesce(
        max((regexp_match(i.invoice_number, '^INV-' || v_today_text || '-(\d+)$'))[1]::integer),
        0
      ) + 1
      into v_sequence
      from public.invoices i
      where i.clinic_id = p_clinic_id
        and i.invoice_number like ('INV-' || v_today_text || '-%');

      v_invoice_number := format('INV-%s-%s', v_today_text, lpad(v_sequence::text, 3, '0'));

      begin
        insert into public.invoices (
          clinic_id,
          patient_id,
          treatment_plan_id,
          invoice_number,
          line_items,
          subtotal,
          tax,
          total,
          amount_paid,
          status,
          due_date,
          notes,
          idempotency_key
        )
        values (
          p_clinic_id,
          p_patient_id,
          p_treatment_plan_id,
          v_invoice_number,
          v_normalized_line_items,
          v_subtotal,
          v_tax,
          v_total,
          0,
          v_status,
          p_due_date,
          v_note,
          v_idempotency_key
        )
        returning * into v_invoice;

        v_created := true;
        exit;
      exception
        when sqlstate '23505' then
          get stacked diagnostics v_constraint = constraint_name;

          if v_constraint in ('idx_invoices_number', 'invoices_clinic_id_invoice_number_key') then
            if v_number_attempt = 10 then
              raise exception using message = 'INVOICE_NUMBER_GENERATION_FAILED';
            end if;
            continue;
          elsif v_constraint = 'uq_invoices_clinic_idempotency' then
            exit;
          else
            raise;
          end if;
      end;
    end loop;

    if v_created then
      exit;
    end if;
  end loop;

  if not v_created and v_invoice.id is null then
    raise exception using message = 'INVOICE_CREATE_RETRY_EXHAUSTED';
  end if;

  if v_invoice.id is null then
    raise exception using message = 'INVOICE_CREATE_RETRY_EXHAUSTED';
  end if;

  select *
  into v_patient
  from public.patients p
  where p.id = v_invoice.patient_id;

  if found then
    v_patient_json := jsonb_build_object(
      'id', v_patient.id,
      'clinic_id', v_patient.clinic_id,
      'full_name', v_patient.full_name,
      'phone', v_patient.phone,
      'email', v_patient.email,
      'date_of_birth', v_patient.date_of_birth,
      'gender', v_patient.gender,
      'address', v_patient.address,
      'emergency_contact_name', v_patient.emergency_contact_name,
      'emergency_contact_phone', v_patient.emergency_contact_phone,
      'medical_history', v_patient.medical_history,
      'notes', v_patient.notes,
      'is_archived', v_patient.is_archived,
      'created_at', v_patient.created_at,
      'updated_at', v_patient.updated_at
    );
  else
    v_patient_json := null;
  end if;

  return jsonb_build_object(
    'invoiceId', v_invoice.id,
    'alreadyCreated', not v_created,
    'message', case when v_created then null else 'INVOICE_ALREADY_CREATED' end,
    'invoice', jsonb_build_object(
      'id', v_invoice.id,
      'clinic_id', v_invoice.clinic_id,
      'patient_id', v_invoice.patient_id,
      'treatment_plan_id', v_invoice.treatment_plan_id,
      'invoice_number', v_invoice.invoice_number,
      'line_items', v_invoice.line_items,
      'subtotal', v_invoice.subtotal,
      'tax', v_invoice.tax,
      'total', v_invoice.total,
      'amount_paid', v_invoice.amount_paid,
      'status', v_invoice.status,
      'due_date', v_invoice.due_date,
      'notes', v_invoice.notes,
      'created_at', v_invoice.created_at,
      'updated_at', v_invoice.updated_at,
      'idempotency_key', v_invoice.idempotency_key,
      'patient', v_patient_json
    )
  );
end;
$$;
