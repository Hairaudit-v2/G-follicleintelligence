-- ImagingOS: clinical imaging metadata on fi_patient_images, protocol catalog, scalp maps,
-- region links, vector annotation layers (separate from raster), AI job queue, and v_fi_media_unified extension.
-- Writes: service role (Next.js). Authenticated tenant members: SELECT on new tables (RLS).

-- ---------------------------------------------------------------------------
-- fi_patient_images — longitudinal imaging metadata (indexed for multi-clinic scale)
-- ---------------------------------------------------------------------------
alter table fi_patient_images
  add column if not exists imaging_library_axis text not null default 'general_clinical';

alter table fi_patient_images
  add column if not exists clinic_id uuid references fi_clinics (id) on delete set null;

alter table fi_patient_images
  add column if not exists captured_by_staff_id uuid references fi_staff (id) on delete set null;

alter table fi_patient_images
  add column if not exists device_type text;

alter table fi_patient_images
  add column if not exists anatomical_region text;

alter table fi_patient_images
  add column if not exists visit_type text;

alter table fi_patient_images
  add column if not exists follow_up_interval text;

alter table fi_patient_images
  add column if not exists imaging_protocol_template_slug text;

alter table fi_patient_images
  add column if not exists imaging_protocol_slot_slug text;

alter table fi_patient_images drop constraint if exists fi_patient_images_imaging_library_axis_chk;

alter table fi_patient_images
  add constraint fi_patient_images_imaging_library_axis_chk check (
    imaging_library_axis in (
      'consultation',
      'surgery',
      'follow_up',
      'trichoscopy',
      'pathology',
      'general_clinical'
    )
  );

alter table fi_patient_images drop constraint if exists fi_patient_images_anatomical_region_chk;

alter table fi_patient_images
  add constraint fi_patient_images_anatomical_region_chk check (
    anatomical_region is null
    or anatomical_region in (
      'hairline',
      'frontal_third',
      'midscalp',
      'crown',
      'donor',
      'temple_left',
      'temple_right',
      'scar',
      'beard',
      'eyebrow',
      'body_hair',
      'global',
      'other'
    )
  );

alter table fi_patient_images drop constraint if exists fi_patient_images_device_type_len;

alter table fi_patient_images
  add constraint fi_patient_images_device_type_len check (device_type is null or char_length (device_type) <= 160);

alter table fi_patient_images drop constraint if exists fi_patient_images_visit_type_len;

alter table fi_patient_images
  add constraint fi_patient_images_visit_type_len check (visit_type is null or char_length (visit_type) <= 160);

alter table fi_patient_images drop constraint if exists fi_patient_images_follow_up_interval_len;

alter table fi_patient_images
  add constraint fi_patient_images_follow_up_interval_len check (
    follow_up_interval is null or char_length (follow_up_interval) <= 64
  );

alter table fi_patient_images drop constraint if exists fi_patient_images_protocol_slug_len;

alter table fi_patient_images
  add constraint fi_patient_images_protocol_slug_len check (
    imaging_protocol_template_slug is null or char_length (imaging_protocol_template_slug) <= 128
  );

alter table fi_patient_images drop constraint if exists fi_patient_images_protocol_slot_len;

alter table fi_patient_images
  add constraint fi_patient_images_protocol_slot_len check (
    imaging_protocol_slot_slug is null or char_length (imaging_protocol_slot_slug) <= 128
  );

create index if not exists idx_fi_patient_images_tenant_patient_library_axis
  on fi_patient_images (tenant_id, patient_id, imaging_library_axis)
  where image_status = 'active';

create index if not exists idx_fi_patient_images_tenant_patient_anatomical
  on fi_patient_images (tenant_id, patient_id, anatomical_region)
  where image_status = 'active' and anatomical_region is not null;

create index if not exists idx_fi_patient_images_tenant_clinic
  on fi_patient_images (tenant_id, clinic_id)
  where clinic_id is not null;

comment on column fi_patient_images.imaging_library_axis is
  'ImagingOS: primary clinical folder (consultation, surgery, follow-up, trichoscopy, pathology, general).';

comment on column fi_patient_images.anatomical_region is
  'ImagingOS: scalp / adjunct region tag for mapping and search.';

-- ---------------------------------------------------------------------------
-- Protocol templates (tenant_id null = global catalog)
-- ---------------------------------------------------------------------------
create table if not exists fi_imaging_protocol_templates (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid references fi_tenants (id) on delete cascade,
  slug text not null,
  name text not null,
  description text,
  slots jsonb not null default '{"slots":[]}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint fi_imaging_protocol_templates_slots_object check (jsonb_typeof (slots) = 'object')
);

comment on table fi_imaging_protocol_templates is
  'ImagingOS: standard photography protocol definitions (required slots + labels).';

create unique index if not exists idx_fi_imaging_protocol_templates_global_slug
  on fi_imaging_protocol_templates (slug)
  where tenant_id is null;

create unique index if not exists idx_fi_imaging_protocol_templates_tenant_slug
  on fi_imaging_protocol_templates (tenant_id, slug)
  where tenant_id is not null;

-- ---------------------------------------------------------------------------
-- Per-patient protocol progress (slot slug -> fulfilled image ids)
-- ---------------------------------------------------------------------------
create table if not exists fi_imaging_protocol_sessions (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null references fi_tenants (id) on delete cascade,
  patient_id uuid not null references fi_patients (id) on delete cascade,
  case_id uuid references fi_cases (id) on delete set null,
  consultation_id uuid references fi_consultations (id) on delete set null,
  template_slug text not null,
  progress jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint fi_imaging_protocol_sessions_progress_object check (jsonb_typeof (progress) = 'object')
);

comment on table fi_imaging_protocol_sessions is
  'ImagingOS: tracks which protocol slots have patient_image UUIDs attached.';

create index if not exists idx_fi_imaging_protocol_sessions_tenant_patient
  on fi_imaging_protocol_sessions (tenant_id, patient_id);

create index if not exists idx_fi_imaging_protocol_sessions_template
  on fi_imaging_protocol_sessions (tenant_id, template_slug);

-- ---------------------------------------------------------------------------
-- Scalp wireframe / drawn regions (JSON state; images link via fi_imaging_image_region_links)
-- ---------------------------------------------------------------------------
create table if not exists fi_imaging_scalp_maps (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null references fi_tenants (id) on delete cascade,
  patient_id uuid not null references fi_patients (id) on delete cascade,
  consultation_id uuid references fi_consultations (id) on delete set null,
  case_id uuid references fi_cases (id) on delete set null,
  title text not null default 'Scalp map',
  state_json jsonb not null default '{"wireframeVersion":"v1","highlightedRegions":[],"paths":[],"notes":[]}'::jsonb,
  created_by_user_id uuid references fi_users (id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint fi_imaging_scalp_maps_state_object check (jsonb_typeof (state_json) = 'object')
);

comment on table fi_imaging_scalp_maps is
  'ImagingOS: interactive scalp map document (highlights, freehand paths, notes) — raster originals stay on fi_patient_images.';

create index if not exists idx_fi_imaging_scalp_maps_tenant_patient
  on fi_imaging_scalp_maps (tenant_id, patient_id);

-- ---------------------------------------------------------------------------
-- Link images to anatomical regions (and optionally a scalp map revision)
-- ---------------------------------------------------------------------------
create table if not exists fi_imaging_image_region_links (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null references fi_tenants (id) on delete cascade,
  patient_image_id uuid not null references fi_patient_images (id) on delete cascade,
  scalp_map_id uuid references fi_imaging_scalp_maps (id) on delete set null,
  anatomical_region text not null,
  notes text,
  created_at timestamptz not null default now(),
  constraint fi_imaging_image_region_links_region_chk check (
    anatomical_region in (
      'hairline',
      'frontal_third',
      'midscalp',
      'crown',
      'donor',
      'temple_left',
      'temple_right',
      'scar',
      'beard',
      'eyebrow',
      'body_hair',
      'global',
      'other'
    )
  ),
  constraint fi_imaging_image_region_links_notes_len check (notes is null or char_length (notes) <= 4000)
);

create index if not exists idx_fi_imaging_image_region_links_image
  on fi_imaging_image_region_links (tenant_id, patient_image_id);

create index if not exists idx_fi_imaging_image_region_links_map
  on fi_imaging_image_region_links (tenant_id, scalp_map_id)
  where scalp_map_id is not null;

-- ---------------------------------------------------------------------------
-- Clinical annotations (vector / JSON — never overwrites original pixels)
-- ---------------------------------------------------------------------------
create table if not exists fi_imaging_annotation_sets (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null references fi_tenants (id) on delete cascade,
  patient_image_id uuid not null references fi_patient_images (id) on delete cascade,
  schema_version text not null default 'imaging-annotation.v1',
  payload jsonb not null default '{"elements":[]}'::jsonb,
  created_by_user_id uuid references fi_users (id) on delete set null,
  updated_by_user_id uuid references fi_users (id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint fi_imaging_annotation_sets_payload_object check (jsonb_typeof (payload) = 'object'),
  constraint fi_imaging_annotation_sets_one_per_image unique (tenant_id, patient_image_id)
);

comment on table fi_imaging_annotation_sets is
  'ImagingOS: arrows, shapes, measurements, and text overlays stored separately from fi_patient_images storage objects.';

create index if not exists idx_fi_imaging_annotation_sets_tenant_image
  on fi_imaging_annotation_sets (tenant_id, patient_image_id);

-- ---------------------------------------------------------------------------
-- AI-ready job queue (no inference here — workers enqueue / complete rows)
-- ---------------------------------------------------------------------------
create table if not exists fi_imaging_ai_analysis_jobs (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null references fi_tenants (id) on delete cascade,
  patient_image_id uuid not null references fi_patient_images (id) on delete cascade,
  analysis_kind text not null,
  status text not null default 'queued',
  request_payload jsonb not null default '{}'::jsonb,
  result_payload jsonb,
  error_message text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  completed_at timestamptz,
  constraint fi_imaging_ai_analysis_jobs_kind_chk check (
    analysis_kind in ('density_estimate', 'norwood_grade', 'donor_assessment', 'outcome_score')
  ),
  constraint fi_imaging_ai_analysis_jobs_status_chk check (
    status in ('queued', 'running', 'completed', 'failed', 'superseded')
  ),
  constraint fi_imaging_ai_analysis_jobs_request_object check (jsonb_typeof (request_payload) = 'object'),
  constraint fi_imaging_ai_analysis_jobs_result_object check (
    result_payload is null or jsonb_typeof (result_payload) = 'object'
  )
);

comment on table fi_imaging_ai_analysis_jobs is
  'ImagingOS: durable queue + results for HairIntel-style CV models (density, grading, donor, outcomes).';

create index if not exists idx_fi_imaging_ai_jobs_tenant_image_kind
  on fi_imaging_ai_analysis_jobs (tenant_id, patient_image_id, analysis_kind);

create index if not exists idx_fi_imaging_ai_jobs_status_created
  on fi_imaging_ai_analysis_jobs (tenant_id, status, created_at desc);

-- ---------------------------------------------------------------------------
-- RLS (tenant member SELECT only)
-- ---------------------------------------------------------------------------
alter table fi_imaging_protocol_templates enable row level security;

drop policy if exists fi_imaging_protocol_templates_select_member on fi_imaging_protocol_templates;
create policy fi_imaging_protocol_templates_select_member on fi_imaging_protocol_templates for select to authenticated using (
  tenant_id is null
  or exists (
    select 1
    from fi_users u
    where
      u.auth_user_id = auth.uid()
      and u.tenant_id = fi_imaging_protocol_templates.tenant_id
  )
);

alter table fi_imaging_protocol_sessions enable row level security;

drop policy if exists fi_imaging_protocol_sessions_select_member on fi_imaging_protocol_sessions;
create policy fi_imaging_protocol_sessions_select_member on fi_imaging_protocol_sessions for select to authenticated using (
  exists (
    select 1
    from fi_users u
    where
      u.auth_user_id = auth.uid()
      and u.tenant_id = fi_imaging_protocol_sessions.tenant_id
  )
);

alter table fi_imaging_scalp_maps enable row level security;

drop policy if exists fi_imaging_scalp_maps_select_member on fi_imaging_scalp_maps;
create policy fi_imaging_scalp_maps_select_member on fi_imaging_scalp_maps for select to authenticated using (
  exists (
    select 1
    from fi_users u
    where
      u.auth_user_id = auth.uid()
      and u.tenant_id = fi_imaging_scalp_maps.tenant_id
  )
);

alter table fi_imaging_image_region_links enable row level security;

drop policy if exists fi_imaging_image_region_links_select_member on fi_imaging_image_region_links;
create policy fi_imaging_image_region_links_select_member on fi_imaging_image_region_links for select to authenticated using (
  exists (
    select 1
    from fi_users u
    where
      u.auth_user_id = auth.uid()
      and u.tenant_id = fi_imaging_image_region_links.tenant_id
  )
);

alter table fi_imaging_annotation_sets enable row level security;

drop policy if exists fi_imaging_annotation_sets_select_member on fi_imaging_annotation_sets;
create policy fi_imaging_annotation_sets_select_member on fi_imaging_annotation_sets for select to authenticated using (
  exists (
    select 1
    from fi_users u
    where
      u.auth_user_id = auth.uid()
      and u.tenant_id = fi_imaging_annotation_sets.tenant_id
  )
);

alter table fi_imaging_ai_analysis_jobs enable row level security;

drop policy if exists fi_imaging_ai_analysis_jobs_select_member on fi_imaging_ai_analysis_jobs;
create policy fi_imaging_ai_analysis_jobs_select_member on fi_imaging_ai_analysis_jobs for select to authenticated using (
  exists (
    select 1
    from fi_users u
    where
      u.auth_user_id = auth.uid()
      and u.tenant_id = fi_imaging_ai_analysis_jobs.tenant_id
  )
);

grant select on fi_imaging_protocol_templates to authenticated, service_role;
grant select on fi_imaging_protocol_sessions to authenticated, service_role;
grant select on fi_imaging_scalp_maps to authenticated, service_role;
grant select on fi_imaging_image_region_links to authenticated, service_role;
grant select on fi_imaging_annotation_sets to authenticated, service_role;
grant select on fi_imaging_ai_analysis_jobs to authenticated, service_role;

-- ---------------------------------------------------------------------------
-- Seed global protocol templates (idempotent)
-- ---------------------------------------------------------------------------
insert into
  fi_imaging_protocol_templates (tenant_id, slug, name, description, slots)
values
  (
    null,
    'hair_loss_consultation',
    'Hair Loss Consultation',
    'Global donor and pattern documentation for first consultation.',
    $j${"slots":[
      {"slug":"global_front","label":"Global — front","required":true,"suggested_region":"global"},
      {"slug":"global_vertex","label":"Global — vertex / crown","required":true,"suggested_region":"crown"},
      {"slug":"global_left_profile","label":"Global — left profile","required":true,"suggested_region":"temple_left"},
      {"slug":"global_right_profile","label":"Global — right profile","required":true,"suggested_region":"temple_right"},
      {"slug":"donor_overview","label":"Donor zone overview","required":true,"suggested_region":"donor"}
    ]}$j$::jsonb
  ),
  (
    null,
    'hair_transplant_planning',
    'Hair Transplant Planning',
    'Recipient design and donor planning photography.',
    $j${"slots":[
      {"slug":"hairline_design","label":"Hairline design (frontal)","required":true,"suggested_region":"hairline"},
      {"slug":"recipient_midscalp","label":"Recipient — midscalp","required":false,"suggested_region":"midscalp"},
      {"slug":"recipient_crown","label":"Recipient — crown","required":false,"suggested_region":"crown"},
      {"slug":"donor_density","label":"Donor strip / FUE field","required":true,"suggested_region":"donor"}
    ]}$j$::jsonb
  ),
  (
    null,
    'surgery_day',
    'Surgery Day',
    'Pre-op marking and intra-operative documentation.',
    $j${"slots":[
      {"slug":"preop_marking","label":"Pre-op markings","required":true,"suggested_region":"hairline"},
      {"slug":"graft_placement","label":"Recipient sites / placement","required":false,"suggested_region":"frontal_third"},
      {"slug":"donor_harvest","label":"Donor harvest field","required":true,"suggested_region":"donor"}
    ]}$j$::jsonb
  ),
  (
    null,
    'follow_up_review',
    'Follow-up Review',
    'Standardised interval outcome capture.',
    $j${"slots":[
      {"slug":"fu_front","label":"Follow-up — front","required":true,"suggested_region":"hairline"},
      {"slug":"fu_top","label":"Follow-up — top / vertex","required":true,"suggested_region":"crown"},
      {"slug":"fu_donor","label":"Follow-up — donor healing","required":false,"suggested_region":"donor"}
    ]}$j$::jsonb
  ),
  (
    null,
    'trichoscopy_review',
    'Trichoscopy Review',
    'Dermoscopic patterns by zone.',
    $j${"slots":[
      {"slug":"tri_frontal","label":"Trichoscopy — frontal","required":true,"suggested_region":"frontal_third"},
      {"slug":"tri_vertex","label":"Trichoscopy — vertex","required":true,"suggested_region":"crown"},
      {"slug":"tri_donor","label":"Trichoscopy — donor","required":false,"suggested_region":"donor"}
    ]}$j$::jsonb
  )
on conflict (slug) where (tenant_id is null) do nothing;

-- ---------------------------------------------------------------------------
-- v_fi_media_unified — include active fi_patient_images for Patient Twin / foundation rollups
-- ---------------------------------------------------------------------------
create or replace view v_fi_media_unified
with
  (security_invoker = true) as
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
left join fi_cases c2 on c2.id = ma.case_id and c2.tenant_id = ma.tenant_id
union all
select
  pi.tenant_id,
  null::uuid as media_asset_id,
  pi.id as legacy_upload_id,
  pi.patient_id,
  pi.patient_id as foundation_patient_id,
  pi.case_id,
  'fi_patient_images'::text as source_system,
  pi.id::text as source_asset_id,
  ('patient_image:' || pi.imaging_library_axis)::text as asset_type,
  pi.storage_path,
  coalesce(pi.original_filename, pi.storage_path) as file_name,
  pi.content_type as mime_type,
  coalesce(pi.taken_at, pi.created_at) as created_at,
  pi.uploaded_by_user_id as uploaded_by
from fi_patient_images pi
where
  pi.image_status = 'active';

comment on view v_fi_media_unified is
  'Foundation media union: fi_uploads, fi_media_assets, and active fi_patient_images (ImagingOS library axis in asset_type).';
