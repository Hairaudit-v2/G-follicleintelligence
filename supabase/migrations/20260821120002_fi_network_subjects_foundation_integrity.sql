-- Network subject foundation: integrity patch only (additive).
-- No new tables, no RLS visibility changes, no backfill, no app logic.

-- ---------------------------------------------------------------------------
-- 1) fi_network_subject_members.tenant_id must match fi_patients.tenant_id
--    for patient_id (BEFORE INSERT OR UPDATE; applies to service_role too).
-- ---------------------------------------------------------------------------
create or replace function public.fi_network_subject_members_enforce_patient_tenant_match()
returns trigger
language plpgsql
set search_path = public
as $$
declare
  v_patient_tenant_id uuid;
begin
  select p.tenant_id
    into strict v_patient_tenant_id
  from public.fi_patients p
  where p.id = new.patient_id;

  if new.tenant_id is distinct from v_patient_tenant_id then
    raise exception
      'fi_network_subject_members: tenant_id % does not match fi_patients.tenant_id % for patient_id % (membership tenant/patient invariant)',
      new.tenant_id,
      v_patient_tenant_id,
      new.patient_id
      using errcode = '23514';
  end if;

  return new;
exception
  when no_data_found then
    raise exception
      'fi_network_subject_members: patient_id % not found in fi_patients',
      new.patient_id;
end;
$$;

comment on function public.fi_network_subject_members_enforce_patient_tenant_match() is
  'BEFORE INSERT/UPDATE on fi_network_subject_members: tenant_id must equal fi_patients.tenant_id for patient_id (all roles).';

drop trigger if exists trg_fi_network_subject_members_enforce_patient_tenant_match
  on public.fi_network_subject_members;
create trigger trg_fi_network_subject_members_enforce_patient_tenant_match
  before insert or update on public.fi_network_subject_members
  for each row
  execute procedure public.fi_network_subject_members_enforce_patient_tenant_match();

-- ---------------------------------------------------------------------------
-- 2) updated_at (reuse fi_os_stage35_set_updated_at from stage 3.5 migration)
-- ---------------------------------------------------------------------------
drop trigger if exists trg_fi_network_subjects_set_updated_at on public.fi_network_subjects;
create trigger trg_fi_network_subjects_set_updated_at
  before update on public.fi_network_subjects
  for each row
  execute procedure public.fi_os_stage35_set_updated_at();

drop trigger if exists trg_fi_network_subject_members_set_updated_at on public.fi_network_subject_members;
create trigger trg_fi_network_subject_members_set_updated_at
  before update on public.fi_network_subject_members
  for each row
  execute procedure public.fi_os_stage35_set_updated_at();

-- ---------------------------------------------------------------------------
-- 3) confidence range [0, 1] when set
-- ---------------------------------------------------------------------------
alter table public.fi_network_subject_members
  drop constraint if exists fi_network_subject_members_confidence_range_chk;

alter table public.fi_network_subject_members
  add constraint fi_network_subject_members_confidence_range_chk
  check (confidence is null or (confidence >= 0 and confidence <= 1));

-- ---------------------------------------------------------------------------
-- 4) Privileges: authenticated SELECT (RLS); service_role DML + SELECT
-- ---------------------------------------------------------------------------
grant select on public.fi_network_subjects to authenticated, service_role;
grant insert, update, delete on public.fi_network_subjects to service_role;

grant select on public.fi_network_subject_members to authenticated, service_role;
grant insert, update, delete on public.fi_network_subject_members to service_role;
