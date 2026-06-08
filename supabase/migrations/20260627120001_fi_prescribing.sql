-- DoctorOS 1A: compound pharmacy catalogue + patient prescriptions (internal workflow; no auto-send).

-- ---------- Medication catalogue (tenant-scoped; seeded from compound pricing list structure) ----------
create table if not exists fi_medication_catalogue (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null references fi_tenants (id) on delete cascade,
  category text not null,
  medication_name text not null,
  form_type text not null,
  quantity_label text not null,
  base_price numeric(12, 2) not null default 0,
  active boolean not null default true,
  pharmacy_notes text,
  requires_doctor_approval boolean not null default false,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint fi_medication_catalogue_category_check check (
    category in (
      'common_oral',
      'less_common_oral',
      'common_topical',
      'less_common_topical',
      'delivery_fees'
    )
  ),
  constraint fi_medication_catalogue_form_type_check check (
    form_type in ('capsule', 'solution', 'foam', 'delivery')
  ),
  constraint fi_medication_catalogue_name_nonempty check (char_length(trim(medication_name)) > 0),
  constraint fi_medication_catalogue_quantity_nonempty check (char_length(trim(quantity_label)) > 0)
);

comment on table fi_medication_catalogue is
  'DoctorOS: tenant medication / delivery catalogue (compound pharmacy list structure).';

create index if not exists idx_fi_medication_catalogue_tenant on fi_medication_catalogue (tenant_id);
create index if not exists idx_fi_medication_catalogue_tenant_category
  on fi_medication_catalogue (tenant_id, category);
create index if not exists idx_fi_medication_catalogue_tenant_active
  on fi_medication_catalogue (tenant_id, active);

-- ---------- Patient prescriptions ----------
create table if not exists fi_patient_prescriptions (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null references fi_tenants (id) on delete cascade,
  patient_id uuid not null references fi_patients (id) on delete restrict,
  doctor_id uuid not null references fi_staff (id) on delete restrict,
  case_id uuid references fi_cases (id) on delete set null,
  status text not null default 'draft',
  pharmacy_id uuid,
  pharmacy_name text,
  delivery_type text,
  patient_shipping_address text,
  clinical_notes text,
  signed_at timestamptz,
  sent_at timestamptz,
  /** Internal queue: clinician marked ready for pharmacy hand-off (Stage 1 does not transmit). */
  ready_for_pharmacy_at timestamptz,
  created_by_fi_user_id uuid references fi_users (id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint fi_patient_prescriptions_status_check check (
    status in ('draft', 'signed', 'sent_to_pharmacy', 'dispensed', 'posted', 'cancelled')
  )
);

comment on table fi_patient_prescriptions is
  'DoctorOS: structured hair-loss prescriptions; internal authoring until pharmacy send is implemented.';

create index if not exists idx_fi_patient_prescriptions_tenant on fi_patient_prescriptions (tenant_id);
create index if not exists idx_fi_patient_prescriptions_tenant_patient
  on fi_patient_prescriptions (tenant_id, patient_id);
create index if not exists idx_fi_patient_prescriptions_tenant_case
  on fi_patient_prescriptions (tenant_id, case_id)
  where case_id is not null;
create index if not exists idx_fi_patient_prescriptions_tenant_status
  on fi_patient_prescriptions (tenant_id, status);

-- ---------- Line items ----------
create table if not exists fi_prescription_items (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null references fi_tenants (id) on delete cascade,
  prescription_id uuid not null references fi_patient_prescriptions (id) on delete cascade,
  catalogue_id uuid references fi_medication_catalogue (id) on delete set null,
  medication_name text not null,
  form_type text not null,
  quantity_label text not null,
  dose_instructions text not null default '',
  repeats_instructions text,
  reorder_rule text,
  sort_order int not null default 0,
  created_at timestamptz not null default now(),
  constraint fi_prescription_items_form_type_check check (
    form_type in ('capsule', 'solution', 'foam', 'delivery')
  ),
  constraint fi_prescription_items_name_nonempty check (char_length(trim(medication_name)) > 0)
);

comment on table fi_prescription_items is 'DoctorOS: prescription lines with catalogue link + dosing / repeats.';

create index if not exists idx_fi_prescription_items_prescription on fi_prescription_items (prescription_id);
create index if not exists idx_fi_prescription_items_tenant on fi_prescription_items (tenant_id);

-- ---------- Status audit trail ----------
create table if not exists fi_prescription_status_events (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null references fi_tenants (id) on delete cascade,
  prescription_id uuid not null references fi_patient_prescriptions (id) on delete cascade,
  from_status text,
  to_status text not null,
  actor_fi_user_id uuid references fi_users (id) on delete set null,
  note text,
  created_at timestamptz not null default now(),
  constraint fi_prescription_status_events_to_status_check check (
    to_status in (
      'draft',
      'signed',
      'sent_to_pharmacy',
      'dispensed',
      'posted',
      'cancelled',
      'ready_for_pharmacy'
    )
  ),
  constraint fi_prescription_status_events_from_status_check check (
    from_status is null
    or from_status in (
      'draft',
      'signed',
      'sent_to_pharmacy',
      'dispensed',
      'posted',
      'cancelled',
      'ready_for_pharmacy'
    )
  )
);

comment on table fi_prescription_status_events is 'DoctorOS: append-only prescription workflow events.';

create index if not exists idx_fi_prescription_status_events_rx on fi_prescription_status_events (prescription_id);
create index if not exists idx_fi_prescription_status_events_tenant on fi_prescription_status_events (tenant_id);

-- ---------- RLS (tenant members read; service role writes via FI Admin server actions) ----------
alter table fi_medication_catalogue enable row level security;
alter table fi_patient_prescriptions enable row level security;
alter table fi_prescription_items enable row level security;
alter table fi_prescription_status_events enable row level security;

create policy fi_medication_catalogue_select_tenant_member
  on fi_medication_catalogue for select to authenticated
  using (
    exists (
      select 1 from fi_users u
      where u.auth_user_id = auth.uid()
        and u.tenant_id = fi_medication_catalogue.tenant_id
    )
  );

create policy fi_patient_prescriptions_select_tenant_member
  on fi_patient_prescriptions for select to authenticated
  using (
    exists (
      select 1 from fi_users u
      where u.auth_user_id = auth.uid()
        and u.tenant_id = fi_patient_prescriptions.tenant_id
    )
  );

create policy fi_prescription_items_select_tenant_member
  on fi_prescription_items for select to authenticated
  using (
    exists (
      select 1 from fi_users u
      where u.auth_user_id = auth.uid()
        and u.tenant_id = fi_prescription_items.tenant_id
    )
  );

create policy fi_prescription_status_events_select_tenant_member
  on fi_prescription_status_events for select to authenticated
  using (
    exists (
      select 1 from fi_users u
      where u.auth_user_id = auth.uid()
        and u.tenant_id = fi_prescription_status_events.tenant_id
    )
  );

grant select on fi_medication_catalogue to authenticated, service_role;
grant insert, update, delete on fi_medication_catalogue to service_role;

grant select on fi_patient_prescriptions to authenticated, service_role;
grant insert, update, delete on fi_patient_prescriptions to service_role;

grant select on fi_prescription_items to authenticated, service_role;
grant insert, update, delete on fi_prescription_items to service_role;

grant select on fi_prescription_status_events to authenticated, service_role;
grant insert, update, delete on fi_prescription_status_events to service_role;

-- ---------- Seed default catalogue (structure from compound pharmacy pricing list; illustrative prices) ----------
with seed (
  category,
  medication_name,
  form_type,
  quantity_label,
  base_price,
  pharmacy_notes,
  requires_doctor_approval
) as (
  values
    -- Common oral
    (
      'common_oral',
      'Finasteride 1mg',
      'capsule',
      '30 capsules',
      88.00::numeric,
      'Male pattern hair loss — confirm contraindications and fertility counselling.',
      false
    ),
    (
      'common_oral',
      'Dutasteride 0.5mg',
      'capsule',
      '30 capsules',
      115.00::numeric,
      'Off-label for hair loss in some regions; document informed consent.',
      true
    ),
    (
      'common_oral',
      'Spironolactone (female pattern)',
      'capsule',
      '100 capsules',
      95.00::numeric,
      'Female patients only where clinically appropriate; monitor electrolytes per protocol.',
      true
    ),
    (
      'common_oral',
      'Low-dose oral minoxidil',
      'capsule',
      '30 capsules',
      72.00::numeric,
      'Compounded strength per prescriber; counsel on cardiovascular symptoms.',
      true
    ),
    -- Less common oral
    (
      'less_common_oral',
      'Minoxidil + taurine compound (oral)',
      'capsule',
      '60 capsules',
      140.00::numeric,
      'Non-standard compound; confirm pharmacy formulation sheet.',
      true
    ),
    (
      'less_common_oral',
      'Dutasteride + biotin support blend',
      'capsule',
      '30 capsules',
      125.00::numeric,
      'Supplement adjunct; verify active ingredients with pharmacy.',
      true
    ),
    -- Common topical
    (
      'common_topical',
      'Minoxidil 5% solution',
      'solution',
      '60 mL bottle',
      65.00::numeric,
      'Twice-daily application unless directed otherwise.',
      false
    ),
    (
      'common_topical',
      'Minoxidil 5% foam (alcohol-free)',
      'foam',
      '60 g can',
      78.00::numeric,
      'Preferred for sensitive scalp; avoid inhalation.',
      false
    ),
    (
      'common_topical',
      'Finasteride 0.25% topical solution',
      'solution',
      '60 mL',
      145.00::numeric,
      'Topical finasteride where formulary supports; pregnancy handling as per protocol.',
      true
    ),
    -- Less common topical
    (
      'less_common_topical',
      'Minoxidil 7% + tretinoin 0.01% solution',
      'solution',
      '30 mL',
      165.00::numeric,
      'Compounded penetration enhancer; counsel on irritation and sun sensitivity.',
      true
    ),
    (
      'less_common_topical',
      'Dutasteride topical micro-emulsion',
      'solution',
      '30 mL',
      195.00::numeric,
      'Specialist compound; confirm batch stability notes from pharmacy.',
      true
    ),
    (
      'less_common_topical',
      'Ketoconazole 2% + minoxidil 5% shampoo base',
      'solution',
      '200 mL',
      88.00::numeric,
      'Wash-off protocol; document contact time instructions.',
      true
    ),
    -- Delivery
    (
      'delivery_fees',
      'Standard pharmacy delivery',
      'delivery',
      'Per order',
      12.50::numeric,
      'Nationwide standard; allow 3–5 business days.',
      false
    ),
    (
      'delivery_fees',
      'Express tracked delivery',
      'delivery',
      'Per order',
      22.00::numeric,
      'Cold-chain where applicable — confirm with pharmacy before selecting.',
      false
    )
),
tenants_without_catalogue as (
  select t.id as tenant_id
  from fi_tenants t
  where not exists (
    select 1 from fi_medication_catalogue c where c.tenant_id = t.id limit 1
  )
)
insert into fi_medication_catalogue (
  tenant_id,
  category,
  medication_name,
  form_type,
  quantity_label,
  base_price,
  active,
  pharmacy_notes,
  requires_doctor_approval
)
select
  twc.tenant_id,
  s.category,
  s.medication_name,
  s.form_type,
  s.quantity_label,
  s.base_price,
  true,
  s.pharmacy_notes,
  s.requires_doctor_approval
from tenants_without_catalogue twc
cross join seed s;
