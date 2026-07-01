-- WorkforceOS Phase 1C Sprint 3: align schema with clinical workforce intelligence spec.
-- Builds on 202610017004 (already applied). Additive + constraint updates only.

-- ---------------------------------------------------------------------------
-- fi_staff_credentials — spec alignment
-- ---------------------------------------------------------------------------
alter table public.fi_staff_credentials
  add column if not exists issuing_body text,
  add column if not exists credential_number text,
  add column if not exists reminder_sent boolean not null default false;

update public.fi_staff_credentials
set
  issuing_body = coalesce(issuing_body, issuing_authority),
  credential_number = coalesce(credential_number, license_number)
where archived_at is null;

update public.fi_staff_credentials
set status = case
  when status in ('revoked', 'suspended', 'expired') then status
  when status = 'pending_verification' then 'active'
  when expires_at is not null and expires_at < now() then 'expired'
  when expires_at is not null and expires_at < now() + interval '30 days' then 'expiring_soon'
  else 'active'
end
where archived_at is null;

alter table public.fi_staff_credentials
  drop constraint if exists fi_staff_credentials_status_chk;

alter table public.fi_staff_credentials
  add constraint fi_staff_credentials_status_chk check (
    status in ('active', 'expiring_soon', 'expired', 'suspended', 'revoked')
  );

alter table public.fi_staff_credentials
  drop constraint if exists fi_staff_credentials_type_chk;

comment on column public.fi_staff_credentials.issuing_body is
  'Regulatory or licensing body (e.g. AHPRA).';
comment on column public.fi_staff_credentials.credential_number is
  'License or registration number.';
comment on column public.fi_staff_credentials.reminder_sent is
  'Whether an expiry reminder notification was sent for the current expiry window.';

-- ---------------------------------------------------------------------------
-- fi_staff_certifications — spec alignment
-- ---------------------------------------------------------------------------
alter table public.fi_staff_certifications
  add column if not exists certification_name text,
  add column if not exists issuing_organization text,
  add column if not exists competency_score numeric,
  add column if not exists verified boolean not null default false;

update public.fi_staff_certifications
set certification_name = coalesce(certification_name, display_name)
where archived_at is null;

alter table public.fi_staff_certifications
  drop constraint if exists fi_staff_certifications_type_chk;

alter table public.fi_staff_certifications
  drop constraint if exists fi_staff_certifications_status_chk;

comment on column public.fi_staff_certifications.certification_name is
  'Human-readable certification title (e.g. FUE Extraction Certification).';

-- ---------------------------------------------------------------------------
-- fi_staff_compliance_alerts — automated compliance audit queue
-- ---------------------------------------------------------------------------
create table if not exists public.fi_staff_compliance_alerts (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null references public.fi_tenants (id) on delete cascade,
  staff_member_id uuid not null references public.fi_staff_members (id) on delete cascade,
  alert_type text not null,
  severity text not null,
  message text,
  resolved boolean not null default false,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint fi_staff_compliance_alerts_severity_chk check (
    severity in ('low', 'medium', 'high', 'critical')
  ),
  constraint fi_staff_compliance_alerts_tenant_member_type_unique
    unique (tenant_id, staff_member_id, alert_type)
);

comment on table public.fi_staff_compliance_alerts is
  'WorkforceOS Sprint 3: auditable compliance alerts (upsert-deduped by alert_type per staff member).';

create index if not exists idx_fi_staff_compliance_alerts_tenant_resolved
  on public.fi_staff_compliance_alerts (tenant_id, resolved, created_at desc);

alter table public.fi_staff_compliance_alerts enable row level security;

do $$
begin
  if to_regclass('public.fi_users') is not null then
    drop policy if exists fi_staff_compliance_alerts_select_hr_admin
      on public.fi_staff_compliance_alerts;
    create policy fi_staff_compliance_alerts_select_hr_admin
      on public.fi_staff_compliance_alerts for select to authenticated
      using (
        exists (
          select 1 from public.fi_users u
          where u.auth_user_id = auth.uid()
            and u.tenant_id = fi_staff_compliance_alerts.tenant_id
            and lower(coalesce(u.role, '')) in ('fi_admin', 'admin', 'owner', 'hr_manager')
        )
      );
    grant select on public.fi_staff_compliance_alerts to authenticated;
  end if;
end $$;

grant select, insert, update, delete on public.fi_staff_compliance_alerts to service_role;

-- ---------------------------------------------------------------------------
-- fi_workforce_compliance_runs — daily audit run history
-- ---------------------------------------------------------------------------
create table if not exists public.fi_workforce_compliance_runs (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null references public.fi_tenants (id) on delete cascade,
  started_at timestamptz not null default now(),
  completed_at timestamptz,
  staff_checked integer not null default 0,
  alerts_generated integer not null default 0,
  status text not null default 'running',
  created_at timestamptz not null default now(),
  constraint fi_workforce_compliance_runs_status_chk check (
    status in ('running', 'completed', 'failed')
  )
);

comment on table public.fi_workforce_compliance_runs is
  'WorkforceOS Sprint 3: daily compliance cron audit run records.';

create index if not exists idx_fi_workforce_compliance_runs_tenant_started
  on public.fi_workforce_compliance_runs (tenant_id, started_at desc);

alter table public.fi_workforce_compliance_runs enable row level security;

do $$
begin
  if to_regclass('public.fi_users') is not null then
    drop policy if exists fi_workforce_compliance_runs_select_hr_admin
      on public.fi_workforce_compliance_runs;
    create policy fi_workforce_compliance_runs_select_hr_admin
      on public.fi_workforce_compliance_runs for select to authenticated
      using (
        exists (
          select 1 from public.fi_users u
          where u.auth_user_id = auth.uid()
            and u.tenant_id = fi_workforce_compliance_runs.tenant_id
            and lower(coalesce(u.role, '')) in ('fi_admin', 'admin', 'owner', 'hr_manager')
        )
      );
    grant select on public.fi_workforce_compliance_runs to authenticated;
  end if;
end $$;

grant select, insert, update, delete on public.fi_workforce_compliance_runs to service_role;

-- ---------------------------------------------------------------------------
-- Deep merge — include compliance_alerts
-- ---------------------------------------------------------------------------
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
  v_moved_rows integer := 0;
  v_counts jsonb := '{}'::jsonb;
  v_source_notes text;
  v_target_notes text;
begin
  if p_source_staff_member_id = p_target_staff_member_id then
    raise exception 'source and target staff member must differ';
  end if;

  select fi_staff_id, notes into v_source_fi_staff_id, v_source_notes
  from public.fi_staff_members
  where tenant_id = p_tenant_id and id = p_source_staff_member_id and archived_at is null;

  if not found then
    raise exception 'source staff member not found for tenant';
  end if;

  select fi_staff_id, notes into v_target_fi_staff_id, v_target_notes
  from public.fi_staff_members
  where tenant_id = p_tenant_id and id = p_target_staff_member_id and archived_at is null;

  if not found then
    raise exception 'target staff member not found for tenant';
  end if;

  update public.fi_staff_identity_links l
  set staff_member_id = p_target_staff_member_id, updated_at = v_now
  where l.tenant_id = p_tenant_id and l.staff_member_id = p_source_staff_member_id
    and not exists (
      select 1 from public.fi_staff_identity_links existing
      where existing.tenant_id = l.tenant_id
        and existing.source_system = l.source_system
        and existing.external_id = l.external_id
        and existing.staff_member_id = p_target_staff_member_id
    );
  get diagnostics v_moved_identity_links = row_count;
  v_counts := v_counts || jsonb_build_object('identity_links', v_moved_identity_links);

  if to_regclass('public.fi_staff_credentials') is not null then
    update public.fi_staff_credentials
    set staff_member_id = p_target_staff_member_id,
        fi_staff_id = coalesce(v_target_fi_staff_id, fi_staff_id),
        updated_at = v_now
    where tenant_id = p_tenant_id and staff_member_id = p_source_staff_member_id;
    get diagnostics v_moved_rows = row_count;
    v_counts := v_counts || jsonb_build_object('credentials', v_moved_rows);
  end if;

  if to_regclass('public.fi_staff_certifications') is not null then
    update public.fi_staff_certifications
    set staff_member_id = p_target_staff_member_id,
        fi_staff_id = coalesce(v_target_fi_staff_id, fi_staff_id),
        updated_at = v_now
    where tenant_id = p_tenant_id and staff_member_id = p_source_staff_member_id;
    get diagnostics v_moved_rows = row_count;
    v_counts := v_counts || jsonb_build_object('certifications', v_moved_rows);
  end if;

  if to_regclass('public.fi_staff_compliance_obligations') is not null then
    update public.fi_staff_compliance_obligations
    set staff_member_id = p_target_staff_member_id, updated_at = v_now
    where tenant_id = p_tenant_id and staff_member_id = p_source_staff_member_id;
    get diagnostics v_moved_rows = row_count;
    v_counts := v_counts || jsonb_build_object('compliance_obligations', v_moved_rows);
  end if;

  if to_regclass('public.fi_staff_compliance_alerts') is not null then
    update public.fi_staff_compliance_alerts
    set staff_member_id = p_target_staff_member_id, updated_at = v_now
    where tenant_id = p_tenant_id and staff_member_id = p_source_staff_member_id;
    get diagnostics v_moved_rows = row_count;
    v_counts := v_counts || jsonb_build_object('compliance_alerts', v_moved_rows);
  end if;

  if v_source_fi_staff_id is not null and v_target_fi_staff_id is not null
     and v_source_fi_staff_id <> v_target_fi_staff_id then

    if to_regclass('public.fi_staff_feature_access') is not null then
      update public.fi_staff_feature_access
      set staff_id = v_target_fi_staff_id, updated_at = v_now
      where tenant_id = p_tenant_id and staff_id = v_source_fi_staff_id;
      get diagnostics v_moved_rows = row_count;
      v_counts := v_counts || jsonb_build_object('feature_access', v_moved_rows);
    end if;

    if to_regclass('public.fi_staff_source_ids') is not null then
      update public.fi_staff_source_ids
      set staff_id = v_target_fi_staff_id, updated_at = v_now
      where tenant_id = p_tenant_id and staff_id = v_source_fi_staff_id
        and not exists (
          select 1 from public.fi_staff_source_ids e
          where e.tenant_id = p_tenant_id and e.staff_id = v_target_fi_staff_id
            and e.source_system = fi_staff_source_ids.source_system
            and e.source_staff_id = fi_staff_source_ids.source_staff_id
        );
      get diagnostics v_moved_rows = row_count;
      v_counts := v_counts || jsonb_build_object('source_ids', v_moved_rows);
    end if;

    if to_regclass('public.fi_staff_shifts') is not null then
      update public.fi_staff_shifts set staff_id = v_target_fi_staff_id, updated_at = v_now
      where tenant_id = p_tenant_id and staff_id = v_source_fi_staff_id;
      get diagnostics v_moved_rows = row_count;
      v_counts := v_counts || jsonb_build_object('shifts', v_moved_rows);
    end if;

    if to_regclass('public.fi_staff_event_assignments') is not null then
      update public.fi_staff_event_assignments set staff_id = v_target_fi_staff_id, updated_at = v_now
      where tenant_id = p_tenant_id and staff_id = v_source_fi_staff_id;
      get diagnostics v_moved_rows = row_count;
      v_counts := v_counts || jsonb_build_object('event_assignments', v_moved_rows);
    end if;

    if to_regclass('public.fi_staff_availability_blocks') is not null then
      update public.fi_staff_availability_blocks set staff_id = v_target_fi_staff_id, updated_at = v_now
      where tenant_id = p_tenant_id and staff_id = v_source_fi_staff_id;
      get diagnostics v_moved_rows = row_count;
      v_counts := v_counts || jsonb_build_object('availability_blocks', v_moved_rows);
    end if;

    if to_regclass('public.fi_staff_competency_projections') is not null then
      update public.fi_staff_competency_projections set staff_id = v_target_fi_staff_id, updated_at = v_now
      where tenant_id = p_tenant_id and staff_id = v_source_fi_staff_id;
      get diagnostics v_moved_rows = row_count;
      v_counts := v_counts || jsonb_build_object('competency_projections', v_moved_rows);
    end if;

    if to_regclass('public.fi_staff_procedure_privileges') is not null then
      update public.fi_staff_procedure_privileges set staff_id = v_target_fi_staff_id, updated_at = v_now
      where tenant_id = p_tenant_id and staff_id = v_source_fi_staff_id;
      get diagnostics v_moved_rows = row_count;
      v_counts := v_counts || jsonb_build_object('procedure_privileges', v_moved_rows);
    end if;

    if to_regclass('public.fi_staff_calendar_links') is not null then
      update public.fi_staff_calendar_links set staff_member_id = v_target_fi_staff_id, updated_at = v_now
      where tenant_id = p_tenant_id and staff_member_id = v_source_fi_staff_id;
      get diagnostics v_moved_rows = row_count;
      v_counts := v_counts || jsonb_build_object('calendar_links', v_moved_rows);
    end if;

    if to_regclass('public.fi_staff_access_grants') is not null then
      update public.fi_staff_access_grants set staff_member_id = p_target_staff_member_id, updated_at = v_now
      where tenant_id = p_tenant_id and staff_member_id = p_source_staff_member_id;
      get diagnostics v_moved_rows = row_count;
      v_counts := v_counts || jsonb_build_object('access_grants', v_moved_rows);
    end if;

    if to_regclass('public.fi_staff_field_access_grants') is not null then
      update public.fi_staff_field_access_grants set staff_member_id = p_target_staff_member_id, updated_at = v_now
      where tenant_id = p_tenant_id and staff_member_id = p_source_staff_member_id;
      get diagnostics v_moved_rows = row_count;
      v_counts := v_counts || jsonb_build_object('field_access_grants', v_moved_rows);
    end if;

    if to_regclass('public.fi_staff_pins') is not null then
      update public.fi_staff_pins set staff_id = v_target_fi_staff_id, updated_at = v_now
      where tenant_id = p_tenant_id and staff_id = v_source_fi_staff_id;
      get diagnostics v_moved_rows = row_count;
      v_counts := v_counts || jsonb_build_object('pins', v_moved_rows);
    end if;

    if to_regclass('public.fi_bookings') is not null then
      update public.fi_bookings set assigned_staff_id = v_target_fi_staff_id, updated_at = v_now
      where tenant_id = p_tenant_id and assigned_staff_id = v_source_fi_staff_id;
      get diagnostics v_moved_rows = row_count;
      v_counts := v_counts || jsonb_build_object('bookings', v_moved_rows);
    end if;

    if to_regclass('public.fi_staff_performance_profiles') is not null then
      update public.fi_staff_performance_profiles set staff_id = v_target_fi_staff_id, updated_at = v_now
      where tenant_id = p_tenant_id and staff_id = v_source_fi_staff_id;
      get diagnostics v_moved_rows = row_count;
      v_counts := v_counts || jsonb_build_object('performance_profiles', v_moved_rows);
    end if;

    if to_regclass('public.fi_staff_intelligence_events') is not null then
      update public.fi_staff_intelligence_events set staff_id = v_target_fi_staff_id
      where tenant_id = p_tenant_id and staff_id = v_source_fi_staff_id;
      get diagnostics v_moved_rows = row_count;
      v_counts := v_counts || jsonb_build_object('intelligence_events', v_moved_rows);
    end if;

    if to_regclass('public.fi_clinical_intelligence_events') is not null then
      update public.fi_clinical_intelligence_events set staff_id = v_target_fi_staff_id, updated_at = v_now
      where tenant_id = p_tenant_id and staff_id = v_source_fi_staff_id;
      get diagnostics v_moved_rows = row_count;
      v_counts := v_counts || jsonb_build_object('clinical_intelligence_events', v_moved_rows);
    end if;

    update public.fi_staff
    set is_active = false, employment_status = 'merged', updated_at = v_now
    where tenant_id = p_tenant_id and id = v_source_fi_staff_id;
  end if;

  if v_source_notes is not null and length(trim(v_source_notes)) > 0 then
    update public.fi_staff_members
    set notes = trim(both from coalesce(v_target_notes, '') || E'\n\n[Merged from ' || p_source_staff_member_id::text || ']\n' || v_source_notes),
        updated_at = v_now
    where tenant_id = p_tenant_id and id = p_target_staff_member_id;
  end if;

  update public.fi_staff_members
  set employment_status = 'merged',
      merged_into = p_target_staff_member_id,
      merged_at = v_now,
      updated_at = v_now
  where tenant_id = p_tenant_id and id = p_source_staff_member_id;

  update public.fi_staff_duplicate_candidates
  set status = 'resolved', resolved_at = v_now, resolved_by = p_merged_by, updated_at = v_now
  where tenant_id = p_tenant_id and status in ('open', 'approved_for_merge')
    and (
      (staff_a_id = p_source_staff_member_id and staff_b_id = p_target_staff_member_id)
      or (staff_a_id = p_target_staff_member_id and staff_b_id = p_source_staff_member_id)
    );

  return jsonb_build_object(
    'ok', true,
    'moved_identity_links', v_moved_identity_links,
    'archived_source_fi_staff', v_source_fi_staff_id is not null,
    'dependency_counts', v_counts
  );
end;
$$;