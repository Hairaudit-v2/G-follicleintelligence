-- WorkforceOS Phase 1C Sprint 2: staff lifecycle offboarding, merge status, duplicate review statuses.

alter table public.fi_staff_members
  add column if not exists termination_date timestamptz,
  add column if not exists exit_reason text,
  add column if not exists offboarded_by uuid,
  add column if not exists system_access_revoked boolean not null default false,
  add column if not exists academy_access_revoked boolean not null default false;

comment on column public.fi_staff_members.termination_date is
  'WorkforceOS offboarding: when employment ended.';
comment on column public.fi_staff_members.exit_reason is
  'WorkforceOS offboarding: human-readable exit reason.';
comment on column public.fi_staff_members.offboarded_by is
  'WorkforceOS offboarding: fi_users.id of operator who offboarded.';
comment on column public.fi_staff_members.system_access_revoked is
  'WorkforceOS offboarding: FI OS / SurgeryOS system access revoked.';
comment on column public.fi_staff_members.academy_access_revoked is
  'WorkforceOS offboarding: AcademyOS access revoked.';

-- Expand employment_status to include merged + contract_expired (alias of contract_ended retained).
alter table public.fi_staff_members
  drop constraint if exists fi_staff_members_employment_status_chk;

alter table public.fi_staff_members
  add constraint fi_staff_members_employment_status_chk check (
    employment_status in (
      'active',
      'inactive',
      'on_leave',
      'pending_onboarding',
      'terminated',
      'resigned',
      'contract_ended',
      'contract_expired',
      'suspended',
      'merged'
    )
  );

-- Expand duplicate candidate review statuses (Sprint 2 operational layer).
alter table public.fi_staff_duplicate_candidates
  drop constraint if exists fi_staff_duplicate_candidates_status_chk;

alter table public.fi_staff_duplicate_candidates
  add constraint fi_staff_duplicate_candidates_status_chk check (
    status in (
      'open',
      'dismissed',
      'merged',
      'manual_linked',
      'approved_for_merge',
      'resolved'
    )
  );

-- Transaction-safe staff member merge (no hard deletes; archives source).
create or replace function public.workforce_merge_staff_members(
  p_tenant_id uuid,
  p_source_staff_member_id uuid,
  p_target_staff_member_id uuid,
  p_merged_by uuid default null
)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_now timestamptz := now();
  v_source_fi_staff_id uuid;
  v_target_fi_staff_id uuid;
  v_moved_identity_links integer := 0;
  v_moved_fi_staff_rows integer := 0;
begin
  if p_source_staff_member_id = p_target_staff_member_id then
    raise exception 'source and target staff member must differ';
  end if;

  select fi_staff_id into v_source_fi_staff_id
  from public.fi_staff_members
  where tenant_id = p_tenant_id and id = p_source_staff_member_id and archived_at is null;

  if not found then
    raise exception 'source staff member not found for tenant';
  end if;

  select fi_staff_id into v_target_fi_staff_id
  from public.fi_staff_members
  where tenant_id = p_tenant_id and id = p_target_staff_member_id and archived_at is null;

  if not found then
    raise exception 'target staff member not found for tenant';
  end if;

  -- Identity links: repoint source → target when no external-id conflict.
  update public.fi_staff_identity_links l
  set staff_member_id = p_target_staff_member_id,
      updated_at = v_now
  where l.tenant_id = p_tenant_id
    and l.staff_member_id = p_source_staff_member_id
    and not exists (
      select 1
      from public.fi_staff_identity_links existing
      where existing.tenant_id = l.tenant_id
        and existing.source_system = l.source_system
        and existing.external_id = l.external_id
        and existing.staff_member_id = p_target_staff_member_id
    );
  get diagnostics v_moved_identity_links = row_count;

  -- Operational fi_staff dependencies (when both projections exist).
  if v_source_fi_staff_id is not null and v_target_fi_staff_id is not null
     and v_source_fi_staff_id <> v_target_fi_staff_id then

    if to_regclass('public.fi_staff_feature_access') is not null then
      update public.fi_staff_feature_access
      set staff_id = v_target_fi_staff_id, updated_at = v_now
      where tenant_id = p_tenant_id and staff_id = v_source_fi_staff_id;
    end if;

    if to_regclass('public.fi_staff_source_ids') is not null then
      update public.fi_staff_source_ids
      set staff_id = v_target_fi_staff_id, updated_at = v_now
      where tenant_id = p_tenant_id and staff_id = v_source_fi_staff_id
        and not exists (
          select 1 from public.fi_staff_source_ids e
          where e.tenant_id = p_tenant_id
            and e.staff_id = v_target_fi_staff_id
            and e.source_system = fi_staff_source_ids.source_system
            and e.source_staff_id = fi_staff_source_ids.source_staff_id
        );
    end if;

    if to_regclass('public.fi_staff_shifts') is not null then
      update public.fi_staff_shifts
      set staff_id = v_target_fi_staff_id, updated_at = v_now
      where tenant_id = p_tenant_id and staff_id = v_source_fi_staff_id;
    end if;

    if to_regclass('public.fi_staff_event_assignments') is not null then
      update public.fi_staff_event_assignments
      set staff_id = v_target_fi_staff_id, updated_at = v_now
      where tenant_id = p_tenant_id and staff_id = v_source_fi_staff_id;
    end if;

    if to_regclass('public.fi_staff_competency_projections') is not null then
      update public.fi_staff_competency_projections
      set staff_id = v_target_fi_staff_id, updated_at = v_now
      where tenant_id = p_tenant_id and staff_id = v_source_fi_staff_id;
    end if;

    if to_regclass('public.fi_staff_procedure_privileges') is not null then
      update public.fi_staff_procedure_privileges
      set staff_id = v_target_fi_staff_id, updated_at = v_now
      where tenant_id = p_tenant_id and staff_id = v_source_fi_staff_id;
    end if;

    if to_regclass('public.fi_staff_calendar_links') is not null then
      update public.fi_staff_calendar_links
      set staff_member_id = v_target_fi_staff_id, updated_at = v_now
      where tenant_id = p_tenant_id and staff_member_id = v_source_fi_staff_id;
    end if;

    if to_regclass('public.fi_staff_access_grants') is not null then
      update public.fi_staff_access_grants
      set staff_member_id = v_target_fi_staff_id, updated_at = v_now
      where tenant_id = p_tenant_id and staff_member_id = v_source_fi_staff_id;
    end if;

    if to_regclass('public.fi_staff_field_access_grants') is not null then
      update public.fi_staff_field_access_grants
      set staff_member_id = v_target_fi_staff_id, updated_at = v_now
      where tenant_id = p_tenant_id and staff_member_id = v_source_fi_staff_id;
    end if;

    -- TODO: training assignments table when shipped
    -- TODO: SOP acknowledgements table when shipped
    -- TODO: compliance documents table when shipped
    -- TODO: staff notes dedicated table when shipped (notes column on fi_staff_members preserved)

    update public.fi_staff
    set is_active = false,
        employment_status = 'merged',
        updated_at = v_now
    where tenant_id = p_tenant_id and id = v_source_fi_staff_id;

    v_moved_fi_staff_rows := 1;
  end if;

  update public.fi_staff_members
  set employment_status = 'merged',
      merged_into = p_target_staff_member_id,
      merged_at = v_now,
      updated_at = v_now
  where tenant_id = p_tenant_id and id = p_source_staff_member_id;

  update public.fi_staff_duplicate_candidates
  set status = 'resolved',
      resolved_at = v_now,
      resolved_by = p_merged_by,
      updated_at = v_now
  where tenant_id = p_tenant_id
    and status in ('open', 'approved_for_merge')
    and (
      (staff_a_id = p_source_staff_member_id and staff_b_id = p_target_staff_member_id)
      or (staff_a_id = p_target_staff_member_id and staff_b_id = p_source_staff_member_id)
    );

  return jsonb_build_object(
    'ok', true,
    'moved_identity_links', v_moved_identity_links,
    'archived_source_fi_staff', v_moved_fi_staff_rows > 0
  );
end;
$$;

comment on function public.workforce_merge_staff_members is
  'WorkforceOS Sprint 2: transaction-safe staff member merge. Archives source; never hard-deletes.';

grant execute on function public.workforce_merge_staff_members(uuid, uuid, uuid, uuid) to service_role;

-- Mirror merged status on operational fi_staff table.
alter table public.fi_staff
  drop constraint if exists fi_staff_employment_status_chk;

alter table public.fi_staff
  add constraint fi_staff_employment_status_chk check (
    employment_status in (
      'active',
      'inactive',
      'on_leave',
      'pending_onboarding',
      'terminated',
      'resigned',
      'contract_ended',
      'contract_expired',
      'suspended',
      'merged'
    )
  );