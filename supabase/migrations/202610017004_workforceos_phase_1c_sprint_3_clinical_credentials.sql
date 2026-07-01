-- WorkforceOS Phase 1C Sprint 3: clinical credentials, certifications, compliance automation.

-- ---------------------------------------------------------------------------
-- fi_staff_credentials — legal/regulatory credentials (licenses, registrations)
-- ---------------------------------------------------------------------------
create table if not exists public.fi_staff_credentials (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null references public.fi_tenants (id) on delete cascade,
  staff_member_id uuid not null references public.fi_staff_members (id) on delete cascade,
  fi_staff_id uuid references public.fi_staff (id) on delete set null,
  credential_type text not null,
  credential_key text not null,
  display_name text not null,
  license_number text,
  issuing_authority text,
  jurisdiction text,
  issued_at timestamptz,
  expires_at timestamptz,
  status text not null default 'active',
  verification_status text not null default 'unverified',
  blocks_clinical_work boolean not null default true,
  metadata jsonb not null default '{}'::jsonb,
  archived_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint fi_staff_credentials_metadata_object check (jsonb_typeof(metadata) = 'object'),
  constraint fi_staff_credentials_type_chk check (
    credential_type in (
      'medical_license',
      'nursing_registration',
      'malpractice_insurance',
      'work_authorization',
      'professional_registration',
      'other'
    )
  ),
  constraint fi_staff_credentials_status_chk check (
    status in ('active', 'expired', 'suspended', 'revoked', 'pending_verification')
  ),
  constraint fi_staff_credentials_verification_chk check (
    verification_status in ('unverified', 'verified', 'failed')
  ),
  constraint fi_staff_credentials_tenant_member_key_unique
    unique (tenant_id, staff_member_id, credential_key)
);

comment on table public.fi_staff_credentials is
  'WorkforceOS Sprint 3: auditable legal/regulatory staff credentials with expiry tracking.';

create index if not exists idx_fi_staff_credentials_tenant_staff
  on public.fi_staff_credentials (tenant_id, staff_member_id);

create index if not exists idx_fi_staff_credentials_tenant_expires
  on public.fi_staff_credentials (tenant_id, expires_at)
  where archived_at is null and expires_at is not null;

alter table public.fi_staff_credentials enable row level security;

do $$
begin
  if to_regclass('public.fi_users') is not null then
    drop policy if exists fi_staff_credentials_select_hr_admin on public.fi_staff_credentials;
    create policy fi_staff_credentials_select_hr_admin
      on public.fi_staff_credentials for select to authenticated
      using (
        exists (
          select 1 from public.fi_users u
          where u.auth_user_id = auth.uid()
            and u.tenant_id = fi_staff_credentials.tenant_id
            and lower(coalesce(u.role, '')) in ('fi_admin', 'admin', 'owner', 'hr_manager')
        )
      );
    grant select on public.fi_staff_credentials to authenticated;
  end if;
end $$;

grant select, insert, update, delete on public.fi_staff_credentials to service_role;

-- ---------------------------------------------------------------------------
-- fi_staff_certifications — clinical / training certification records
-- ---------------------------------------------------------------------------
create table if not exists public.fi_staff_certifications (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null references public.fi_tenants (id) on delete cascade,
  staff_member_id uuid not null references public.fi_staff_members (id) on delete cascade,
  fi_staff_id uuid references public.fi_staff (id) on delete set null,
  certification_type text not null,
  certification_key text not null,
  display_name text not null,
  issued_at timestamptz,
  completed_at timestamptz,
  expires_at timestamptz,
  status text not null default 'current',
  source_system text,
  source_external_id text,
  academy_competency_key text,
  metadata jsonb not null default '{}'::jsonb,
  archived_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint fi_staff_certifications_metadata_object check (jsonb_typeof(metadata) = 'object'),
  constraint fi_staff_certifications_type_chk check (
    certification_type in ('clinical', 'safety', 'sop', 'academy', 'procedure', 'other')
  ),
  constraint fi_staff_certifications_status_chk check (
    status in ('current', 'due_soon', 'expired', 'missing', 'revoked')
  ),
  constraint fi_staff_certifications_tenant_member_key_unique
    unique (tenant_id, staff_member_id, certification_key)
);

comment on table public.fi_staff_certifications is
  'WorkforceOS Sprint 3: staff certification tracking (clinical, SOP, Academy-linked).';

create index if not exists idx_fi_staff_certifications_tenant_staff
  on public.fi_staff_certifications (tenant_id, staff_member_id);

create index if not exists idx_fi_staff_certifications_tenant_expires
  on public.fi_staff_certifications (tenant_id, expires_at)
  where archived_at is null and expires_at is not null;

alter table public.fi_staff_certifications enable row level security;

do $$
begin
  if to_regclass('public.fi_users') is not null then
    drop policy if exists fi_staff_certifications_select_hr_admin on public.fi_staff_certifications;
    create policy fi_staff_certifications_select_hr_admin
      on public.fi_staff_certifications for select to authenticated
      using (
        exists (
          select 1 from public.fi_users u
          where u.auth_user_id = auth.uid()
            and u.tenant_id = fi_staff_certifications.tenant_id
            and lower(coalesce(u.role, '')) in ('fi_admin', 'admin', 'owner', 'hr_manager')
        )
      );
    grant select on public.fi_staff_certifications to authenticated;
  end if;
end $$;

grant select, insert, update, delete on public.fi_staff_certifications to service_role;

-- ---------------------------------------------------------------------------
-- fi_staff_compliance_obligations — automated compliance queue
-- ---------------------------------------------------------------------------
create table if not exists public.fi_staff_compliance_obligations (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null references public.fi_tenants (id) on delete cascade,
  staff_member_id uuid not null references public.fi_staff_members (id) on delete cascade,
  obligation_type text not null,
  obligation_key text not null,
  title text not null,
  description text,
  due_at timestamptz,
  resolved_at timestamptz,
  status text not null default 'open',
  severity text not null default 'warning',
  source_table text,
  source_id uuid,
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint fi_staff_compliance_obligations_metadata_object check (jsonb_typeof(metadata) = 'object'),
  constraint fi_staff_compliance_obligations_type_chk check (
    obligation_type in (
      'credential_expiry',
      'certification_expiry',
      'sop_renewal',
      'training_due',
      'license_verification'
    )
  ),
  constraint fi_staff_compliance_obligations_status_chk check (
    status in ('open', 'due_soon', 'overdue', 'resolved', 'waived')
  ),
  constraint fi_staff_compliance_obligations_severity_chk check (
    severity in ('info', 'warning', 'blocking')
  ),
  constraint fi_staff_compliance_obligations_tenant_member_key_unique
    unique (tenant_id, staff_member_id, obligation_key)
);

comment on table public.fi_staff_compliance_obligations is
  'WorkforceOS Sprint 3: compliance automation obligations derived from credential/certification expiry.';

create index if not exists idx_fi_staff_compliance_obligations_tenant_status
  on public.fi_staff_compliance_obligations (tenant_id, status, due_at);

alter table public.fi_staff_compliance_obligations enable row level security;

do $$
begin
  if to_regclass('public.fi_users') is not null then
    drop policy if exists fi_staff_compliance_obligations_select_hr_admin
      on public.fi_staff_compliance_obligations;
    create policy fi_staff_compliance_obligations_select_hr_admin
      on public.fi_staff_compliance_obligations for select to authenticated
      using (
        exists (
          select 1 from public.fi_users u
          where u.auth_user_id = auth.uid()
            and u.tenant_id = fi_staff_compliance_obligations.tenant_id
            and lower(coalesce(u.role, '')) in ('fi_admin', 'admin', 'owner', 'hr_manager')
        )
      );
    grant select on public.fi_staff_compliance_obligations to authenticated;
  end if;
end $$;

grant select, insert, update, delete on public.fi_staff_compliance_obligations to service_role;

-- ---------------------------------------------------------------------------
-- Deep relational merge (Sprint 3) — replaces Sprint 2 RPC
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

  -- Member-level: identity links
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

  -- Member-level: Sprint 3 credentials / certifications / compliance
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

  -- Operational fi_staff dependencies
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
      update public.fi_staff_access_grants set staff_member_id = v_target_fi_staff_id, updated_at = v_now
      where tenant_id = p_tenant_id and staff_member_id = v_source_fi_staff_id;
      get diagnostics v_moved_rows = row_count;
      v_counts := v_counts || jsonb_build_object('access_grants', v_moved_rows);
    end if;

    if to_regclass('public.fi_staff_field_access_grants') is not null then
      update public.fi_staff_field_access_grants set staff_member_id = v_target_fi_staff_id, updated_at = v_now
      where tenant_id = p_tenant_id and staff_member_id = v_source_fi_staff_id;
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

    -- TODO: fi_staff_training_assignments when shipped
    -- TODO: fi_staff_sop_acknowledgements when shipped
    -- TODO: fi_staff_compliance_documents when shipped
    -- TODO: fi_staff_timesheet_entries when shipped
    -- TODO: dedicated surgery assignment table when shipped (bookings covered above)

    update public.fi_staff
    set is_active = false, employment_status = 'merged', updated_at = v_now
    where tenant_id = p_tenant_id and id = v_source_fi_staff_id;
  end if;

  -- Append staff notes (never delete source notes)
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

comment on function public.workforce_merge_staff_members is
  'WorkforceOS Sprint 3: deep relational merge. Archives source; preserves audit history; never hard-deletes.';