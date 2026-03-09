-- Dashboard overview RPC with scoped aggregates and capped lists
-- Note: p_tz_offset_minutes should be the value from JS getTimezoneOffset(), which is
-- minutes to add to local time to reach UTC (negative for UTC+ timezones). Adding it to
-- local midnight yields the correct UTC instant for that local day boundary. Be careful
-- not to “fix” the sign unless you change how the client sends it.

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

  if not exists (
    select 1 from public.profiles pr
    where pr.id = auth.uid() and pr.clinic_id = p_clinic_id
  ) then
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

  with appt_events as (
    select
      a.id,
      'appointment'::text as kind,
      coalesce(a.updated_at, a.created_at) as occurred_at,
      a.status,
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
  ),
  invoice_events as (
    select
      i.id,
      'invoice'::text as kind,
      coalesce(i.updated_at, i.created_at) as occurred_at,
      i.status::text,
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
  ),
  combined as (
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
