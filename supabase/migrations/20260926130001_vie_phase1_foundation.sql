-- Visual Intelligence Engine (VIE) — Phase 1 foundation
-- Protocol catalog seeds, capture intelligence ledger, Patient Twin sync support.
-- AI vision is NOT implemented; fi_vie_capture_intelligence stores architecture stubs.

-- ---------------------------------------------------------------------------
-- VIE protocol templates (global catalog — idempotent upsert)
-- ---------------------------------------------------------------------------
insert into
  fi_imaging_protocol_templates (tenant_id, slug, name, description, slots)
values
  (
    null,
    'baseline_consultation',
    'Baseline Consultation',
    'Standardised baseline scalp photography for initial consultation and Patient Twin seeding.',
    $j${"slots":[
      {"slug":"front_hairline","label":"Front hairline","required":true,"suggested_region":"hairline","capture_guide":"front_hairline","instruction":"Face the camera directly. Include the full hairline from ear to ear."},
      {"slug":"left_temple","label":"Left temple","required":true,"suggested_region":"temple_left","capture_guide":"left_temple","instruction":"Turn head slightly right to expose the left temple."},
      {"slug":"right_temple","label":"Right temple","required":true,"suggested_region":"temple_right","capture_guide":"right_temple","instruction":"Turn head slightly left to expose the right temple."},
      {"slug":"crown","label":"Crown","required":true,"suggested_region":"crown","capture_guide":"crown","instruction":"Centre the crown / vertex in frame."},
      {"slug":"top_down","label":"Top down","required":true,"suggested_region":"midscalp","capture_guide":"top_down","instruction":"Capture a true overhead view of the midscalp and crown."},
      {"slug":"donor_zone","label":"Donor zone","required":true,"suggested_region":"donor","capture_guide":"donor_zone","instruction":"Document the occipital donor area with hair parted or clipped."}
    ]}$j$::jsonb
  ),
  (
    null,
    'post_op_review',
    'Post-op Review',
    'Immediate post-operative healing and graft survival documentation.',
    $j${"slots":[
      {"slug":"postop_front","label":"Post-op — front","required":true,"suggested_region":"hairline","capture_guide":"healing_progress","instruction":"Frontal view showing graft crusting and hairline post-procedure."},
      {"slug":"postop_crown","label":"Post-op — crown","required":true,"suggested_region":"crown","capture_guide":"healing_progress","instruction":"Crown recipient zone healing within 24–72 hours post-op."},
      {"slug":"postop_donor","label":"Post-op — donor","required":true,"suggested_region":"donor","capture_guide":"donor_zone","instruction":"Donor healing and punch sites documentation."}
    ]}$j$::jsonb
  ),
  (
    null,
    'repair_surgery_review',
    'Repair Surgery Review',
    'Documentation for corrective / repair procedures and outcome assessment.',
    $j${"slots":[
      {"slug":"repair_problem_zone","label":"Problem zone","required":true,"suggested_region":"hairline","capture_guide":"repair_zone","instruction":"Capture the area requiring repair."},
      {"slug":"repair_donor_status","label":"Donor status","required":true,"suggested_region":"donor","capture_guide":"donor_zone","instruction":"Document remaining donor capacity and prior harvest scarring."},
      {"slug":"repair_plan_view","label":"Repair plan view","required":true,"suggested_region":"frontal_third","capture_guide":"recipient_zone","instruction":"Capture proposed repair zone with markings."}
    ]}$j$::jsonb
  )
on conflict (slug) where (tenant_id is null) do update
set
  name = excluded.name,
  description = excluded.description,
  slots = excluded.slots,
  updated_at = now();

-- Upsert VIE-aligned versions of existing ImagingOS templates
insert into
  fi_imaging_protocol_templates (tenant_id, slug, name, description, slots)
values
  (
    null,
    'hair_transplant_planning',
    'Hair Transplant Planning',
    'Recipient design and donor assessment photography for surgical planning.',
    $j${"slots":[
      {"slug":"hairline_design","label":"Hairline design","required":true,"suggested_region":"hairline","capture_guide":"front_hairline","instruction":"Capture proposed hairline markings from the front."},
      {"slug":"recipient_midscalp","label":"Recipient — midscalp","required":true,"suggested_region":"midscalp","capture_guide":"recipient_zone","instruction":"Document the midscalp recipient zone."},
      {"slug":"recipient_crown","label":"Recipient — crown","required":true,"suggested_region":"crown","capture_guide":"crown","instruction":"Capture the crown recipient area."},
      {"slug":"donor_density","label":"Donor density","required":true,"suggested_region":"donor","capture_guide":"donor_zone","instruction":"Close-up donor zone for density assessment."}
    ]}$j$::jsonb
  ),
  (
    null,
    'surgery_day',
    'Surgery Day',
    'Pre-op marking and intra-operative documentation.',
    $j${"slots":[
      {"slug":"preop_marking","label":"Pre-op markings","required":true,"suggested_region":"hairline","capture_guide":"surgical_field","instruction":"Capture all surgical markings before anaesthesia."},
      {"slug":"recipient_sites","label":"Recipient sites","required":true,"suggested_region":"frontal_third","capture_guide":"recipient_zone","instruction":"Document recipient site creation or graft placement."},
      {"slug":"donor_harvest","label":"Donor harvest","required":true,"suggested_region":"donor","capture_guide":"donor_zone","instruction":"Capture the donor harvest field."}
    ]}$j$::jsonb
  ),
  (
    null,
    'follow_up_review',
    'Follow-up Review',
    'Standardised interval outcome capture for longitudinal tracking.',
    $j${"slots":[
      {"slug":"fu_front","label":"Follow-up — front","required":true,"suggested_region":"hairline","capture_guide":"front_hairline","instruction":"Match baseline front hairline framing."},
      {"slug":"fu_top","label":"Follow-up — top / vertex","required":true,"suggested_region":"crown","capture_guide":"top_down","instruction":"Overhead view matching baseline top-down angle."},
      {"slug":"fu_donor","label":"Follow-up — donor","required":false,"suggested_region":"donor","capture_guide":"donor_zone","instruction":"Donor healing at follow-up interval."}
    ]}$j$::jsonb
  )
on conflict (slug) where (tenant_id is null) do update
set
  name = excluded.name,
  description = excluded.description,
  slots = excluded.slots,
  updated_at = now();

-- ---------------------------------------------------------------------------
-- VIE capture intelligence ledger (Phase 1 stubs — no AI vision)
-- ---------------------------------------------------------------------------
create table if not exists fi_vie_capture_intelligence (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null references fi_tenants (id) on delete cascade,
  patient_id uuid not null references fi_patients (id) on delete cascade,
  patient_image_id uuid not null references fi_patient_images (id) on delete cascade,
  protocol_session_id uuid references fi_imaging_protocol_sessions (id) on delete set null,
  protocol_template_slug text not null,
  protocol_slot_slug text not null,
  classification jsonb not null default '{}'::jsonb,
  angle_verification jsonb not null default '{}'::jsonb,
  focus_verification jsonb not null default '{}'::jsonb,
  lighting_verification jsonb not null default '{}'::jsonb,
  quality_score numeric(5, 2) not null default 0,
  quality_band text not null default 'acceptable',
  protocol_completion jsonb not null default '{}'::jsonb,
  pipeline_version text not null default 'vie-intelligence-stub.v1',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint fi_vie_capture_intelligence_quality_band_chk check (
    quality_band in ('excellent', 'acceptable', 'retake_recommended')
  ),
  constraint fi_vie_capture_intelligence_classification_object check (jsonb_typeof (classification) = 'object'),
  constraint fi_vie_capture_intelligence_angle_object check (jsonb_typeof (angle_verification) = 'object'),
  constraint fi_vie_capture_intelligence_focus_object check (jsonb_typeof (focus_verification) = 'object'),
  constraint fi_vie_capture_intelligence_lighting_object check (jsonb_typeof (lighting_verification) = 'object'),
  constraint fi_vie_capture_intelligence_completion_object check (jsonb_typeof (protocol_completion) = 'object')
);

comment on table fi_vie_capture_intelligence is
  'VIE Phase 1: instant intelligence results per protocol capture. AI vision plugs in later via pipeline_version.';

create index if not exists idx_fi_vie_capture_intelligence_tenant_patient
  on fi_vie_capture_intelligence (tenant_id, patient_id, created_at desc);

create index if not exists idx_fi_vie_capture_intelligence_image
  on fi_vie_capture_intelligence (tenant_id, patient_image_id);

create unique index if not exists idx_fi_vie_capture_intelligence_image_unique
  on fi_vie_capture_intelligence (tenant_id, patient_image_id);

alter table fi_vie_capture_intelligence enable row level security;

drop policy if exists fi_vie_capture_intelligence_select_member on fi_vie_capture_intelligence;
create policy fi_vie_capture_intelligence_select_member on fi_vie_capture_intelligence for select to authenticated using (
  exists (
    select 1
    from fi_users u
    where
      u.auth_user_id = auth.uid()
      and u.tenant_id = fi_vie_capture_intelligence.tenant_id
  )
);

grant select on fi_vie_capture_intelligence to authenticated, service_role;
