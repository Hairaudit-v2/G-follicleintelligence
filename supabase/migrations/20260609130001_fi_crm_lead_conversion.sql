-- Stage 2L: CRM lead conversion tracking (person/patient/case bridge without deleting the lead).

alter table fi_crm_leads
  add column if not exists converted_person_id uuid references fi_persons (id) on delete set null,
  add column if not exists converted_case_id uuid references fi_cases (id) on delete set null,
  add column if not exists converted_at timestamptz,
  add column if not exists converted_by_user_id uuid references fi_users (id) on delete set null;

comment on column fi_crm_leads.converted_person_id is 'CRM Stage 2L: person id at conversion (typically matches person_id).';
comment on column fi_crm_leads.converted_case_id is 'CRM Stage 2L: optional seeded fi_cases row from conversion.';
comment on column fi_crm_leads.converted_at is 'CRM Stage 2L: when the lead was converted to foundation patient/case.';
comment on column fi_crm_leads.converted_by_user_id is 'CRM Stage 2L: fi_users actor (server-resolved only).';

create index if not exists idx_fi_crm_leads_tenant_converted_person
  on fi_crm_leads (tenant_id, converted_person_id)
  where converted_person_id is not null;

create index if not exists idx_fi_crm_leads_tenant_converted_case
  on fi_crm_leads (tenant_id, converted_case_id)
  where converted_case_id is not null;

create index if not exists idx_fi_crm_leads_tenant_converted_at
  on fi_crm_leads (tenant_id, converted_at)
  where converted_at is not null;
