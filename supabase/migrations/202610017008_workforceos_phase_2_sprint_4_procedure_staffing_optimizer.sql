-- WorkforceOS Phase 2 Sprint 4: procedure staffing optimizer — recommendation audit log.

create table if not exists public.fi_workforce_procedure_staffing_recommendations (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null references public.fi_tenants (id) on delete cascade,
  surgery_id uuid not null references public.fi_surgeries (id) on delete cascade,
  work_date date not null,
  recommended_team_json jsonb not null default '[]'::jsonb,
  blocked_staff_json jsonb not null default '[]'::jsonb,
  total_team_cost_cents bigint not null default 0,
  staffing_complete boolean not null default false,
  generated_at timestamptz not null default now(),
  metadata jsonb not null default '{}'::jsonb,
  constraint fi_workforce_procedure_staffing_rec_team_array check (
    jsonb_typeof(recommended_team_json) = 'array'
  ),
  constraint fi_workforce_procedure_staffing_rec_blocked_array check (
    jsonb_typeof(blocked_staff_json) = 'array'
  ),
  constraint fi_workforce_procedure_staffing_rec_metadata_object check (
    jsonb_typeof(metadata) = 'object'
  )
);

comment on table public.fi_workforce_procedure_staffing_recommendations is
  'WorkforceOS Phase 2 Sprint 4: cached procedure team recommendations (skill, cost, eligibility).';

create index if not exists idx_fi_workforce_procedure_staffing_rec_tenant_date
  on public.fi_workforce_procedure_staffing_recommendations (tenant_id, work_date desc);

create unique index if not exists idx_fi_workforce_procedure_staffing_rec_tenant_surgery
  on public.fi_workforce_procedure_staffing_recommendations (tenant_id, surgery_id);

alter table public.fi_workforce_procedure_staffing_recommendations enable row level security;

do $$
begin
  if to_regclass('public.fi_users') is not null then
    drop policy if exists fi_workforce_procedure_staffing_rec_select_hr on public.fi_workforce_procedure_staffing_recommendations;
    create policy fi_workforce_procedure_staffing_rec_select_hr
      on public.fi_workforce_procedure_staffing_recommendations for select to authenticated
      using (
        exists (
          select 1 from public.fi_users u
          where u.auth_user_id = auth.uid()
            and u.tenant_id = fi_workforce_procedure_staffing_recommendations.tenant_id
            and lower(coalesce(u.role, '')) in ('fi_admin', 'admin', 'owner', 'hr_manager')
        )
      );
    grant select on public.fi_workforce_procedure_staffing_recommendations to authenticated;
  end if;
end $$;

grant select, insert, update, delete on public.fi_workforce_procedure_staffing_recommendations to service_role;