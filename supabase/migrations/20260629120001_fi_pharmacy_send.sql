-- DoctorOS 1B: compound pharmacy directory + secure transmission log + repeat-rule confirmation on line items.

-- ---------- Compound pharmacies (tenant directory) ----------
create table if not exists fi_compound_pharmacies (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null references fi_tenants (id) on delete cascade,
  pharmacy_name text not null,
  contact_email text not null,
  api_endpoint text,
  phone text,
  address text,
  active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint fi_compound_pharmacies_name_nonempty check (char_length(trim(pharmacy_name)) > 0),
  constraint fi_compound_pharmacies_email_nonempty check (char_length(trim(contact_email)) > 0)
);

comment on table fi_compound_pharmacies is
  'DoctorOS: tenant compound pharmacy partners for prescription transmission.';

create index if not exists idx_fi_compound_pharmacies_tenant on fi_compound_pharmacies (tenant_id);
create index if not exists idx_fi_compound_pharmacies_tenant_active on fi_compound_pharmacies (tenant_id, active);

-- ---------- Prescription items: prescriber must confirm repeat / reorder text before pharmacy send ----------
alter table fi_prescription_items
  add column if not exists repeat_rules_prescriber_confirmed boolean not null default false;

comment on column fi_prescription_items.repeat_rules_prescriber_confirmed is
  'When repeats_instructions or reorder_rule is set, prescriber must confirm before sign/send (blocks patient reorder without doctor-approved repeat rules).';

update fi_prescription_items
set repeat_rules_prescriber_confirmed = true
where coalesce(trim(repeats_instructions), '') = ''
  and coalesce(trim(reorder_rule), '') = '';

-- ---------- Link prescription.pharmacy_id to compound pharmacy (clear legacy orphan UUIDs first) ----------
update fi_patient_prescriptions set pharmacy_id = null where pharmacy_id is not null;

alter table fi_patient_prescriptions drop constraint if exists fi_patient_prescriptions_pharmacy_compound_fk;

alter table fi_patient_prescriptions
  add constraint fi_patient_prescriptions_pharmacy_compound_fk
  foreign key (pharmacy_id) references fi_compound_pharmacies (id) on delete set null;

-- ---------- Pharmacy transmissions ----------
create table if not exists fi_pharmacy_transmissions (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null references fi_tenants (id) on delete cascade,
  prescription_id uuid not null references fi_patient_prescriptions (id) on delete cascade,
  pharmacy_id uuid not null references fi_compound_pharmacies (id) on delete restrict,
  method text not null,
  status text not null default 'pending',
  payload_snapshot jsonb not null default '{}'::jsonb,
  sent_at timestamptz,
  error_message text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint fi_pharmacy_transmissions_method_check check (method in ('email', 'api', 'manual_export')),
  constraint fi_pharmacy_transmissions_status_check check (
    status in ('pending', 'sent', 'failed', 'acknowledged')
  )
);

comment on table fi_pharmacy_transmissions is
  'DoctorOS: outbound pharmacy order attempts (email, API, or manual export attestation).';

create index if not exists idx_fi_pharmacy_transmissions_tenant on fi_pharmacy_transmissions (tenant_id);
create index if not exists idx_fi_pharmacy_transmissions_rx on fi_pharmacy_transmissions (prescription_id);
create index if not exists idx_fi_pharmacy_transmissions_tenant_rx
  on fi_pharmacy_transmissions (tenant_id, prescription_id);

-- ---------- Status events: allow pharmacy acknowledgement audit values ----------
alter table fi_prescription_status_events drop constraint if exists fi_prescription_status_events_to_status_check;
alter table fi_prescription_status_events drop constraint if exists fi_prescription_status_events_from_status_check;

alter table fi_prescription_status_events
  add constraint fi_prescription_status_events_to_status_check check (
    to_status in (
      'draft',
      'signed',
      'sent_to_pharmacy',
      'dispensed',
      'posted',
      'cancelled',
      'ready_for_pharmacy',
      'pharmacy_acknowledged'
    )
  );

alter table fi_prescription_status_events
  add constraint fi_prescription_status_events_from_status_check check (
    from_status is null
    or from_status in (
      'draft',
      'signed',
      'sent_to_pharmacy',
      'dispensed',
      'posted',
      'cancelled',
      'ready_for_pharmacy',
      'pharmacy_acknowledged'
    )
  );

-- ---------- RLS ----------
alter table fi_compound_pharmacies enable row level security;
alter table fi_pharmacy_transmissions enable row level security;

create policy fi_compound_pharmacies_select_tenant_member
  on fi_compound_pharmacies for select to authenticated
  using (
    exists (
      select 1 from fi_users u
      where u.auth_user_id = auth.uid()
        and u.tenant_id = fi_compound_pharmacies.tenant_id
    )
  );

create policy fi_pharmacy_transmissions_select_tenant_member
  on fi_pharmacy_transmissions for select to authenticated
  using (
    exists (
      select 1 from fi_users u
      where u.auth_user_id = auth.uid()
        and u.tenant_id = fi_pharmacy_transmissions.tenant_id
    )
  );

grant select on fi_compound_pharmacies to authenticated, service_role;
grant insert, update, delete on fi_compound_pharmacies to service_role;

grant select on fi_pharmacy_transmissions to authenticated, service_role;
grant insert, update, delete on fi_pharmacy_transmissions to service_role;

-- ---------- Seed one default pharmacy per tenant (for immediate use in dev / first setup) ----------
insert into fi_compound_pharmacies (
  tenant_id,
  pharmacy_name,
  contact_email,
  api_endpoint,
  phone,
  address,
  active
)
select
  t.id,
  'Default compound pharmacy',
  'pharmacy-orders@example.invalid',
  null,
  null,
  'Replace with your compound partner details in Settings (DoctorOS 1B).',
  true
from fi_tenants t
where not exists (
  select 1 from fi_compound_pharmacies p where p.tenant_id = t.id limit 1
);
