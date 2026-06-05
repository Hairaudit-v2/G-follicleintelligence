-- Reminder templates + job queue (tenant-scoped). Mutations via service_role; tenant members SELECT.
-- Patient consent fields on fi_patients for booking reminder enqueue.

-- ---------------------------------------------------------------------------
-- Patient consent (nullable preferred channel)
-- ---------------------------------------------------------------------------
alter table fi_patients add column if not exists reminder_consent boolean not null default false;

alter table fi_patients add column if not exists preferred_contact_method text;

alter table fi_patients drop constraint if exists fi_patients_preferred_contact_method_check;

alter table fi_patients
  add constraint fi_patients_preferred_contact_method_check check (
    preferred_contact_method is null
    or preferred_contact_method in ('email', 'sms', 'both')
  );

comment on column fi_patients.reminder_consent is
  'When true, automated reminders (email/SMS) may be enqueued for this patient''s bookings if templates exist.';
comment on column fi_patients.preferred_contact_method is
  'Optional channel filter for reminders: email, sms, or both; null means no preference (all allowed).';

-- ---------------------------------------------------------------------------
-- Templates
-- ---------------------------------------------------------------------------
create table if not exists fi_reminder_templates (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null references fi_tenants (id) on delete cascade,
  name text not null,
  type text not null,
  trigger_event text not null,
  subject text,
  body text not null,
  is_active boolean not null default true,
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint fi_reminder_templates_type_check check (type in ('sms', 'email')),
  constraint fi_reminder_templates_trigger_check check (
    trigger_event in (
      'booking_created',
      'booking_48h_before',
      'booking_24h_before',
      'lead_created'
    )
  ),
  constraint fi_reminder_templates_metadata_object check (jsonb_typeof(metadata) = 'object'),
  constraint fi_reminder_templates_name_nonempty check (char_length(trim(name)) > 0),
  constraint fi_reminder_templates_body_nonempty check (char_length(trim(body)) > 0)
);

comment on table fi_reminder_templates is
  'FI: per-tenant reminder templates (SMS/email) with merge fields and trigger_event scheduling rules.';

create index if not exists idx_fi_reminder_templates_tenant on fi_reminder_templates (tenant_id);
create index if not exists idx_fi_reminder_templates_tenant_active on fi_reminder_templates (tenant_id, is_active)
  where is_active = true;

alter table fi_reminder_templates enable row level security;

create policy fi_reminder_templates_select_tenant_member
  on fi_reminder_templates for select to authenticated
  using (
    exists (
      select 1 from fi_users u
      where u.auth_user_id = auth.uid()
        and u.tenant_id = fi_reminder_templates.tenant_id
    )
  );

grant select on fi_reminder_templates to authenticated, service_role;
grant insert, update, delete on fi_reminder_templates to service_role;

-- ---------------------------------------------------------------------------
-- Jobs queue
-- ---------------------------------------------------------------------------
create table if not exists fi_reminder_jobs (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null references fi_tenants (id) on delete cascade,
  template_id uuid not null references fi_reminder_templates (id) on delete cascade,
  booking_id uuid references fi_bookings (id) on delete cascade,
  person_id uuid references fi_persons (id) on delete set null,
  lead_id uuid references fi_crm_leads (id) on delete set null,
  scheduled_at timestamptz not null,
  status text not null default 'pending',
  attempt_count integer not null default 0,
  last_attempt_at timestamptz,
  delivered_at timestamptz,
  error text,
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint fi_reminder_jobs_status_check check (
    status in ('pending', 'processing', 'sent', 'failed')
  ),
  constraint fi_reminder_jobs_metadata_object check (jsonb_typeof(metadata) = 'object'),
  constraint fi_reminder_jobs_anchor_check check (
    booking_id is not null
    or person_id is not null
    or lead_id is not null
  ),
  constraint fi_reminder_jobs_attempt_nonnegative check (attempt_count >= 0)
);

comment on table fi_reminder_jobs is
  'FI: queued reminder deliveries; processed by cron/API using service role.';

create index if not exists idx_fi_reminder_jobs_tenant_sched on fi_reminder_jobs (tenant_id, scheduled_at);
create index if not exists idx_fi_reminder_jobs_due_pending
  on fi_reminder_jobs (status, scheduled_at)
  where status = 'pending';

create index if not exists idx_fi_reminder_jobs_booking on fi_reminder_jobs (tenant_id, booking_id)
  where booking_id is not null;

alter table fi_reminder_jobs enable row level security;

create policy fi_reminder_jobs_select_tenant_member
  on fi_reminder_jobs for select to authenticated
  using (
    exists (
      select 1 from fi_users u
      where u.auth_user_id = auth.uid()
        and u.tenant_id = fi_reminder_jobs.tenant_id
    )
  );

grant select on fi_reminder_jobs to authenticated, service_role;
grant insert, update, delete on fi_reminder_jobs to service_role;
