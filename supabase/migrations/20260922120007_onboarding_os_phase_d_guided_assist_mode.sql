-- OnboardingOS Phase D: Guided Assist Mode — deterministic, role-aware operational guidance.
-- RLS: tenant members may read their preferences; service_role handles writes and admin analytics.

-- ---------------------------------------------------------------------------
-- fi_guided_assist_preferences — tenant defaults + per-user overrides
-- ---------------------------------------------------------------------------
create table if not exists public.fi_guided_assist_preferences (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null references public.fi_tenants (id) on delete cascade,
  fi_user_id uuid references public.fi_users (id) on delete cascade,
  assist_enabled boolean,
  default_enabled_during_onboarding boolean not null default true,
  default_assist_enabled boolean not null default false,
  dismissed_tip_codes jsonb not null default '[]'::jsonb,
  snoozed_tips jsonb not null default '{}'::jsonb,
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint fi_guided_assist_prefs_dismissed_array check (jsonb_typeof(dismissed_tip_codes) = 'array'),
  constraint fi_guided_assist_prefs_snoozed_object check (jsonb_typeof(snoozed_tips) = 'object'),
  constraint fi_guided_assist_prefs_metadata_object check (jsonb_typeof(metadata) = 'object')
);

comment on table public.fi_guided_assist_preferences is
  'OnboardingOS Phase D: Guided Assist toggles and dismiss/snooze state. fi_user_id null = tenant default row.';

comment on column public.fi_guided_assist_preferences.assist_enabled is
  'Per-user override. Null inherits tenant onboarding/post-onboarding defaults.';

comment on column public.fi_guided_assist_preferences.default_enabled_during_onboarding is
  'Tenant default: assist on while clinic setup is incomplete (tenant row only).';

comment on column public.fi_guided_assist_preferences.default_assist_enabled is
  'Tenant default after onboarding completes (tenant row only).';

create unique index if not exists idx_fi_guided_assist_prefs_tenant_default
  on public.fi_guided_assist_preferences (tenant_id)
  where fi_user_id is null;

create unique index if not exists idx_fi_guided_assist_prefs_tenant_user
  on public.fi_guided_assist_preferences (tenant_id, fi_user_id)
  where fi_user_id is not null;

create index if not exists idx_fi_guided_assist_prefs_tenant
  on public.fi_guided_assist_preferences (tenant_id);

alter table public.fi_guided_assist_preferences enable row level security;

drop policy if exists fi_guided_assist_prefs_select_tenant_member on public.fi_guided_assist_preferences;
create policy fi_guided_assist_prefs_select_tenant_member
  on public.fi_guided_assist_preferences for select to authenticated
  using (
    exists (
      select 1 from public.fi_users u
      where u.auth_user_id = auth.uid()
        and u.tenant_id = fi_guided_assist_preferences.tenant_id
        and (
          fi_guided_assist_preferences.fi_user_id is null
          or fi_guided_assist_preferences.fi_user_id = u.id
        )
    )
  );

grant select on public.fi_guided_assist_preferences to authenticated, service_role;
grant insert, update, delete on public.fi_guided_assist_preferences to service_role;

drop trigger if exists trg_fi_guided_assist_prefs_updated_at on public.fi_guided_assist_preferences;
create trigger trg_fi_guided_assist_prefs_updated_at
  before update on public.fi_guided_assist_preferences
  for each row execute procedure public.fi_onboarding_os_set_updated_at();

-- ---------------------------------------------------------------------------
-- fi_guided_assist_events — append-only assist usage telemetry (admin visibility)
-- ---------------------------------------------------------------------------
create table if not exists public.fi_guided_assist_events (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null references public.fi_tenants (id) on delete cascade,
  fi_user_id uuid references public.fi_users (id) on delete set null,
  event_kind text not null,
  guidance_area text,
  guidance_code text,
  page_key text,
  detail jsonb not null default '{}'::jsonb,
  occurred_at timestamptz not null default now(),
  created_at timestamptz not null default now(),
  constraint fi_guided_assist_events_kind_chk check (
    event_kind in (
      'assist_enabled',
      'assist_disabled',
      'tip_shown',
      'tip_dismissed',
      'tip_snoozed',
      'next_action_clicked',
      'widget_collapsed',
      'widget_expanded'
    )
  ),
  constraint fi_guided_assist_events_area_chk check (
    guidance_area is null
    or guidance_area in (
      'reception_os',
      'consultation_os',
      'surgery_os',
      'financial_os',
      'academy_os',
      'workforce_os',
      'analytics_os'
    )
  ),
  constraint fi_guided_assist_events_detail_object check (jsonb_typeof(detail) = 'object')
);

comment on table public.fi_guided_assist_events is
  'OnboardingOS Phase D: deterministic guided assist usage events for admin reporting. Append-only via service role.';

create index if not exists idx_fi_guided_assist_events_tenant_occurred
  on public.fi_guided_assist_events (tenant_id, occurred_at desc);

create index if not exists idx_fi_guided_assist_events_tenant_kind
  on public.fi_guided_assist_events (tenant_id, event_kind);

create index if not exists idx_fi_guided_assist_events_tenant_user
  on public.fi_guided_assist_events (tenant_id, fi_user_id, occurred_at desc)
  where fi_user_id is not null;

create index if not exists idx_fi_guided_assist_events_guidance_code
  on public.fi_guided_assist_events (tenant_id, guidance_code)
  where guidance_code is not null;

alter table public.fi_guided_assist_events enable row level security;

drop policy if exists fi_guided_assist_events_select_tenant_member on public.fi_guided_assist_events;
create policy fi_guided_assist_events_select_tenant_member
  on public.fi_guided_assist_events for select to authenticated
  using (
    exists (
      select 1 from public.fi_users u
      where u.auth_user_id = auth.uid()
        and u.tenant_id = fi_guided_assist_events.tenant_id
    )
  );

grant select on public.fi_guided_assist_events to authenticated, service_role;
grant insert on public.fi_guided_assist_events to service_role;
