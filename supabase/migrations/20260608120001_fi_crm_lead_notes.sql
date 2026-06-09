-- Stage 2J: internal lead-scoped notes (`fi_crm_lead_notes`), distinct from `fi_crm_notes`.
-- RLS + grants: same pattern as other `fi_crm_*` tables (authenticated SELECT; service_role DML).

create table if not exists fi_crm_lead_notes (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null references fi_tenants (id) on delete cascade,
  lead_id uuid not null references fi_crm_leads (id) on delete cascade,
  author_user_id uuid references fi_users (id) on delete set null,
  note_body text not null,
  note_visibility text not null default 'internal',
  is_pinned boolean not null default false,
  archived_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint fi_crm_lead_notes_visibility_allowed check (
    note_visibility in ('internal', 'sales', 'clinical', 'admin')
  )
);

comment on table fi_crm_lead_notes is
  'CRM Stage 2J: internal notes anchored on a single lead; not patient-facing.';

create index if not exists idx_fi_crm_lead_notes_tenant_lead on fi_crm_lead_notes (tenant_id, lead_id);
create index if not exists idx_fi_crm_lead_notes_tenant_lead_archived on fi_crm_lead_notes (tenant_id, lead_id, archived_at);
create index if not exists idx_fi_crm_lead_notes_tenant_lead_pinned on fi_crm_lead_notes (tenant_id, lead_id, is_pinned);
create index if not exists idx_fi_crm_lead_notes_tenant_lead_created on fi_crm_lead_notes (tenant_id, lead_id, created_at desc);

alter table fi_crm_lead_notes enable row level security;

drop policy if exists fi_crm_lead_notes_select_tenant_member on fi_crm_lead_notes;
create policy fi_crm_lead_notes_select_tenant_member
  on fi_crm_lead_notes for select to authenticated
  using (
    exists (
      select 1 from fi_users u
      where u.auth_user_id = auth.uid()
        and u.tenant_id = fi_crm_lead_notes.tenant_id
    )
  );

grant select on fi_crm_lead_notes to authenticated, service_role;
grant insert, update, delete on fi_crm_lead_notes to service_role;
