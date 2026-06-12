-- Stage 8B: Smart Clinical Photography Protocol (HLI) — shared templates/sessions for FI OS, HairAudit, Hair Longevity.
-- Runbook: docs/runbooks/fi-os-stage8b-smart-clinical-photography-protocol.md

-- ---------------------------------------------------------------------------
-- Templates & slots (Helix / FI OS canonical; distinct from ImagingOS JSON templates)
-- ---------------------------------------------------------------------------
create table if not exists public.hli_photo_protocol_templates (
  id uuid primary key default gen_random_uuid(),
  slug text not null,
  name text not null,
  description text,
  source_system_scope text not null default 'shared',
  clinical_context text not null,
  is_active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint hli_photo_protocol_templates_slug_len check (char_length (slug) >= 1 and char_length (slug) <= 128),
  constraint hli_photo_protocol_templates_source_scope_chk check (
    source_system_scope in ('shared', 'fi_os', 'hairaudit', 'hair_longevity')
  ),
  constraint hli_photo_protocol_templates_clinical_context_chk check (
    clinical_context in (
      'consultation',
      'surgery_pre_op',
      'surgery_immediate_post_op',
      'follow_up',
      'hairaudit_case',
      'hli_intake',
      'hli_progress',
      'trichoscopy',
      'microscopic'
    )
  ),
  constraint hli_photo_protocol_templates_name_len check (char_length (name) <= 200),
  constraint hli_photo_protocol_templates_unique_slug unique (slug)
);

comment on table public.hli_photo_protocol_templates is
  'HLI Stage 8B: normalised smart photography protocol templates (multi-product).';

create table if not exists public.hli_photo_protocol_slots (
  id uuid primary key default gen_random_uuid(),
  protocol_template_id uuid not null references public.hli_photo_protocol_templates (id) on delete cascade,
  slot_slug text not null,
  label text not null,
  required_image_category text,
  acceptable_image_categories text[],
  required_surgery_stage text,
  required_hair_state text,
  required_shave_state text,
  sort_order int not null default 0,
  is_required boolean not null default true,
  capture_guidance text,
  quality_guidance text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint hli_photo_protocol_slots_slot_slug_len check (char_length (slot_slug) >= 1 and char_length (slot_slug) <= 128),
  constraint hli_photo_protocol_slots_category_chk check (
    required_image_category is null
    or required_image_category in (
      'front',
      'left_profile',
      'right_profile',
      'top',
      'crown',
      'donor',
      'graft_tray',
      'immediate_post_op',
      'follow_up',
      'microscopic',
      'unknown'
    )
  ),
  constraint hli_photo_protocol_slots_req_surgery_chk check (
    required_surgery_stage is null
    or required_surgery_stage in ('pre_op', 'intra_op', 'immediate_post_op', 'follow_up', 'unknown')
  ),
  constraint hli_photo_protocol_slots_req_hair_chk check (
    required_hair_state is null or required_hair_state in ('wet', 'dry', 'unknown')
  ),
  constraint hli_photo_protocol_slots_req_shave_chk check (
    required_shave_state is null
    or required_shave_state in ('shaved', 'non_shaved', 'partially_shaved', 'unknown')
  ),
  constraint hli_photo_protocol_slots_guidance_len check (
    (capture_guidance is null or char_length (capture_guidance) <= 4000)
    and (quality_guidance is null or char_length (quality_guidance) <= 4000)
  ),
  constraint hli_photo_protocol_slots_unique_per_template unique (protocol_template_id, slot_slug)
);

create index if not exists idx_hli_photo_protocol_slots_template
  on public.hli_photo_protocol_slots (protocol_template_id, sort_order);

-- ---------------------------------------------------------------------------
-- Sessions & per-slot progress
-- ---------------------------------------------------------------------------
create table if not exists public.hli_photo_protocol_sessions (
  id uuid primary key default gen_random_uuid(),
  source_system text not null,
  source_record_id text not null,
  tenant_id uuid references fi_tenants (id) on delete cascade,
  patient_id uuid references fi_patients (id) on delete set null,
  case_id uuid references fi_cases (id) on delete set null,
  protocol_template_id uuid not null references public.hli_photo_protocol_templates (id) on delete restrict,
  status text not null default 'draft',
  started_at timestamptz,
  completed_at timestamptz,
  created_by_user_id uuid references fi_users (id) on delete set null,
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint hli_photo_protocol_sessions_source_system_chk check (
    source_system in ('fi_os', 'hairaudit', 'hair_longevity')
  ),
  constraint hli_photo_protocol_sessions_status_chk check (
    status in ('draft', 'in_progress', 'complete', 'incomplete', 'cancelled')
  ),
  constraint hli_photo_protocol_sessions_metadata_object check (jsonb_typeof (metadata) = 'object')
);

comment on table public.hli_photo_protocol_sessions is
  'HLI Stage 8B: active protocol run linked to tenant/patient/case where applicable.';

create table if not exists public.hli_photo_protocol_session_slots (
  id uuid primary key default gen_random_uuid(),
  session_id uuid not null references public.hli_photo_protocol_sessions (id) on delete cascade,
  slot_id uuid not null references public.hli_photo_protocol_slots (id) on delete restrict,
  patient_image_id uuid references fi_patient_images (id) on delete set null,
  status text not null default 'missing',
  ai_match_confidence double precision,
  staff_note text,
  reviewed_by_user_id uuid references fi_users (id) on delete set null,
  reviewed_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint hli_photo_protocol_session_slots_status_chk check (
    status in ('missing', 'captured', 'accepted', 'needs_retake', 'optional_skipped')
  ),
  constraint hli_photo_protocol_session_slots_ai_conf_range check (
    ai_match_confidence is null
    or (
      ai_match_confidence >= 0::double precision
      and ai_match_confidence <= 1::double precision
    )
  ),
  constraint hli_photo_protocol_session_slots_staff_note_len check (
    staff_note is null or char_length (staff_note) <= 2000
  ),
  constraint hli_photo_protocol_session_slots_unique_slot unique (session_id, slot_id)
);

create index if not exists idx_hli_photo_protocol_sessions_tenant_patient
  on public.hli_photo_protocol_sessions (tenant_id, patient_id, status, created_at desc);

create index if not exists idx_hli_photo_protocol_sessions_source
  on public.hli_photo_protocol_sessions (source_system, source_record_id);

create index if not exists idx_hli_photo_protocol_sessions_template
  on public.hli_photo_protocol_sessions (protocol_template_id);

create index if not exists idx_hli_photo_protocol_session_slots_session
  on public.hli_photo_protocol_session_slots (session_id, status);

create index if not exists idx_hli_photo_protocol_sessions_status
  on public.hli_photo_protocol_sessions (tenant_id, status)
  where tenant_id is not null;

-- ---------------------------------------------------------------------------
-- RLS (tenant member SELECT; service role bypasses RLS)
-- ---------------------------------------------------------------------------
alter table public.hli_photo_protocol_templates enable row level security;
alter table public.hli_photo_protocol_slots enable row level security;
alter table public.hli_photo_protocol_sessions enable row level security;
alter table public.hli_photo_protocol_session_slots enable row level security;

drop policy if exists hli_photo_protocol_templates_select_member on public.hli_photo_protocol_templates;
create policy hli_photo_protocol_templates_select_member on public.hli_photo_protocol_templates for select to authenticated using (true);

drop policy if exists hli_photo_protocol_slots_select_member on public.hli_photo_protocol_slots;
create policy hli_photo_protocol_slots_select_member on public.hli_photo_protocol_slots for select to authenticated using (true);

drop policy if exists hli_photo_protocol_sessions_select_member on public.hli_photo_protocol_sessions;
create policy hli_photo_protocol_sessions_select_member on public.hli_photo_protocol_sessions for select to authenticated using (
  tenant_id is not null
  and exists (
    select 1
    from fi_users u
    where
      u.auth_user_id = auth.uid()
      and u.tenant_id = hli_photo_protocol_sessions.tenant_id
  )
);

drop policy if exists hli_photo_protocol_session_slots_select_member on public.hli_photo_protocol_session_slots;
create policy hli_photo_protocol_session_slots_select_member on public.hli_photo_protocol_session_slots for select to authenticated using (
  exists (
    select 1
    from public.hli_photo_protocol_sessions s
    join fi_users u on u.tenant_id = s.tenant_id
    where
      s.id = hli_photo_protocol_session_slots.session_id
      and u.auth_user_id = auth.uid()
  )
);

grant select on public.hli_photo_protocol_templates to authenticated, service_role;
grant select on public.hli_photo_protocol_slots to authenticated, service_role;
grant select on public.hli_photo_protocol_sessions to authenticated, service_role;
grant select on public.hli_photo_protocol_session_slots to authenticated, service_role;

grant insert, update, delete on public.hli_photo_protocol_templates to service_role;
grant insert, update, delete on public.hli_photo_protocol_slots to service_role;
grant insert, update, delete on public.hli_photo_protocol_sessions to service_role;
grant insert, update, delete on public.hli_photo_protocol_session_slots to service_role;

-- ---------------------------------------------------------------------------
-- Seed templates (idempotent by slug)
-- ---------------------------------------------------------------------------
insert into
  public.hli_photo_protocol_templates (slug, name, description, source_system_scope, clinical_context, is_active)
values
  (
    'consultation_standard',
    'Consultation — standard clinical photo set',
    'Baseline angles for hair restoration consultation.',
    'shared',
    'consultation',
    true
  ),
  (
    'surgery_pre_op_standard',
    'Surgery — pre-op standard set',
    'Pre-operative documentation including recipient views.',
    'shared',
    'surgery_pre_op',
    true
  ),
  (
    'immediate_post_op_standard',
    'Surgery — immediate post-op',
    'Immediate post-operative capture set.',
    'shared',
    'surgery_immediate_post_op',
    true
  ),
  (
    'follow_up_standard',
    'Follow-up — standard set',
    'Longitudinal follow-up photography.',
    'shared',
    'follow_up',
    true
  ),
  (
    'hli_intake_standard',
    'HLI — intake photography',
    'Hair Longevity intake baseline.',
    'shared',
    'hli_intake',
    true
  ),
  (
    'hairaudit_case_standard',
    'HairAudit — case documentation',
    'Pre/post and follow-up angles for audit cases.',
    'shared',
    'hairaudit_case',
    true
  )
on conflict (slug) do update
set
  name = excluded.name,
  description = excluded.description,
  clinical_context = excluded.clinical_context,
  is_active = excluded.is_active,
  updated_at = now();

-- Slots: idempotent upserts per (template, slot_slug)
insert into
  public.hli_photo_protocol_slots (
    protocol_template_id,
    slot_slug,
    label,
    required_image_category,
    acceptable_image_categories,
    required_surgery_stage,
    required_hair_state,
    required_shave_state,
    sort_order,
    is_required,
    capture_guidance,
    quality_guidance
  )
select
  t.id,
  v.slot_slug,
  v.label,
  v.required_image_category,
  v.acceptable_image_categories,
  v.required_surgery_stage,
  v.required_hair_state,
  v.required_shave_state,
  v.sort_order,
  v.is_required,
  v.capture_guidance,
  v.quality_guidance
from
  public.hli_photo_protocol_templates t
  join (
    values
      ('consultation_standard', 'front', 'Front (full face to hairline)', 'front', null::text[], null::text, null::text, null::text, 10, true, 'Neutral background; include hairline.', 'Even lighting; patient facing camera.'),
      ('consultation_standard', 'left_profile', 'Left profile', 'left_profile', null, null, null, null, 20, true, 'Turn 90° left from camera.', 'Hairline and temple visible.'),
      ('consultation_standard', 'right_profile', 'Right profile', 'right_profile', null, null, null, null, 30, true, 'Turn 90° right from camera.', 'Symmetry with left profile.'),
      ('consultation_standard', 'top', 'Top / bird''s eye', 'top', null, null, null, null, 40, true, 'Camera above vertex.', 'Centre of scalp in frame.'),
      ('consultation_standard', 'crown', 'Crown', 'crown', null, null, null, null, 50, true, 'Focus on posterior vertex.', 'Avoid harsh shadowing.'),
      ('consultation_standard', 'donor', 'Donor area', 'donor', null, null, null, null, 60, true, 'Lower occipital donor visible.', 'Hair parted if needed.'),
      ('surgery_pre_op_standard', 'front', 'Front', 'front', null, null, null, null, 10, true, 'Pre-op baseline frontal.', null),
      ('surgery_pre_op_standard', 'left_profile', 'Left profile', 'left_profile', null, null, null, null, 20, true, null, null),
      ('surgery_pre_op_standard', 'right_profile', 'Right profile', 'right_profile', null, null, null, null, 30, true, null, null),
      ('surgery_pre_op_standard', 'top', 'Top', 'top', null, null, null, null, 40, true, null, null),
      ('surgery_pre_op_standard', 'crown', 'Crown', 'crown', null, null, null, null, 50, true, null, null),
      ('surgery_pre_op_standard', 'donor', 'Donor', 'donor', null, null, null, null, 60, true, null, null),
      (
        'surgery_pre_op_standard',
        'recipient_area',
        'Recipient area (front, top, or crown)',
        'top',
        array['front', 'top', 'crown']::text[],
        null,
        null,
        null,
        55,
        true,
        'Capture recipient zone — any of front, top, or crown framing is acceptable.',
        'Ensure graft zone or planned recipient is visible.'
      ),
      ('immediate_post_op_standard', 'front', 'Front', 'front', null, null, null, null, 10, true, 'Immediate post-op frontal.', null),
      ('immediate_post_op_standard', 'hairline_front', 'Hairline / frontal', 'front', null, null, null, null, 15, true, 'Close hairline view if bandage allows.', null),
      ('immediate_post_op_standard', 'top', 'Top', 'top', null, null, null, null, 20, true, null, null),
      ('immediate_post_op_standard', 'crown', 'Crown', 'crown', null, null, null, null, 30, true, null, null),
      ('immediate_post_op_standard', 'donor', 'Donor', 'donor', null, null, null, null, 40, true, null, null),
      ('immediate_post_op_standard', 'graft_tray', 'Graft tray (optional)', 'graft_tray', null, null, null, null, 50, false, 'Optional intra-op documentation.', null),
      ('follow_up_standard', 'front', 'Front', 'front', null, null, null, null, 10, true, null, null),
      ('follow_up_standard', 'left_profile', 'Left profile', 'left_profile', null, null, null, null, 20, true, null, null),
      ('follow_up_standard', 'right_profile', 'Right profile', 'right_profile', null, null, null, null, 30, true, null, null),
      ('follow_up_standard', 'top', 'Top', 'top', null, null, null, null, 40, true, null, null),
      ('follow_up_standard', 'crown', 'Crown', 'crown', null, null, null, null, 50, true, null, null),
      ('follow_up_standard', 'donor', 'Donor (optional)', 'donor', null, null, null, null, 60, false, null, null),
      ('hli_intake_standard', 'front', 'Front', 'front', null, null, null, null, 10, true, null, null),
      ('hli_intake_standard', 'left_profile', 'Left profile', 'left_profile', null, null, null, null, 20, true, null, null),
      ('hli_intake_standard', 'right_profile', 'Right profile', 'right_profile', null, null, null, null, 30, true, null, null),
      ('hli_intake_standard', 'top', 'Top', 'top', null, null, null, null, 40, true, null, null),
      ('hli_intake_standard', 'crown', 'Crown', 'crown', null, null, null, null, 50, true, null, null),
      ('hli_intake_standard', 'donor', 'Donor (optional)', 'donor', null, null, null, null, 60, false, null, null),
      ('hli_intake_standard', 'microscopic', 'Microscopic (optional)', 'microscopic', null, null, null, null, 70, false, null, null),
      ('hairaudit_case_standard', 'pre_op_front', 'Pre-op — front', 'front', null, 'pre_op', null, null, 10, true, null, null),
      ('hairaudit_case_standard', 'pre_op_vertex', 'Pre-op — crown or top', 'crown', array['crown', 'top']::text[], 'pre_op', null, null, 20, true, null, null),
      ('hairaudit_case_standard', 'immediate_post_op_front', 'Immediate post-op — front', 'front', null, 'immediate_post_op', null, null, 30, true, null, null),
      ('hairaudit_case_standard', 'immediate_post_op_donor', 'Immediate post-op — donor', 'donor', null, 'immediate_post_op', null, null, 40, true, null, null),
      ('hairaudit_case_standard', 'follow_up_front', 'Follow-up — front', 'front', null, 'follow_up', null, null, 50, true, null, null),
      ('hairaudit_case_standard', 'follow_up_vertex', 'Follow-up — crown or top', 'crown', array['crown', 'top']::text[], 'follow_up', null, null, 60, true, null, null),
      ('hairaudit_case_standard', 'graft_tray_opt', 'Graft tray (optional)', 'graft_tray', null, null, null, null, 70, false, null, null),
      ('hairaudit_case_standard', 'microscopic_opt', 'Microscopic (optional)', 'microscopic', null, null, null, null, 80, false, null, null)
  ) as v(
    tmpl_slug,
    slot_slug,
    label,
    required_image_category,
    acceptable_image_categories,
    required_surgery_stage,
    required_hair_state,
    required_shave_state,
    sort_order,
    is_required,
    capture_guidance,
    quality_guidance
  )
    on t.slug = v.tmpl_slug
on conflict (protocol_template_id, slot_slug) do update
set
  label = excluded.label,
  required_image_category = excluded.required_image_category,
  acceptable_image_categories = excluded.acceptable_image_categories,
  required_surgery_stage = excluded.required_surgery_stage,
  required_hair_state = excluded.required_hair_state,
  required_shave_state = excluded.required_shave_state,
  sort_order = excluded.sort_order,
  is_required = excluded.is_required,
  capture_guidance = excluded.capture_guidance,
  quality_guidance = excluded.quality_guidance,
  updated_at = now();
