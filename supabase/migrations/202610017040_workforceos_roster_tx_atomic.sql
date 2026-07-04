-- WorkforceOS — atomic standard-hours save and generated roster shift replacement (FI-WORKFLOW-P1-ROSTER-TX-1).

create or replace function public.fi_replace_staff_standard_hours(
  p_tenant_id uuid,
  p_staff_id uuid,
  p_effective_from date,
  p_rows jsonb
)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_now timestamptz := now();
  v_archived_count integer := 0;
  v_inserted_count integer := 0;
  v_row jsonb;
begin
  if p_rows is null or jsonb_typeof(p_rows) <> 'array' then
    raise exception 'p_rows must be a JSON array';
  end if;

  if not exists (
    select 1 from public.fi_staff s
    where s.tenant_id = p_tenant_id and s.id = p_staff_id
  ) then
    raise exception 'staff member not found for tenant';
  end if;

  update public.fi_staff_standard_hours
  set status = 'archived',
      updated_at = v_now
  where tenant_id = p_tenant_id
    and staff_id = p_staff_id
    and status = 'active';
  get diagnostics v_archived_count = row_count;

  for v_row in select value from jsonb_array_elements(p_rows) loop
    insert into public.fi_staff_standard_hours (
      tenant_id,
      staff_id,
      clinic_id,
      weekday,
      cycle_week,
      start_time,
      end_time,
      break_minutes,
      shift_label,
      role_code,
      is_working_day,
      effective_from,
      effective_to,
      status
    ) values (
      p_tenant_id,
      p_staff_id,
      nullif(trim(v_row->>'clinic_id'), '')::uuid,
      (v_row->>'weekday')::smallint,
      coalesce(nullif(v_row->>'cycle_week', '')::smallint, 1),
      nullif(v_row->>'start_time', '')::time,
      nullif(v_row->>'end_time', '')::time,
      coalesce(nullif(v_row->>'break_minutes', '')::integer, 0),
      nullif(trim(v_row->>'shift_label'), ''),
      nullif(trim(v_row->>'role_code'), ''),
      coalesce((v_row->>'is_working_day')::boolean, true),
      p_effective_from,
      null,
      'active'
    );
    v_inserted_count := v_inserted_count + 1;
  end loop;

  return jsonb_build_object(
    'ok', true,
    'archived_count', v_archived_count,
    'inserted_count', v_inserted_count
  );
end;
$$;

comment on function public.fi_replace_staff_standard_hours is
  'Atomically archive active fi_staff_standard_hours rows and insert replacement active rows for one staff member.';

create or replace function public.fi_replace_generated_roster_shifts(
  p_tenant_id uuid,
  p_shift_ids_to_cancel uuid[],
  p_new_shifts jsonb,
  p_created_by uuid default null
)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_now timestamptz := now();
  v_cancelled_count integer := 0;
  v_inserted_count integer := 0;
  v_row jsonb;
  v_shift_id uuid;
  v_invalid_count integer := 0;
begin
  if p_new_shifts is null or jsonb_typeof(p_new_shifts) <> 'array' then
    raise exception 'p_new_shifts must be a JSON array';
  end if;

  if p_shift_ids_to_cancel is not null and cardinality(p_shift_ids_to_cancel) > 0 then
    select count(*) into v_invalid_count
    from unnest(p_shift_ids_to_cancel) as sid(shift_id)
    left join public.fi_staff_shifts sh
      on sh.id = sid.shift_id
     and sh.tenant_id = p_tenant_id
     and sh.status <> 'cancelled'
     and sh.shift_source = 'standard_hours'
    where sh.id is null;

    if v_invalid_count > 0 then
      raise exception 'one or more shift_ids_to_cancel are not eligible generated standard-hours shifts for tenant';
    end if;

    update public.fi_staff_shifts
    set status = 'cancelled',
        updated_at = v_now
    where tenant_id = p_tenant_id
      and id = any (p_shift_ids_to_cancel)
      and status <> 'cancelled'
      and shift_source = 'standard_hours';
    get diagnostics v_cancelled_count = row_count;
  end if;

  for v_row in select value from jsonb_array_elements(p_new_shifts) loop
    if not exists (
      select 1 from public.fi_staff s
      where s.tenant_id = p_tenant_id
        and s.id = nullif(trim(v_row->>'staff_id'), '')::uuid
    ) then
      raise exception 'roster shift staff_id does not belong to tenant';
    end if;

    insert into public.fi_staff_shifts (
      tenant_id,
      staff_id,
      clinic_id,
      shift_type,
      starts_at,
      ends_at,
      status,
      notes,
      shift_source,
      created_by
    ) values (
      p_tenant_id,
      nullif(trim(v_row->>'staff_id'), '')::uuid,
      nullif(trim(v_row->>'clinic_id'), '')::uuid,
      coalesce(nullif(trim(v_row->>'shift_type'), ''), 'clinic_day'),
      (v_row->>'starts_at')::timestamptz,
      (v_row->>'ends_at')::timestamptz,
      'scheduled',
      nullif(trim(v_row->>'notes'), ''),
      coalesce(nullif(trim(v_row->>'shift_source'), ''), 'standard_hours'),
      coalesce(p_created_by, nullif(trim(v_row->>'created_by'), '')::uuid)
    );
    v_inserted_count := v_inserted_count + 1;
  end loop;

  return jsonb_build_object(
    'ok', true,
    'cancelled_count', v_cancelled_count,
    'inserted_count', v_inserted_count
  );
end;
$$;

comment on function public.fi_replace_generated_roster_shifts is
  'Atomically cancel eligible generated standard-hours shifts and insert replacement roster candidates.';

grant execute on function public.fi_replace_staff_standard_hours(uuid, uuid, date, jsonb) to service_role;
grant execute on function public.fi_replace_generated_roster_shifts(uuid, uuid[], jsonb, uuid) to service_role;