-- FI OS Consent Framework — Sprint A
-- Templates + patient instances (tenant-scoped). FI owns consent (no Timely dependency).
-- Draft legal text only until counsel approves.

-- ---------------------------------------------------------------------------
-- Templates
-- ---------------------------------------------------------------------------
create table if not exists public.fi_consent_templates (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null references public.fi_tenants (id) on delete cascade,
  form_key text not null,
  title text not null,
  version text not null,
  body_md text not null,
  required_for text[] not null default '{}'::text[],
  is_active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint fi_consent_templates_form_key_chk check (
    form_key in (
      'photo_clinical',
      'privacy_treatment',
      'surgery_procedure',
      'prp_treatment',
      'exosome_treatment'
    )
  ),
  constraint fi_consent_templates_title_nonempty check (char_length(trim(title)) > 0),
  constraint fi_consent_templates_version_nonempty check (char_length(trim(version)) > 0),
  constraint fi_consent_templates_body_nonempty check (char_length(trim(body_md)) > 0),
  constraint fi_consent_templates_tenant_key_version_unique unique (tenant_id, form_key, version)
);

comment on table public.fi_consent_templates is
  'FI OS consent form templates per tenant. body_md may be DRAFT until legal-final.';

comment on column public.fi_consent_templates.form_key is
  'Stable key: photo_clinical | privacy_treatment | surgery_procedure | prp_treatment | exosome_treatment';

comment on column public.fi_consent_templates.required_for is
  'Treatment/context tags this template applies to, e.g. photo, surgery, prp, exosome, any';

create index if not exists idx_fi_consent_templates_tenant_active
  on public.fi_consent_templates (tenant_id, is_active)
  where is_active = true;

create index if not exists idx_fi_consent_templates_tenant_form_key
  on public.fi_consent_templates (tenant_id, form_key);

alter table public.fi_consent_templates enable row level security;

drop policy if exists fi_consent_templates_select_tenant_member on public.fi_consent_templates;
create policy fi_consent_templates_select_tenant_member
  on public.fi_consent_templates for select to authenticated
  using (
    exists (
      select 1
      from public.fi_users u
      where u.auth_user_id = auth.uid()
        and u.tenant_id = fi_consent_templates.tenant_id
    )
  );

grant select on public.fi_consent_templates to authenticated, service_role;
grant insert, update, delete on public.fi_consent_templates to service_role;

-- ---------------------------------------------------------------------------
-- Patient instances
-- ---------------------------------------------------------------------------
create table if not exists public.fi_patient_consent_instances (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null references public.fi_tenants (id) on delete cascade,
  patient_id uuid not null references public.fi_patients (id) on delete cascade,
  template_id uuid references public.fi_consent_templates (id) on delete set null,
  form_key text not null,
  form_version text not null,
  status text not null,
  channel text,
  signed_at timestamptz,
  signed_name text,
  recorded_by_fi_user_id uuid references public.fi_users (id) on delete set null,
  evidence_document_id uuid references public.fi_patient_documents (id) on delete set null,
  related_booking_id uuid references public.fi_bookings (id) on delete set null,
  related_case_id uuid references public.fi_cases (id) on delete set null,
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint fi_patient_consent_instances_form_key_chk check (
    form_key in (
      'photo_clinical',
      'privacy_treatment',
      'surgery_procedure',
      'prp_treatment',
      'exosome_treatment'
    )
  ),
  constraint fi_patient_consent_instances_status_chk check (
    status in ('outstanding', 'signed', 'void', 'declined')
  ),
  constraint fi_patient_consent_instances_channel_chk check (
    channel is null
    or channel in ('fi_patient_link', 'fi_clinic_device', 'staff_assisted', 'upload')
  ),
  constraint fi_patient_consent_instances_metadata_object check (jsonb_typeof(metadata) = 'object'),
  constraint fi_patient_consent_instances_version_nonempty check (char_length(trim(form_version)) > 0)
);

comment on table public.fi_patient_consent_instances is
  'Per-patient consent form instances (outstanding/signed). System of truth for FI consent readiness.';

create index if not exists idx_fi_patient_consent_instances_tenant_patient
  on public.fi_patient_consent_instances (tenant_id, patient_id);

create index if not exists idx_fi_patient_consent_instances_tenant_patient_key_status
  on public.fi_patient_consent_instances (tenant_id, patient_id, form_key, status);

-- At most one outstanding row per patient + form_key (any version).
create unique index if not exists uq_fi_patient_consent_instances_outstanding_key
  on public.fi_patient_consent_instances (tenant_id, patient_id, form_key)
  where status = 'outstanding';

alter table public.fi_patient_consent_instances enable row level security;

drop policy if exists fi_patient_consent_instances_select_tenant_member on public.fi_patient_consent_instances;
create policy fi_patient_consent_instances_select_tenant_member
  on public.fi_patient_consent_instances for select to authenticated
  using (
    exists (
      select 1
      from public.fi_users u
      where u.auth_user_id = auth.uid()
        and u.tenant_id = fi_patient_consent_instances.tenant_id
    )
  );

grant select on public.fi_patient_consent_instances to authenticated, service_role;
grant insert, update, delete on public.fi_patient_consent_instances to service_role;

-- ---------------------------------------------------------------------------
-- Seed draft templates for Evolved tenants (slug evolved | evolved-hair | evolved-hair-clinics)
-- ---------------------------------------------------------------------------
insert into public.fi_consent_templates (
  tenant_id,
  form_key,
  title,
  version,
  body_md,
  required_for,
  is_active
)
select
  t.id,
  v.form_key,
  v.title,
  v.version,
  v.body_md,
  v.required_for,
  true
from public.fi_tenants t
cross join (
  values
    (
      'photo_clinical',
      'Clinical photography consent',
      '2026-08-03',
      E'**DRAFT — not legal-final.**\n\nThis is a placeholder clinical photography consent for FI OS Sprint A. It is **not** lawyer-approved and must not be treated as a final legal instrument.\n\nPatient acknowledges clinical images may be captured for assessment, treatment planning, and clinical records.',
      array['photo']::text[]
    ),
    (
      'privacy_treatment',
      'Privacy and treatment information consent',
      '2026-08-03',
      E'**DRAFT — not legal-final.**\n\nThis is a placeholder privacy / treatment information consent for FI OS Sprint A. It is **not** lawyer-approved and must not be treated as a final legal instrument.\n\nPatient acknowledges privacy practices and general treatment information disclosure.',
      array['any']::text[]
    ),
    (
      'surgery_procedure',
      'Hair transplant / surgery procedure consent',
      '2026-08-03',
      E'**DRAFT — not legal-final.**\n\nThis is a placeholder surgical procedure consent for FI OS Sprint A. It is **not** lawyer-approved and must not be treated as a final legal instrument.\n\nPatient acknowledges risks, benefits, and alternatives for hair transplant / surgical procedures.',
      array['surgery']::text[]
    ),
    (
      'prp_treatment',
      'PRP treatment consent',
      '2026-08-03',
      E'**DRAFT — not legal-final.**\n\nThis is a placeholder PRP treatment consent for FI OS Sprint A. It is **not** lawyer-approved and must not be treated as a final legal instrument.\n\nPatient acknowledges PRP treatment nature, risks, and aftercare.',
      array['prp']::text[]
    ),
    (
      'exosome_treatment',
      'Exosome treatment consent',
      '2026-08-03',
      E'**DRAFT — not legal-final.**\n\nThis is a placeholder exosome treatment consent for FI OS Sprint A. It is **not** lawyer-approved and must not be treated as a final legal instrument.\n\nPatient acknowledges exosome treatment nature, risks, and aftercare.',
      array['exosome']::text[]
    )
) as v(form_key, title, version, body_md, required_for)
where lower(trim(t.slug)) in ('evolved', 'evolved-hair', 'evolved-hair-clinics')
  and not exists (
    select 1
    from public.fi_consent_templates existing
    where existing.tenant_id = t.id
      and existing.form_key = v.form_key
      and existing.version = v.version
  );
