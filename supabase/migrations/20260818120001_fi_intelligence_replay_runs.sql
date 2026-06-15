-- Stage 15: durable governed intelligence replay run records (approval workflow; no production dispatch).

create table if not exists public.fi_intelligence_replay_runs (
  id uuid primary key default gen_random_uuid(),
  requested_by uuid null references auth.users (id),
  approved_by uuid null references auth.users (id),
  approval_status text not null default 'draft'
    constraint fi_intelligence_replay_runs_approval_status_chk
      check (
        approval_status in (
          'draft',
          'pending_approval',
          'approved',
          'rejected',
          'cancelled',
          'completed',
          'failed'
        )
      ),
  replay_mode text not null
    constraint fi_intelligence_replay_runs_replay_mode_chk
      check (replay_mode in ('dry_run', 'validate_only', 'enqueue_shadow', 'dispatch_future')),
  event_name text null,
  source text null,
  status_filter text null,
  privacy_level text null,
  since timestamptz null,
  until timestamptz null,
  correlation_id text null,
  limit_count integer not null default 25,
  candidate_count integer not null default 0,
  processed_count integer not null default 0,
  failed_count integer not null default 0,
  warning_count integer not null default 0,
  summary jsonb not null default '{}'::jsonb,
  warnings text[] not null default '{}'::text[],
  created_at timestamptz not null default now(),
  approved_at timestamptz null,
  completed_at timestamptz null
);

comment on table public.fi_intelligence_replay_runs is
  'Stage 15 governed intelligence replay plans and outcomes. Inserts/updates via Supabase service role from trusted server code after FI platform admin gate. No client-side direct access under RLS.';

create index if not exists idx_fi_intelligence_replay_runs_approval_created
  on public.fi_intelligence_replay_runs (approval_status, created_at desc);

create index if not exists idx_fi_intelligence_replay_runs_mode_created
  on public.fi_intelligence_replay_runs (replay_mode, created_at desc);

create index if not exists idx_fi_intelligence_replay_runs_event_created
  on public.fi_intelligence_replay_runs (event_name, created_at desc);

create index if not exists idx_fi_intelligence_replay_runs_requested_by_created
  on public.fi_intelligence_replay_runs (requested_by, created_at desc);

create index if not exists idx_fi_intelligence_replay_runs_approved_by_created
  on public.fi_intelligence_replay_runs (approved_by, created_at desc);

alter table public.fi_intelligence_replay_runs enable row level security;

-- Authenticated and anonymous roles have no policies: default deny under RLS.
-- service_role bypasses RLS in Supabase.

revoke all on public.fi_intelligence_replay_runs from public;
grant select, insert, update, delete on public.fi_intelligence_replay_runs to service_role;
