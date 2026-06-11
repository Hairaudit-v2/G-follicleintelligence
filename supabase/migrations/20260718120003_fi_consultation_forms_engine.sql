-- ConsultationOS Stage 1: configurable consultation form templates, versions, and instances.
-- Authenticated tenant members: SELECT. Mutations via service_role (Next.js server actions).

-- ---------------------------------------------------------------------------
-- Provenance columns (nullable FKs for future SurgeryOS / media / pathology links)
-- ---------------------------------------------------------------------------
alter table fi_patient_images
  add column if not exists consultation_id uuid references fi_consultations (id) on delete set null;

alter table fi_patient_images
  add column if not exists form_instance_id uuid;

create index if not exists idx_fi_patient_images_consultation_id
  on fi_patient_images (tenant_id, consultation_id)
  where consultation_id is not null;

alter table fi_clinical_notes
  add column if not exists form_instance_id uuid;

alter table fi_clinical_notes
  add column if not exists form_field_id text;

create index if not exists idx_fi_clinical_notes_form_instance_id
  on fi_clinical_notes (tenant_id, form_instance_id)
  where form_instance_id is not null;

alter table fi_crm_quotes
  add column if not exists consultation_id uuid references fi_consultations (id) on delete set null;

create index if not exists idx_fi_crm_quotes_consultation_id
  on fi_crm_quotes (tenant_id, consultation_id)
  where consultation_id is not null;

alter table fi_crm_tasks
  add column if not exists consultation_id uuid references fi_consultations (id) on delete set null;

create index if not exists idx_fi_crm_tasks_consultation_id
  on fi_crm_tasks (tenant_id, consultation_id)
  where consultation_id is not null;

alter table fi_pathology_requests
  add column if not exists consultation_id uuid references fi_consultations (id) on delete set null;

alter table fi_pathology_requests
  add column if not exists form_instance_id uuid;

create index if not exists idx_fi_pathology_requests_consultation_id
  on fi_pathology_requests (tenant_id, consultation_id)
  where consultation_id is not null;

create index if not exists idx_fi_pathology_requests_form_instance_id
  on fi_pathology_requests (tenant_id, form_instance_id)
  where form_instance_id is not null;

-- ---------------------------------------------------------------------------
-- fi_consultation_form_templates
-- ---------------------------------------------------------------------------
create table if not exists fi_consultation_form_templates (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid references fi_tenants (id) on delete cascade,
  slug text not null,
  name text not null,
  treatment_program text not null,
  description text,
  is_active boolean not null default true,
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint fi_consultation_form_templates_metadata_object check (jsonb_typeof (metadata) = 'object')
);

comment on table fi_consultation_form_templates is
  'ConsultationOS form definitions; tenant_id null = global catalog template readable by all FI tenant members.';

create unique index if not exists idx_fi_consultation_form_templates_global_slug
  on fi_consultation_form_templates (slug)
  where tenant_id is null;

create unique index if not exists idx_fi_consultation_form_templates_tenant_slug
  on fi_consultation_form_templates (tenant_id, slug)
  where tenant_id is not null;

create index if not exists idx_fi_consultation_form_templates_tenant_id
  on fi_consultation_form_templates (tenant_id)
  where tenant_id is not null;

-- ---------------------------------------------------------------------------
-- fi_consultation_form_template_versions
-- ---------------------------------------------------------------------------
create table if not exists fi_consultation_form_template_versions (
  id uuid primary key default gen_random_uuid(),
  template_id uuid not null references fi_consultation_form_templates (id) on delete cascade,
  version integer not null,
  status text not null default 'draft',
  schema jsonb not null,
  ui_layout jsonb not null default '{}'::jsonb,
  published_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint fi_consultation_form_template_versions_status_chk check (
    status in ('draft', 'published', 'archived')
  ),
  constraint fi_consultation_form_template_versions_schema_object check (jsonb_typeof (schema) = 'object'),
  constraint fi_consultation_form_template_versions_ui_layout_object check (jsonb_typeof (ui_layout) = 'object'),
  constraint fi_consultation_form_template_versions_unique_template_version unique (template_id, version)
);

comment on table fi_consultation_form_template_versions is
  'Versioned JSON schema + optional UI layout for a consultation form template.';

create index if not exists idx_fi_consultation_form_template_versions_template
  on fi_consultation_form_template_versions (template_id, version desc);

-- ---------------------------------------------------------------------------
-- fi_consultation_form_instances
-- ---------------------------------------------------------------------------
create table if not exists fi_consultation_form_instances (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null references fi_tenants (id) on delete cascade,
  consultation_id uuid not null references fi_consultations (id) on delete cascade,
  template_version_id uuid not null references fi_consultation_form_template_versions (id) on delete restrict,
  channel text not null,
  status text not null default 'draft',
  values jsonb not null default '{}'::jsonb,
  computed jsonb not null default '{}'::jsonb,
  started_at timestamptz not null default now(),
  submitted_at timestamptz,
  submitted_by_user_id uuid references fi_users (id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint fi_consultation_form_instances_channel_chk check (
    channel in ('pre_arrival', 'in_room', 'staff_amendment', 'telehealth')
  ),
  constraint fi_consultation_form_instances_status_chk check (status in ('draft', 'submitted', 'locked')),
  constraint fi_consultation_form_instances_values_object check (jsonb_typeof (values) = 'object'),
  constraint fi_consultation_form_instances_computed_object check (jsonb_typeof (computed) = 'object')
);

comment on table fi_consultation_form_instances is
  'Per-consultation filled form (JSON values); mutations via service role.';

create index if not exists idx_fi_consultation_form_instances_tenant_consultation
  on fi_consultation_form_instances (tenant_id, consultation_id);

create index if not exists idx_fi_consultation_form_instances_template_version
  on fi_consultation_form_instances (template_version_id);

create unique index if not exists idx_fi_consultation_form_instances_consultation_version_channel
  on fi_consultation_form_instances (consultation_id, template_version_id, channel);

-- Defer FKs to instances until instances table exists
alter table fi_patient_images drop constraint if exists fi_patient_images_form_instance_id_fkey;
alter table fi_patient_images
  add constraint fi_patient_images_form_instance_id_fkey
  foreign key (form_instance_id) references fi_consultation_form_instances (id) on delete set null;

alter table fi_clinical_notes drop constraint if exists fi_clinical_notes_form_instance_id_fkey;
alter table fi_clinical_notes
  add constraint fi_clinical_notes_form_instance_id_fkey
  foreign key (form_instance_id) references fi_consultation_form_instances (id) on delete set null;

alter table fi_pathology_requests drop constraint if exists fi_pathology_requests_form_instance_id_fkey;
alter table fi_pathology_requests
  add constraint fi_pathology_requests_form_instance_id_fkey
  foreign key (form_instance_id) references fi_consultation_form_instances (id) on delete set null;

-- ---------------------------------------------------------------------------
-- updated_at triggers
-- ---------------------------------------------------------------------------
create or replace function fi_consultation_form_templates_set_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at := now();
  return new;
end;
$$;

drop trigger if exists trg_fi_consultation_form_templates_set_updated_at on fi_consultation_form_templates;
create trigger trg_fi_consultation_form_templates_set_updated_at
  before update on fi_consultation_form_templates
  for each row
  execute procedure fi_consultation_form_templates_set_updated_at();

create or replace function fi_consultation_form_template_versions_set_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at := now();
  return new;
end;
$$;

drop trigger if exists trg_fi_consultation_form_template_versions_set_updated_at on fi_consultation_form_template_versions;
create trigger trg_fi_consultation_form_template_versions_set_updated_at
  before update on fi_consultation_form_template_versions
  for each row
  execute procedure fi_consultation_form_template_versions_set_updated_at();

create or replace function fi_consultation_form_instances_set_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at := now();
  return new;
end;
$$;

drop trigger if exists trg_fi_consultation_form_instances_set_updated_at on fi_consultation_form_instances;
create trigger trg_fi_consultation_form_instances_set_updated_at
  before update on fi_consultation_form_instances
  for each row
  execute procedure fi_consultation_form_instances_set_updated_at();

-- ---------------------------------------------------------------------------
-- Row level security
-- ---------------------------------------------------------------------------
alter table fi_consultation_form_templates enable row level security;

drop policy if exists fi_consultation_form_templates_select_tenant_member on fi_consultation_form_templates;
create policy fi_consultation_form_templates_select_tenant_member
  on fi_consultation_form_templates for select to authenticated
  using (
    fi_consultation_form_templates.tenant_id is null
    or exists (
      select 1 from fi_users u
      where u.auth_user_id = auth.uid()
        and u.tenant_id = fi_consultation_form_templates.tenant_id
    )
  );

alter table fi_consultation_form_template_versions enable row level security;

drop policy if exists fi_consultation_form_template_versions_select_tenant_member
  on fi_consultation_form_template_versions;
create policy fi_consultation_form_template_versions_select_tenant_member
  on fi_consultation_form_template_versions for select to authenticated
  using (
    exists (
      select 1
      from fi_consultation_form_templates t
      where t.id = fi_consultation_form_template_versions.template_id
        and (
          t.tenant_id is null
          or exists (
            select 1 from fi_users u
            where u.auth_user_id = auth.uid()
              and u.tenant_id = t.tenant_id
          )
        )
    )
  );

alter table fi_consultation_form_instances enable row level security;

drop policy if exists fi_consultation_form_instances_select_tenant_member on fi_consultation_form_instances;
create policy fi_consultation_form_instances_select_tenant_member
  on fi_consultation_form_instances for select to authenticated
  using (
    exists (
      select 1 from fi_users u
      where u.auth_user_id = auth.uid()
        and u.tenant_id = fi_consultation_form_instances.tenant_id
    )
  );

-- ---------------------------------------------------------------------------
-- Privileges: authenticated read-only; service_role full DML
-- ---------------------------------------------------------------------------
grant select on fi_consultation_form_templates to authenticated, service_role;
grant insert, update, delete on fi_consultation_form_templates to service_role;

grant select on fi_consultation_form_template_versions to authenticated, service_role;
grant insert, update, delete on fi_consultation_form_template_versions to service_role;

grant select on fi_consultation_form_instances to authenticated, service_role;
grant insert, update, delete on fi_consultation_form_instances to service_role;
