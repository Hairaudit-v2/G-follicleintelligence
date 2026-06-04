-- Stage 5D: Post-op / outcome tracking (no HairAudit, audit grading, AI scoring, or certification).

create table if not exists fi_case_post_op_tracking (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null references fi_tenants (id) on delete cascade,
  case_id uuid not null references fi_cases (id) on delete cascade,
  post_op_status text not null default 'not_started',
  instructions_given boolean not null default false,
  aftercare_notes text,
  donor_recovery_notes text,
  recipient_recovery_notes text,
  complication_notes text,
  patient_satisfaction_score integer,
  outcome_notes text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint fi_case_post_op_tracking_tenant_case_unique unique (tenant_id, case_id),
  constraint fi_case_post_op_tracking_status_chk check (
    post_op_status in (
      'not_started',
      'immediate_post_op',
      'early_recovery',
      'healing',
      'routine_follow_up',
      'stable',
      'needs_attention',
      'closed'
    )
  ),
  constraint fi_case_post_op_tracking_satisfaction_chk check (
    patient_satisfaction_score is null
    or (
      patient_satisfaction_score >= 1
      and patient_satisfaction_score <= 10
    )
  )
);

comment on table fi_case_post_op_tracking is
  'Stage 5D: one post-op / recovery summary row per case (notes and satisfaction only; no audit or AI scores).';

create index if not exists idx_fi_case_post_op_tracking_tenant on fi_case_post_op_tracking (tenant_id);

create index if not exists idx_fi_case_post_op_tracking_case on fi_case_post_op_tracking (case_id);

create table if not exists fi_case_follow_ups (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null references fi_tenants (id) on delete cascade,
  case_id uuid not null references fi_cases (id) on delete cascade,
  checkpoint text not null,
  scheduled_date date,
  completed_date date,
  follow_up_status text not null default 'pending',
  notes text,
  linked_image_ids jsonb not null default '[]'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint fi_case_follow_ups_tenant_case_checkpoint_unique unique (tenant_id, case_id, checkpoint),
  constraint fi_case_follow_ups_checkpoint_chk check (
    checkpoint in (
      'day_1',
      'day_7',
      'day_14',
      'month_1',
      'month_3',
      'month_6',
      'month_12'
    )
  ),
  constraint fi_case_follow_ups_status_chk check (
    follow_up_status in ('pending', 'scheduled', 'completed', 'skipped', 'cancelled')
  ),
  constraint fi_case_follow_ups_linked_ids_array check (jsonb_typeof (linked_image_ids) = 'array')
);

comment on table fi_case_follow_ups is
  'Stage 5D: scheduled / completed follow-up checkpoints per case; optional links to fi_patient_images ids (JSON array).';

create index if not exists idx_fi_case_follow_ups_tenant on fi_case_follow_ups (tenant_id);

create index if not exists idx_fi_case_follow_ups_case on fi_case_follow_ups (case_id);

create index if not exists idx_fi_case_follow_ups_scheduled on fi_case_follow_ups (tenant_id, scheduled_date);
