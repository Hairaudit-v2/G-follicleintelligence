-- FI OS Stage 2: optional per-staff feature visibility overrides (UI only; route guards unchanged).
-- Mutations are expected from trusted Next.js server routes using service_role (mirrors fi_staff writes).
-- Authenticated tenant members may read rows for coordination / future client reads.

create table if not exists public.fi_staff_feature_access (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null references public.fi_tenants (id) on delete cascade,
  staff_id uuid not null references public.fi_staff (id) on delete cascade,
  feature_key text not null,
  enabled boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  created_by_user_id uuid null,
  updated_by_user_id uuid null,
  constraint fi_staff_feature_access_tenant_staff_feature_unique unique (tenant_id, staff_id, feature_key)
);

comment on table public.fi_staff_feature_access is
  'FI OS: per-staff UI feature visibility overrides. Absence of a row means “use product default” (all visible in Stage 2).';

create index if not exists idx_fi_staff_feature_access_tenant_staff
  on public.fi_staff_feature_access (tenant_id, staff_id);

create index if not exists idx_fi_staff_feature_access_tenant_feature
  on public.fi_staff_feature_access (tenant_id, feature_key);

alter table public.fi_staff_feature_access enable row level security;

drop policy if exists fi_staff_feature_access_select_tenant_member on public.fi_staff_feature_access;
create policy fi_staff_feature_access_select_tenant_member
  on public.fi_staff_feature_access for select to authenticated
  using (
    exists (
      select 1 from public.fi_users u
      where u.auth_user_id = auth.uid()
        and u.tenant_id = fi_staff_feature_access.tenant_id
    )
  );

grant select on public.fi_staff_feature_access to authenticated, service_role;
grant insert, update, delete on public.fi_staff_feature_access to service_role;

create or replace function public.fi_staff_feature_access_set_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

drop trigger if exists trg_fi_staff_feature_access_set_updated_at on public.fi_staff_feature_access;
create trigger trg_fi_staff_feature_access_set_updated_at
  before update on public.fi_staff_feature_access
  for each row
  execute procedure public.fi_staff_feature_access_set_updated_at();
