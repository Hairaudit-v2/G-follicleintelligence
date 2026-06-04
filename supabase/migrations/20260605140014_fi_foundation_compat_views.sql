-- Follicle Intelligence Foundation Layer (Stage 1D): compatibility read models
-- See docs/design/07-foundation-migration-specification.md Section 7 (compat views)
-- and docs/design/06-foundation-layer-architecture.md.
-- Read-only: no writes through these views. LEFT JOINs preserve legacy rows without foundation mappings.
-- security_invoker: underlying table RLS applies to the caller (no SECURITY DEFINER elevation).

-- ---------------------------------------------------------------------------
-- 1) v_fi_patient_resolution — legacy global patient stub → foundation person/patient
-- ---------------------------------------------------------------------------
create or replace view v_fi_patient_resolution
with (security_invoker = true) as
with global_rows as (
  select
    g.tenant_id,
    g.id as global_patient_id,
    fp.id as foundation_patient_id,
    fper.id as person_id,
    g.source_system,
    g.source_patient_id,
    coalesce(
      g.metadata_json ->> 'patient_name',
      g.metadata_json ->> 'display_name',
      g.metadata_json ->> 'full_name',
      intake_by_case.full_name,
      intake_by_patient_fk.full_name
    ) as display_name,
    coalesce(
      g.metadata_json ->> 'email',
      intake_by_case.email,
      intake_by_patient_fk.email
    ) as email,
    (g.metadata_json ->> 'phone')::text as phone,
    g.created_at
  from fi_global_patients g
  left join fi_patient_source_ids psi
    on psi.tenant_id = g.tenant_id
    and psi.source_system = g.source_system
    and psi.source_patient_id = g.source_patient_id
  left join fi_patients fp on fp.id = psi.patient_id
  left join fi_persons fper on fper.id = fp.person_id
  left join lateral (
    select i.full_name, i.email
    from fi_intakes i
    inner join fi_cases c on c.id = i.case_id
    where c.tenant_id = g.tenant_id
      and c.foundation_patient_id is not null
      and c.foundation_patient_id = fp.id
    order by i.updated_at desc nulls last
    limit 1
  ) intake_by_case on true
  left join lateral (
    select i.full_name, i.email
    from fi_intakes i
    where i.tenant_id = g.tenant_id
      and i.patient_id is not null
      and i.patient_id = fp.id
    order by i.updated_at desc nulls last
    limit 1
  ) intake_by_patient_fk on true
),
foundation_only as (
  select distinct on (fp.id)
    fp.tenant_id,
    null::uuid as global_patient_id,
    fp.id as foundation_patient_id,
    fp.person_id as person_id,
    psi.source_system,
    psi.source_patient_id,
    coalesce(
      fp.metadata ->> 'display_name',
      fp.metadata ->> 'patient_name',
      ic.full_name
    ) as display_name,
    coalesce(fp.metadata ->> 'email', ic.email) as email,
    (fp.metadata ->> 'phone')::text as phone,
    fp.created_at
  from fi_patients fp
  inner join fi_patient_source_ids psi on psi.patient_id = fp.id
  left join fi_global_patients g
    on g.tenant_id = psi.tenant_id
    and g.source_system = psi.source_system
    and g.source_patient_id = psi.source_patient_id
  left join lateral (
    select i.full_name, i.email
    from fi_intakes i
    inner join fi_cases c on c.id = i.case_id
    where c.tenant_id = fp.tenant_id
      and c.foundation_patient_id = fp.id
    order by i.updated_at desc nulls last
    limit 1
  ) ic on true
  where g.id is null
  order by fp.id, psi.created_at desc
)
select * from global_rows
union all
select * from foundation_only;

comment on view v_fi_patient_resolution is
  'Follicle Intelligence Foundation Layer (Stage 1D): resolves fi_global_patients to fi_patients/fi_persons via fi_patient_source_ids; enriches display/email from metadata_json and fi_intakes when linked.';

-- ---------------------------------------------------------------------------
-- 2) v_fi_case_foundation — single readable case row with global + foundation ids
-- ---------------------------------------------------------------------------
create or replace view v_fi_case_foundation
with (security_invoker = true) as
select
  c.tenant_id,
  c.id as case_id,
  gc.id as global_case_id,
  c.foundation_patient_id,
  gc.global_patient_id,
  fp.person_id,
  c.clinic_id,
  c.organisation_id,
  coalesce(c.metadata ->> 'case_type', c.metadata ->> 'event_type') as case_type,
  c.status,
  coalesce(gc.source_system, c.metadata ->> 'source_system') as source_system,
  coalesce(gc.source_case_id, c.metadata ->> 'source_case_id') as source_case_id,
  c.created_at,
  c.updated_at
from fi_cases c
left join lateral (
  select g.*
  from fi_global_cases g
  where g.fi_case_id = c.id
  order by g.created_at desc nulls last
  limit 1
) gc on true
left join fi_patients fp on fp.id = c.foundation_patient_id;

comment on view v_fi_case_foundation is
  'Follicle Intelligence Foundation Layer (Stage 1D): fi_cases with optional fi_global_cases bridge and foundation patient → person.';

-- ---------------------------------------------------------------------------
-- 3) v_fi_media_unified — legacy fi_uploads + fi_media_assets (normalized asset_type)
-- row_to_json(u) tolerates historical fi_uploads columns (type vs kind, optional created_by).
-- ---------------------------------------------------------------------------
create or replace view v_fi_media_unified
with (security_invoker = true) as
select
  u.tenant_id,
  null::uuid as media_asset_id,
  u.id as legacy_upload_id,
  coalesce(c.foundation_patient_id, ix.patient_id) as patient_id,
  coalesce(c.foundation_patient_id, ix.patient_id) as foundation_patient_id,
  u.case_id,
  c.metadata ->> 'source_system' as source_system,
  null::text as source_asset_id,
  coalesce(
    (row_to_json(u)::jsonb ->> 'type')::text,
    (row_to_json(u)::jsonb ->> 'kind')::text
  ) as asset_type,
  u.storage_path,
  u.filename as file_name,
  u.mime_type,
  u.created_at,
  (row_to_json(u)::jsonb ->> 'created_by')::uuid as uploaded_by
from fi_uploads u
left join fi_cases c on c.id = u.case_id and c.tenant_id = u.tenant_id
left join lateral (
  select i2.patient_id
  from fi_intakes i2
  where i2.case_id = u.case_id
    and i2.tenant_id = u.tenant_id
  order by i2.updated_at desc nulls last
  limit 1
) ix on true
union all
select
  ma.tenant_id,
  ma.id as media_asset_id,
  null::uuid as legacy_upload_id,
  ma.patient_id,
  coalesce(ma.patient_id, c2.foundation_patient_id) as foundation_patient_id,
  ma.case_id,
  ma.source_system,
  ma.source_asset_id,
  ma.asset_type,
  ma.storage_path,
  ma.filename as file_name,
  ma.mime_type,
  ma.created_at,
  null::uuid as uploaded_by
from fi_media_assets ma
left join fi_cases c2 on c2.id = ma.case_id and c2.tenant_id = ma.tenant_id;

comment on view v_fi_media_unified is
  'Follicle Intelligence Foundation Layer (Stage 1D): UNION of fi_uploads (legacy) and fi_media_assets; legacy asset_type from type/kind via row_to_json.';

grant select on v_fi_patient_resolution to authenticated, service_role;
grant select on v_fi_case_foundation to authenticated, service_role;
grant select on v_fi_media_unified to authenticated, service_role;
