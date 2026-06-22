-- OnboardingOS Phase E: Go-Live Readiness Command Centre.
-- RLS: tenant members may read their tenant readiness data; service_role handles writes and approvals.

-- ---------------------------------------------------------------------------
-- fi_tenant_go_live_readiness_snapshots — point-in-time readiness JSONB snapshots
-- ---------------------------------------------------------------------------
create table if not exists public.fi_tenant_go_live_readiness_snapshots (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid references public.fi_tenants (id) on delete cascade,
  session_id uuid not null references public.fi_tenant_provisioning_sessions (id) on delete cascade,
  status text not null,
  score_percent integer not null default 0,
  snapshot jsonb not null default '{}'::jsonb,
  generated_at timestamptz not null default now(),
  created_at timestamptz not null default now(),
  constraint fi_tenant_go_live_snapshots_status_chk check (
    status in ('blocked', 'warning', 'ready', 'approved')
  ),
  constraint fi_tenant_go_live_snapshots_score_chk check (
    score_percent >= 0 and score_percent <= 100
  ),
  constraint fi_tenant_go_live_snapshots_snapshot_object check (jsonb_typeof(snapshot) = 'object')
);

comment on table public.fi_tenant_go_live_readiness_snapshots is
  'OnboardingOS Phase E: persisted go-live readiness snapshots for command centre reporting.';

create index if not exists idx_fi_tenant_go_live_snapshots_tenant
  on public.fi_tenant_go_live_readiness_snapshots (tenant_id, created_at desc)
  where tenant_id is not null;

create index if not exists idx_fi_tenant_go_live_snapshots_session
  on public.fi_tenant_go_live_readiness_snapshots (session_id, created_at desc);

create index if not exists idx_fi_tenant_go_live_snapshots_status
  on public.fi_tenant_go_live_readiness_snapshots (status, created_at desc);

create index if not exists idx_fi_tenant_go_live_snapshots_created_at
  on public.fi_tenant_go_live_readiness_snapshots (created_at desc);

alter table public.fi_tenant_go_live_readiness_snapshots enable row level security;

drop policy if exists fi_tenant_go_live_snapshots_select_tenant_member on public.fi_tenant_go_live_readiness_snapshots;
create policy fi_tenant_go_live_snapshots_select_tenant_member
  on public.fi_tenant_go_live_readiness_snapshots for select to authenticated
  using (
    tenant_id is not null
    and exists (
      select 1 from public.fi_users u
      where u.auth_user_id = auth.uid()
        and u.tenant_id = fi_tenant_go_live_readiness_snapshots.tenant_id
    )
  );

grant select on public.fi_tenant_go_live_readiness_snapshots to authenticated, service_role;
grant insert, update, delete on public.fi_tenant_go_live_readiness_snapshots to service_role;

-- ---------------------------------------------------------------------------
-- fi_tenant_go_live_readiness_reviews — owner/platform review + checklist acknowledgements
-- ---------------------------------------------------------------------------
create table if not exists public.fi_tenant_go_live_readiness_reviews (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null references public.fi_tenants (id) on delete cascade,
  session_id uuid not null references public.fi_tenant_provisioning_sessions (id) on delete cascade,
  review_kind text not null,
  check_code text,
  status text not null default 'pending',
  reviewer_fi_user_id uuid references public.fi_users (id) on delete set null,
  reviewer_auth_user_id uuid,
  reviewer_label text,
  reviewer_role text,
  notes text,
  metadata jsonb not null default '{}'::jsonb,
  reviewed_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint fi_tenant_go_live_reviews_kind_chk check (
    review_kind in ('checklist_item', 'owner_review', 'platform_review')
  ),
  constraint fi_tenant_go_live_reviews_status_chk check (
    status in ('pending', 'complete')
  ),
  constraint fi_tenant_go_live_reviews_reviewer_role_chk check (
    reviewer_role is null
    or reviewer_role in ('tenant_admin', 'platform_admin')
  ),
  constraint fi_tenant_go_live_reviews_metadata_object check (jsonb_typeof(metadata) = 'object')
);

comment on table public.fi_tenant_go_live_readiness_reviews is
  'OnboardingOS Phase E: go-live checklist acknowledgements and owner/platform review completion.';

create unique index if not exists idx_fi_tenant_go_live_reviews_session_kind
  on public.fi_tenant_go_live_readiness_reviews (session_id, review_kind)
  where review_kind in ('owner_review', 'platform_review');

create unique index if not exists idx_fi_tenant_go_live_reviews_session_check
  on public.fi_tenant_go_live_readiness_reviews (session_id, check_code)
  where review_kind = 'checklist_item' and check_code is not null;

create index if not exists idx_fi_tenant_go_live_reviews_tenant
  on public.fi_tenant_go_live_readiness_reviews (tenant_id, created_at desc);

create index if not exists idx_fi_tenant_go_live_reviews_session
  on public.fi_tenant_go_live_readiness_reviews (session_id, created_at desc);

create index if not exists idx_fi_tenant_go_live_reviews_status
  on public.fi_tenant_go_live_readiness_reviews (status, created_at desc);

alter table public.fi_tenant_go_live_readiness_reviews enable row level security;

drop policy if exists fi_tenant_go_live_reviews_select_tenant_member on public.fi_tenant_go_live_readiness_reviews;
create policy fi_tenant_go_live_reviews_select_tenant_member
  on public.fi_tenant_go_live_readiness_reviews for select to authenticated
  using (
    exists (
      select 1 from public.fi_users u
      where u.auth_user_id = auth.uid()
        and u.tenant_id = fi_tenant_go_live_readiness_reviews.tenant_id
    )
  );

grant select on public.fi_tenant_go_live_readiness_reviews to authenticated, service_role;
grant insert, update, delete on public.fi_tenant_go_live_readiness_reviews to service_role;

drop trigger if exists trg_fi_tenant_go_live_reviews_updated_at on public.fi_tenant_go_live_readiness_reviews;
create trigger trg_fi_tenant_go_live_reviews_updated_at
  before update on public.fi_tenant_go_live_readiness_reviews
  for each row execute procedure public.fi_onboarding_os_set_updated_at();

-- ---------------------------------------------------------------------------
-- fi_tenant_go_live_approval_events — append-only go-live approval audit trail
-- ---------------------------------------------------------------------------
create table if not exists public.fi_tenant_go_live_approval_events (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null references public.fi_tenants (id) on delete cascade,
  session_id uuid not null references public.fi_tenant_provisioning_sessions (id) on delete cascade,
  event_kind text not null,
  check_code text,
  actor_auth_user_id uuid,
  actor_fi_user_id uuid references public.fi_users (id) on delete set null,
  actor_label text,
  actor_role text,
  detail jsonb not null default '{}'::jsonb,
  occurred_at timestamptz not null default now(),
  created_at timestamptz not null default now(),
  constraint fi_tenant_go_live_approval_events_kind_chk check (
    event_kind in ('owner_review', 'platform_review', 'checklist_item', 'go_live_approved')
  ),
  constraint fi_tenant_go_live_approval_events_actor_role_chk check (
    actor_role is null
    or actor_role in ('tenant_admin', 'platform_admin')
  ),
  constraint fi_tenant_go_live_approval_events_detail_object check (jsonb_typeof(detail) = 'object')
);

comment on table public.fi_tenant_go_live_approval_events is
  'OnboardingOS Phase E: append-only go-live review and approval events. Insert via service_role only.';

create index if not exists idx_fi_tenant_go_live_approval_events_tenant
  on public.fi_tenant_go_live_approval_events (tenant_id, occurred_at desc);

create index if not exists idx_fi_tenant_go_live_approval_events_session
  on public.fi_tenant_go_live_approval_events (session_id, occurred_at desc);

create index if not exists idx_fi_tenant_go_live_approval_events_kind
  on public.fi_tenant_go_live_approval_events (event_kind, occurred_at desc);

create index if not exists idx_fi_tenant_go_live_approval_events_created_at
  on public.fi_tenant_go_live_approval_events (created_at desc);

alter table public.fi_tenant_go_live_approval_events enable row level security;

drop policy if exists fi_tenant_go_live_approval_events_select_tenant_member on public.fi_tenant_go_live_approval_events;
create policy fi_tenant_go_live_approval_events_select_tenant_member
  on public.fi_tenant_go_live_approval_events for select to authenticated
  using (
    exists (
      select 1 from public.fi_users u
      where u.auth_user_id = auth.uid()
        and u.tenant_id = fi_tenant_go_live_approval_events.tenant_id
    )
  );

grant select on public.fi_tenant_go_live_approval_events to authenticated, service_role;
grant insert on public.fi_tenant_go_live_approval_events to service_role;
