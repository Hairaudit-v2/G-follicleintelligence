-- AI Patient Summary: short-TTL cache + audit log (operational only, tenant-scoped).
-- Additive only. Does not alter clinical chart tables.

create table if not exists public.fi_patient_ai_summary_cache (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null references public.fi_tenants (id) on delete cascade,
  patient_id uuid not null,
  summary_json jsonb not null default '{}'::jsonb,
  source text not null default 'deterministic',
  model text,
  facts_fingerprint text,
  expires_at timestamptz not null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint fi_patient_ai_summary_cache_json_obj check (jsonb_typeof(summary_json) = 'object'),
  constraint fi_patient_ai_summary_cache_source_chk check (
    source in ('llm', 'deterministic', 'cache')
  )
);

create unique index if not exists idx_fi_patient_ai_summary_cache_tenant_patient
  on public.fi_patient_ai_summary_cache (tenant_id, patient_id);

create index if not exists idx_fi_patient_ai_summary_cache_expires
  on public.fi_patient_ai_summary_cache (expires_at);

comment on table public.fi_patient_ai_summary_cache is
  'Short-TTL cache for operational AI Patient Summary. Never stores clinical advice.';

create table if not exists public.fi_patient_ai_summary_logs (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null references public.fi_tenants (id) on delete cascade,
  patient_id uuid not null,
  actor_auth_user_id uuid,
  source text not null,
  model text,
  cache_hit boolean not null default false,
  requires_human_review boolean not null default false,
  success boolean not null default true,
  error_message text,
  detail jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  constraint fi_patient_ai_summary_logs_detail_obj check (jsonb_typeof(detail) = 'object')
);

create index if not exists idx_fi_patient_ai_summary_logs_tenant_created
  on public.fi_patient_ai_summary_logs (tenant_id, created_at desc);

create index if not exists idx_fi_patient_ai_summary_logs_patient
  on public.fi_patient_ai_summary_logs (tenant_id, patient_id, created_at desc);

comment on table public.fi_patient_ai_summary_logs is
  'Audit log for AI Patient Summary calls (user + patient + outcome). AU operational audit trail.';

alter table public.fi_patient_ai_summary_cache enable row level security;
alter table public.fi_patient_ai_summary_logs enable row level security;

-- Members may read cache/logs for their tenant; writes via service role only.
drop policy if exists fi_patient_ai_summary_cache_select_member on public.fi_patient_ai_summary_cache;
create policy fi_patient_ai_summary_cache_select_member
  on public.fi_patient_ai_summary_cache for select to authenticated
  using (
    exists (
      select 1 from public.fi_users u
      where u.auth_user_id = auth.uid()
        and u.tenant_id = fi_patient_ai_summary_cache.tenant_id
    )
  );

drop policy if exists fi_patient_ai_summary_logs_select_member on public.fi_patient_ai_summary_logs;
create policy fi_patient_ai_summary_logs_select_member
  on public.fi_patient_ai_summary_logs for select to authenticated
  using (
    exists (
      select 1 from public.fi_users u
      where u.auth_user_id = auth.uid()
        and u.tenant_id = fi_patient_ai_summary_logs.tenant_id
    )
  );

grant select on public.fi_patient_ai_summary_cache to authenticated, service_role;
grant insert, update, delete on public.fi_patient_ai_summary_cache to service_role;
grant select on public.fi_patient_ai_summary_logs to authenticated, service_role;
grant insert, update, delete on public.fi_patient_ai_summary_logs to service_role;

comment on column public.fi_tenant_settings.metadata is
  'JSON bag including ai_patient_summary_enabled (boolean, default true when unset).';
