-- VIE Phase 5 — Longitudinal comparison engine (metadata-driven pairing)

create table if not exists fi_vie_comparison_pairs (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null references fi_tenants (id) on delete cascade,
  patient_id uuid not null references fi_patients (id) on delete cascade,
  case_id uuid references fi_cases (id) on delete set null,
  before_image_id uuid not null references fi_patient_images (id) on delete cascade,
  after_image_id uuid not null references fi_patient_images (id) on delete cascade,
  comparison_category text not null,
  anatomical_region text not null,
  slot_family text not null,
  before_timepoint text not null,
  after_timepoint text not null,
  days_between integer not null default 0,
  quality_match_score numeric(5, 2) not null default 0,
  angle_match_status text not null default 'pending_ai',
  framing_match_status text not null default 'unknown',
  confidence_band text not null default 'medium',
  recommended_use jsonb not null default '[]'::jsonb,
  warnings jsonb not null default '[]'::jsonb,
  metadata jsonb not null default '{}'::jsonb,
  review_status text not null default 'suggested',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint fi_vie_comparison_pairs_category_chk check (
    comparison_category in (
      'baseline_vs_follow_up',
      'pre_op_vs_post_op',
      'donor_before_vs_after_extraction',
      'recipient_before_vs_after_implantation',
      'graft_tray_documentation',
      'repair_review_progression',
      'treatment_progression'
    )
  ),
  constraint fi_vie_comparison_pairs_confidence_chk check (
    confidence_band in ('high', 'medium', 'low')
  ),
  constraint fi_vie_comparison_pairs_framing_chk check (
    framing_match_status in ('match', 'mismatch', 'unknown')
  ),
  constraint fi_vie_comparison_pairs_review_status_chk check (
    review_status in ('suggested', 'accepted', 'dismissed')
  ),
  constraint fi_vie_comparison_pairs_recommended_use_array check (
    jsonb_typeof (recommended_use) = 'array'
  ),
  constraint fi_vie_comparison_pairs_warnings_array check (jsonb_typeof (warnings) = 'array'),
  constraint fi_vie_comparison_pairs_metadata_object check (jsonb_typeof (metadata) = 'object'),
  constraint fi_vie_comparison_pairs_days_between_nonneg check (days_between >= 0)
);

comment on table fi_vie_comparison_pairs is
  'VIE Phase 5: suggested before/after comparison pairs from accepted protocol captures.';

create unique index if not exists idx_fi_vie_comparison_pairs_logical_key
  on fi_vie_comparison_pairs (
    tenant_id,
    before_image_id,
    after_image_id,
    comparison_category
  );

create index if not exists idx_fi_vie_comparison_pairs_tenant_patient
  on fi_vie_comparison_pairs (tenant_id, patient_id, created_at desc);

create index if not exists idx_fi_vie_comparison_pairs_tenant_case
  on fi_vie_comparison_pairs (tenant_id, case_id)
  where case_id is not null;

create index if not exists idx_fi_vie_comparison_pairs_category
  on fi_vie_comparison_pairs (tenant_id, comparison_category);

create index if not exists idx_fi_vie_comparison_pairs_review_status
  on fi_vie_comparison_pairs (tenant_id, review_status);

alter table fi_vie_comparison_pairs enable row level security;

drop policy if exists fi_vie_comparison_pairs_select_member on fi_vie_comparison_pairs;
create policy fi_vie_comparison_pairs_select_member on fi_vie_comparison_pairs for select to authenticated using (
  exists (
    select 1
    from fi_users u
    where
      u.auth_user_id = auth.uid()
      and u.tenant_id = fi_vie_comparison_pairs.tenant_id
  )
);

revoke all on fi_vie_comparison_pairs from public;
grant select on fi_vie_comparison_pairs to authenticated, service_role;
grant insert, update, delete on fi_vie_comparison_pairs to service_role;
