-- Extend fi_crm_leads_shell_page with optional lead.updated_at range filters (CRM list + kanban).

drop function if exists public.fi_crm_leads_shell_page(uuid, uuid, text, text, uuid, text, text, int, int);

create or replace function public.fi_crm_leads_shell_page(
  p_tenant_id uuid,
  p_stage_id uuid,
  p_status text,
  p_priority text,
  p_owner_user_id uuid,
  p_search_pattern text,
  p_sort text,
  p_limit int,
  p_offset int,
  p_updated_at_min timestamptz default null,
  p_updated_at_max timestamptz default null
)
returns jsonb
language plpgsql
stable
as $$
declare
  v_order text;
  v_result jsonb;
begin
  if p_limit is null or p_limit < 1 or p_limit > 100 then
    raise exception 'invalid p_limit';
  end if;
  if p_offset is null or p_offset < 0 then
    raise exception 'invalid p_offset';
  end if;

  v_order := case trim(coalesce(p_sort, ''))
    when 'created_at_desc' then 'j.c_at desc nulls last'
    when 'priority_asc' then 'j.pri asc nulls last, j.u_at desc nulls last'
    when 'priority_desc' then 'j.pri desc nulls last, j.u_at desc nulls last'
    when 'stage_sort_asc' then 'j.st_sort asc nulls last, j.u_at desc nulls last'
    when 'stage_sort_desc' then 'j.st_sort desc nulls last, j.u_at desc nulls last'
    else 'j.u_at desc nulls last'
  end;

  execute format($sql$
    with base as (
      select l.*
      from fi_crm_leads l
      where l.tenant_id = $1
        and ($2::uuid is null or l.current_stage_id = $2)
        and ($3::text is null or length(trim($3)) = 0 or l.status = trim($3))
        and ($4::text is null or length(trim($4)) = 0 or l.priority = trim($4))
        and ($5::uuid is null or l.primary_owner_user_id = $5)
        and (
          $6::text is null or length(trim($6)) = 0
          or l.summary ilike trim($6)
          or exists (
            select 1
            from fi_persons p
            where p.id = l.person_id
              and p.tenant_id = l.tenant_id
              and (
                coalesce(p.metadata->>'display_name', '') ilike trim($6)
                or coalesce(p.metadata->>'email_normalized', '') ilike trim($6)
                or coalesce(p.metadata->>'normalised_display_name', '') ilike trim($6)
              )
          )
        )
        and ($9::timestamptz is null or l.updated_at >= $9)
        and ($10::timestamptz is null or l.updated_at <= $10)
    ),
    tot as (
      select count(*)::bigint as c from base
    ),
    joined as (
      select
        to_jsonb(b) as lead,
        case
          when s.id is null then null
          else jsonb_build_object(
            'id', s.id,
            'slug', s.slug,
            'label', s.label,
            'sort_order', s.sort_order
          )
        end as stage,
        case
          when pr.id is null then null
          else jsonb_build_object('id', pr.id, 'metadata', pr.metadata)
        end as person,
        case
          when u.id is null then null
          else jsonb_build_object('id', u.id, 'email', u.email)
        end as owner,
        case
          when pat.id is null then null
          else jsonb_build_object('id', pat.id)
        end as patient,
        b.updated_at as u_at,
        b.created_at as c_at,
        b.priority as pri,
        s.sort_order as st_sort
      from base b
      left join fi_crm_pipeline_stages s
        on s.id = b.current_stage_id and s.tenant_id = b.tenant_id
      left join fi_persons pr
        on pr.id = b.person_id and pr.tenant_id = b.tenant_id
      left join fi_users u
        on u.id = b.primary_owner_user_id and u.tenant_id = b.tenant_id
      left join fi_patients pat
        on pat.id = b.patient_id and pat.tenant_id = b.tenant_id
    ),
    page_rows as (
      select j.*, row_number() over () as __ord
      from joined j
      order by %s
      offset $7
      limit $8
    )
    select jsonb_build_object(
      'total', (select c from tot),
      'items', coalesce(
        (
          select jsonb_agg(
            jsonb_build_object(
              'lead', lead,
              'stage', stage,
              'person', person,
              'owner', owner,
              'patient', patient
            )
            order by __ord
          )
          from page_rows
        ),
        '[]'::jsonb
      )
    )
  $sql$, v_order)
  into v_result
  using
    p_tenant_id,
    p_stage_id,
    p_status,
    p_priority,
    p_owner_user_id,
    p_search_pattern,
    p_offset,
    p_limit,
    p_updated_at_min,
    p_updated_at_max;

  return v_result;
end;
$$;

comment on function public.fi_crm_leads_shell_page is
  'CRM Stage 2F: paginated lead list for one tenant with filters, ILIKE search, safe sort options, and optional updated_at range.';

revoke all on function public.fi_crm_leads_shell_page(
  uuid, uuid, text, text, uuid, text, text, int, int, timestamptz, timestamptz
) from public;

grant execute on function public.fi_crm_leads_shell_page(
  uuid, uuid, text, text, uuid, text, text, int, int, timestamptz, timestamptz
) to service_role;
