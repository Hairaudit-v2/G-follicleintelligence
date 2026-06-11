-- MedicationOS v1 — schema foundation (therapy plans, items, events; canonical vocabulary).
--
-- MedicationOS complements DoctorOS prescribing: it tracks therapy plans, clinical journey,
-- events, monitoring, and outcome context. DoctorOS (`fi_medication_catalogue`,
-- `fi_patient_prescriptions`, `fi_prescription_items`, `fi_prescription_status_events`,
-- `fi_medication_reorder_requests`) remains the legal prescription / pharmacy system of record.
-- This migration does not alter those prescribing tables.
--
-- Optional FKs: `catalogue_id` and prescription/pathology columns are created as plain uuid.
-- After tables exist, we attach FK constraints only when the referenced tables exist (so this
-- file can apply on databases that have not yet run `20260627120002_fi_prescribing.sql` or
-- pathology migrations). Full `supabase db reset` / ordered migrations still get full FKs.
--
-- RLS: aligned with `20260627120002_fi_prescribing.sql` — authenticated tenant members may
-- SELECT rows where `fi_users.auth_user_id = auth.uid()` and `fi_users.tenant_id` matches;
-- INSERT/UPDATE/DELETE are granted to `service_role` only (Next.js server actions / admin).

-- ---------------------------------------------------------------------------
-- fi_medication_os_canonical
-- ---------------------------------------------------------------------------
create table if not exists fi_medication_os_canonical (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null references fi_tenants (id) on delete cascade,
  canonical_code text not null,
  display_name text not null,
  therapy_track text not null,
  default_route text,
  catalogue_id uuid,
  active boolean not null default true,
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint fi_medication_os_canonical_therapy_track_chk check (
    therapy_track in ('maintenance', 'procedural', 'post_operative')
  ),
  constraint fi_medication_os_canonical_code_nonempty check (char_length(trim(canonical_code)) > 0),
  constraint fi_medication_os_canonical_display_nonempty check (char_length(trim(display_name)) > 0),
  constraint fi_medication_os_canonical_metadata_object check (jsonb_typeof (metadata) = 'object')
);

comment on table fi_medication_os_canonical is
  'MedicationOS: tenant-scoped canonical therapy vocabulary (stable codes for plans, Twin, rules). Optional link to DoctorOS catalogue for pricing alignment.';

create unique index if not exists uq_fi_medication_os_canonical_tenant_code
  on fi_medication_os_canonical (tenant_id, canonical_code);

create index if not exists idx_fi_medication_os_canonical_tenant
  on fi_medication_os_canonical (tenant_id);

create index if not exists idx_fi_medication_os_canonical_tenant_active
  on fi_medication_os_canonical (tenant_id, active);

-- ---------------------------------------------------------------------------
-- fi_patient_therapy_plans
-- ---------------------------------------------------------------------------
create table if not exists fi_patient_therapy_plans (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null references fi_tenants (id) on delete cascade,
  patient_id uuid not null references fi_patients (id) on delete restrict,
  case_id uuid references fi_cases (id) on delete set null,
  consultation_id uuid references fi_consultations (id) on delete set null,
  surgery_plan_id uuid references fi_case_surgery_plans (id) on delete set null,
  plan_type text not null,
  title text not null,
  status text not null default 'draft',
  source text not null,
  valid_from timestamptz,
  valid_until timestamptz,
  surgery_anchor_date date,
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint fi_patient_therapy_plans_plan_type_chk check (
    plan_type in ('maintenance', 'peri_procedural', 'post_operative', 'mixed')
  ),
  constraint fi_patient_therapy_plans_status_chk check (
    status in ('draft', 'active', 'paused', 'completed', 'cancelled', 'superseded')
  ),
  constraint fi_patient_therapy_plans_source_chk check (
    source in (
      'manual',
      'consultation_completion',
      'surgery_postop_bundle',
      'pathology_review',
      'import'
    )
  ),
  constraint fi_patient_therapy_plans_title_nonempty check (char_length(trim(title)) > 0),
  constraint fi_patient_therapy_plans_metadata_object check (jsonb_typeof (metadata) = 'object')
);

comment on table fi_patient_therapy_plans is
  'MedicationOS: patient therapy plan header (intent / regimen); optional anchors to case, consultation, and surgery plan.';

create index if not exists idx_fi_patient_therapy_plans_tenant_patient_status
  on fi_patient_therapy_plans (tenant_id, patient_id, status);

create index if not exists idx_fi_patient_therapy_plans_tenant_case
  on fi_patient_therapy_plans (tenant_id, case_id)
  where case_id is not null;

create index if not exists idx_fi_patient_therapy_plans_tenant
  on fi_patient_therapy_plans (tenant_id);

-- ---------------------------------------------------------------------------
-- fi_patient_therapy_plan_items
-- ---------------------------------------------------------------------------
create table if not exists fi_patient_therapy_plan_items (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null references fi_tenants (id) on delete cascade,
  plan_id uuid not null references fi_patient_therapy_plans (id) on delete cascade,
  canonical_code text not null,
  role text not null,
  dosing_summary text,
  sessions_planned int,
  sessions_completed int not null default 0,
  day_offset_start int,
  day_offset_end int,
  pathology_gate text,
  prescription_id uuid,
  prescription_item_id uuid,
  sort_order int not null default 0,
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint fi_patient_therapy_plan_items_role_chk check (
    role in (
      'continuous',
      'taper',
      'course',
      'prn',
      'procedural_session',
      'supplement'
    )
  ),
  constraint fi_patient_therapy_plan_items_canonical_nonempty check (
    char_length(trim(canonical_code)) > 0
  ),
  constraint fi_patient_therapy_plan_items_sessions_nonneg check (
    sessions_planned is null or sessions_planned >= 0
  ),
  constraint fi_patient_therapy_plan_items_sessions_completed_nonneg check (sessions_completed >= 0),
  constraint fi_patient_therapy_plan_items_metadata_object check (jsonb_typeof (metadata) = 'object')
);

comment on table fi_patient_therapy_plan_items is
  'MedicationOS: lines on a therapy plan; optional links to DoctorOS prescription headers/items when fulfilled.';

create index if not exists idx_fi_patient_therapy_plan_items_tenant_plan_sort
  on fi_patient_therapy_plan_items (tenant_id, plan_id, sort_order);

create index if not exists idx_fi_patient_therapy_plan_items_tenant
  on fi_patient_therapy_plan_items (tenant_id);

-- ---------------------------------------------------------------------------
-- fi_patient_therapy_events (append-only; no updated_at)
-- ---------------------------------------------------------------------------
create table if not exists fi_patient_therapy_events (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null references fi_tenants (id) on delete cascade,
  patient_id uuid not null references fi_patients (id) on delete restrict,
  case_id uuid references fi_cases (id) on delete set null,
  consultation_id uuid references fi_consultations (id) on delete set null,
  plan_id uuid references fi_patient_therapy_plans (id) on delete set null,
  plan_item_id uuid references fi_patient_therapy_plan_items (id) on delete set null,
  prescription_id uuid,
  prescription_item_id uuid,
  pathology_request_id uuid,
  pathology_result_id uuid,
  event_type text not null,
  canonical_code text,
  occurred_at timestamptz not null,
  actor_user_id uuid references fi_users (id) on delete set null,
  detail jsonb not null default '{}'::jsonb,
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  constraint fi_patient_therapy_events_event_type_chk check (
    event_type in (
      'plan_created',
      'plan_activated',
      'plan_paused',
      'plan_resumed',
      'plan_completed',
      'plan_cancelled',
      'plan_superseded',
      'therapy_started',
      'therapy_stopped',
      'dose_changed',
      'session_completed',
      'pathology_gate_cleared',
      'therapy_on_hold',
      'adverse_event',
      'adherence_note',
      'prescription_linked'
    )
  ),
  constraint fi_patient_therapy_events_detail_object check (jsonb_typeof (detail) = 'object'),
  constraint fi_patient_therapy_events_metadata_object check (jsonb_typeof (metadata) = 'object')
);

comment on table fi_patient_therapy_events is
  'MedicationOS: append-only clinical / audit stream for therapy lifecycle (authoritative MedicationOS event log).';

create index if not exists idx_fi_patient_therapy_events_tenant_patient_occurred
  on fi_patient_therapy_events (tenant_id, patient_id, occurred_at desc);

create index if not exists idx_fi_patient_therapy_events_tenant_plan
  on fi_patient_therapy_events (tenant_id, plan_id)
  where plan_id is not null;

create index if not exists idx_fi_patient_therapy_events_tenant_plan_item
  on fi_patient_therapy_events (tenant_id, plan_item_id)
  where plan_item_id is not null;

create index if not exists idx_fi_patient_therapy_events_tenant
  on fi_patient_therapy_events (tenant_id);

-- ---------------------------------------------------------------------------
-- updated_at triggers (per-table functions; same pattern as fi_pathology_requests)
-- ---------------------------------------------------------------------------
create or replace function fi_medication_os_canonical_set_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at := now();
  return new;
end;
$$;

drop trigger if exists trg_fi_medication_os_canonical_set_updated_at on fi_medication_os_canonical;
create trigger trg_fi_medication_os_canonical_set_updated_at
  before update on fi_medication_os_canonical
  for each row
  execute procedure fi_medication_os_canonical_set_updated_at();

create or replace function fi_patient_therapy_plans_set_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at := now();
  return new;
end;
$$;

drop trigger if exists trg_fi_patient_therapy_plans_set_updated_at on fi_patient_therapy_plans;
create trigger trg_fi_patient_therapy_plans_set_updated_at
  before update on fi_patient_therapy_plans
  for each row
  execute procedure fi_patient_therapy_plans_set_updated_at();

create or replace function fi_patient_therapy_plan_items_set_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at := now();
  return new;
end;
$$;

drop trigger if exists trg_fi_patient_therapy_plan_items_set_updated_at on fi_patient_therapy_plan_items;
create trigger trg_fi_patient_therapy_plan_items_set_updated_at
  before update on fi_patient_therapy_plan_items
  for each row
  execute procedure fi_patient_therapy_plan_items_set_updated_at();

-- ---------------------------------------------------------------------------
-- Optional foreign keys (when DoctorOS prescribing / pathology tables exist)
-- ---------------------------------------------------------------------------
do $medos_optional_fks$
begin
  if to_regclass('public.fi_medication_catalogue') is not null then
    if not exists (
      select 1
      from pg_constraint c
      join pg_class t on t.oid = c.conrelid
      join pg_namespace n on n.oid = t.relnamespace
      where n.nspname = 'public'
        and t.relname = 'fi_medication_os_canonical'
        and c.conname = 'fi_medication_os_canonical_catalogue_id_fkey'
    ) then
      alter table fi_medication_os_canonical
        add constraint fi_medication_os_canonical_catalogue_id_fkey
        foreign key (catalogue_id) references fi_medication_catalogue (id) on delete set null;
    end if;
  end if;

  if to_regclass('public.fi_patient_prescriptions') is not null then
    if not exists (
      select 1 from pg_constraint c
      join pg_class t on t.oid = c.conrelid
      join pg_namespace n on n.oid = t.relnamespace
      where n.nspname = 'public'
        and t.relname = 'fi_patient_therapy_plan_items'
        and c.conname = 'fi_patient_therapy_plan_items_prescription_id_fkey'
    ) then
      alter table fi_patient_therapy_plan_items
        add constraint fi_patient_therapy_plan_items_prescription_id_fkey
        foreign key (prescription_id) references fi_patient_prescriptions (id) on delete set null;
    end if;
  end if;

  if to_regclass('public.fi_prescription_items') is not null then
    if not exists (
      select 1 from pg_constraint c
      join pg_class t on t.oid = c.conrelid
      join pg_namespace n on n.oid = t.relnamespace
      where n.nspname = 'public'
        and t.relname = 'fi_patient_therapy_plan_items'
        and c.conname = 'fi_patient_therapy_plan_items_prescription_item_id_fkey'
    ) then
      alter table fi_patient_therapy_plan_items
        add constraint fi_patient_therapy_plan_items_prescription_item_id_fkey
        foreign key (prescription_item_id) references fi_prescription_items (id) on delete set null;
    end if;
  end if;

  if to_regclass('public.fi_patient_prescriptions') is not null then
    if not exists (
      select 1 from pg_constraint c
      join pg_class t on t.oid = c.conrelid
      join pg_namespace n on n.oid = t.relnamespace
      where n.nspname = 'public'
        and t.relname = 'fi_patient_therapy_events'
        and c.conname = 'fi_patient_therapy_events_prescription_id_fkey'
    ) then
      alter table fi_patient_therapy_events
        add constraint fi_patient_therapy_events_prescription_id_fkey
        foreign key (prescription_id) references fi_patient_prescriptions (id) on delete set null;
    end if;
  end if;

  if to_regclass('public.fi_prescription_items') is not null then
    if not exists (
      select 1 from pg_constraint c
      join pg_class t on t.oid = c.conrelid
      join pg_namespace n on n.oid = t.relnamespace
      where n.nspname = 'public'
        and t.relname = 'fi_patient_therapy_events'
        and c.conname = 'fi_patient_therapy_events_prescription_item_id_fkey'
    ) then
      alter table fi_patient_therapy_events
        add constraint fi_patient_therapy_events_prescription_item_id_fkey
        foreign key (prescription_item_id) references fi_prescription_items (id) on delete set null;
    end if;
  end if;

  if to_regclass('public.fi_pathology_requests') is not null then
    if not exists (
      select 1 from pg_constraint c
      join pg_class t on t.oid = c.conrelid
      join pg_namespace n on n.oid = t.relnamespace
      where n.nspname = 'public'
        and t.relname = 'fi_patient_therapy_events'
        and c.conname = 'fi_patient_therapy_events_pathology_request_id_fkey'
    ) then
      alter table fi_patient_therapy_events
        add constraint fi_patient_therapy_events_pathology_request_id_fkey
        foreign key (pathology_request_id) references fi_pathology_requests (id) on delete set null;
    end if;
  end if;

  if to_regclass('public.fi_pathology_results') is not null then
    if not exists (
      select 1 from pg_constraint c
      join pg_class t on t.oid = c.conrelid
      join pg_namespace n on n.oid = t.relnamespace
      where n.nspname = 'public'
        and t.relname = 'fi_patient_therapy_events'
        and c.conname = 'fi_patient_therapy_events_pathology_result_id_fkey'
    ) then
      alter table fi_patient_therapy_events
        add constraint fi_patient_therapy_events_pathology_result_id_fkey
        foreign key (pathology_result_id) references fi_pathology_results (id) on delete set null;
    end if;
  end if;
end
$medos_optional_fks$;

-- If prescribing/pathology were added only in a later deployment after this migration already
-- ran once, FKs are not auto-repaired; re-run the DO block above or ship a small follow-up migration.

-- ---------------------------------------------------------------------------
-- RLS (mirror fi_prescribing: tenant member SELECT; service_role writes)
-- ---------------------------------------------------------------------------
alter table fi_medication_os_canonical enable row level security;
alter table fi_patient_therapy_plans enable row level security;
alter table fi_patient_therapy_plan_items enable row level security;
alter table fi_patient_therapy_events enable row level security;

drop policy if exists fi_medication_os_canonical_select_tenant_member on fi_medication_os_canonical;
create policy fi_medication_os_canonical_select_tenant_member
  on fi_medication_os_canonical for select to authenticated
  using (
    exists (
      select 1 from fi_users u
      where u.auth_user_id = auth.uid()
        and u.tenant_id = fi_medication_os_canonical.tenant_id
    )
  );

drop policy if exists fi_patient_therapy_plans_select_tenant_member on fi_patient_therapy_plans;
create policy fi_patient_therapy_plans_select_tenant_member
  on fi_patient_therapy_plans for select to authenticated
  using (
    exists (
      select 1 from fi_users u
      where u.auth_user_id = auth.uid()
        and u.tenant_id = fi_patient_therapy_plans.tenant_id
    )
  );

drop policy if exists fi_patient_therapy_plan_items_select_tenant_member on fi_patient_therapy_plan_items;
create policy fi_patient_therapy_plan_items_select_tenant_member
  on fi_patient_therapy_plan_items for select to authenticated
  using (
    exists (
      select 1 from fi_users u
      where u.auth_user_id = auth.uid()
        and u.tenant_id = fi_patient_therapy_plan_items.tenant_id
    )
  );

drop policy if exists fi_patient_therapy_events_select_tenant_member on fi_patient_therapy_events;
create policy fi_patient_therapy_events_select_tenant_member
  on fi_patient_therapy_events for select to authenticated
  using (
    exists (
      select 1 from fi_users u
      where u.auth_user_id = auth.uid()
        and u.tenant_id = fi_patient_therapy_events.tenant_id
    )
  );

grant select on fi_medication_os_canonical to authenticated, service_role;
grant insert, update, delete on fi_medication_os_canonical to service_role;

grant select on fi_patient_therapy_plans to authenticated, service_role;
grant insert, update, delete on fi_patient_therapy_plans to service_role;

grant select on fi_patient_therapy_plan_items to authenticated, service_role;
grant insert, update, delete on fi_patient_therapy_plan_items to service_role;

grant select on fi_patient_therapy_events to authenticated, service_role;
grant insert, update, delete on fi_patient_therapy_events to service_role;

-- ---------------------------------------------------------------------------
-- Seed canonical rows (once per tenant that has zero MedicationOS canonical rows)
-- ---------------------------------------------------------------------------
with seed (
  canonical_code,
  display_name,
  therapy_track,
  default_route
) as (
  values
    ('finasteride', 'Finasteride', 'maintenance'::text, 'oral'),
    ('dutasteride', 'Dutasteride', 'maintenance', 'oral'),
    ('oral_minoxidil', 'Oral minoxidil', 'maintenance', 'oral'),
    ('topical_minoxidil', 'Topical minoxidil', 'maintenance', 'topical'),
    ('spironolactone', 'Spironolactone', 'maintenance', 'oral'),
    ('saw_palmetto', 'Saw palmetto', 'maintenance', 'oral'),
    ('prp', 'PRP', 'procedural', 'intradermal'),
    ('prf', 'PRF', 'procedural', 'intradermal'),
    ('exosomes', 'Exosomes', 'procedural', 'intradermal'),
    ('iron_infusion', 'Iron infusion', 'procedural', 'iv'),
    ('antibiotics', 'Antibiotics (post-operative)', 'post_operative', 'oral'),
    ('prednisolone', 'Prednisolone', 'post_operative', 'oral'),
    ('pain_medication', 'Pain medication', 'post_operative', 'oral')
),
tenants_without_medication_os_canonical as (
  select t.id as tenant_id
  from fi_tenants t
  where not exists (
    select 1 from fi_medication_os_canonical c where c.tenant_id = t.id limit 1
  )
)
insert into fi_medication_os_canonical (
  tenant_id,
  canonical_code,
  display_name,
  therapy_track,
  default_route,
  active,
  metadata
)
select
  tw.tenant_id,
  s.canonical_code,
  s.display_name,
  s.therapy_track,
  s.default_route,
  true,
  '{}'::jsonb
from tenants_without_medication_os_canonical tw
cross join seed s;
