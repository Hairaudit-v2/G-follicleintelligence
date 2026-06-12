-- Stage 9B (HIE): Hair Progression Intelligence — anonymised cohort buckets for cross-clinic benchmarks.
-- No patient identifiers; populated by scheduled jobs or service pipelines (not auto-written here).
-- Runbook: docs/runbooks/hie-stage9b-hair-progression-intelligence.md

create table if not exists public.hair_intelligence_progression_network_buckets (
  id uuid primary key default gen_random_uuid(),
  cohort_signature text not null,
  week_bucket date not null,
  pattern_type text not null,
  sex_bucket text not null,
  age_band text not null,
  classification_system text not null,
  sample_count int not null,
  mean_velocity numeric,
  p25_velocity numeric,
  p75_velocity numeric,
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  constraint hair_progression_network_buckets_sample_nonneg check (sample_count >= 0),
  constraint hair_progression_network_buckets_metadata_object check (jsonb_typeof (metadata) = 'object'),
  constraint hair_progression_network_buckets_cohort_len check (char_length (cohort_signature) <= 512),
  constraint hair_progression_network_buckets_unique_cohort_week unique (cohort_signature, week_bucket)
);

comment on table public.hair_intelligence_progression_network_buckets is
  'HIE Stage 9B: anonymised weekly cohort velocity stats for global Hair Intelligence Network benchmarks; no PHI.';

create index if not exists idx_hair_progression_network_buckets_week
  on public.hair_intelligence_progression_network_buckets (week_bucket desc);

create index if not exists idx_hair_progression_network_buckets_cohort
  on public.hair_intelligence_progression_network_buckets (cohort_signature, week_bucket desc);

alter table public.hair_intelligence_progression_network_buckets enable row level security;

-- No tenant column: default deny for authenticated; service_role bypasses RLS for ingestion.
grant select, insert, update, delete on public.hair_intelligence_progression_network_buckets to service_role;
