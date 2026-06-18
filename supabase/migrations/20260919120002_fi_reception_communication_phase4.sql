-- ReceptionOS Phase 4: communication templates + task audit communication_sent event.

-- ---------------------------------------------------------------------------
-- fi_reception_communication_templates (tenant-scoped; defaults seeded in app)
-- ---------------------------------------------------------------------------
create table if not exists public.fi_reception_communication_templates (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null references public.fi_tenants (id) on delete cascade,
  template_key text not null
    check (template_key in (
      'quote_follow_up',
      'deposit_reminder',
      'surgery_readiness',
      'consultation_no_show',
      'cold_lead_reactivation',
      'payment_link_follow_up',
      'appointment_reminder'
    )),
  sms_body text,
  email_subject text,
  email_body text,
  is_active boolean not null default true,
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint fi_reception_communication_templates_metadata_object check (jsonb_typeof (metadata) = 'object')
);

comment on table public.fi_reception_communication_templates is
  'ReceptionOS Phase 4: per-tenant SMS/email templates with merge variables for front-desk actions.';

create unique index if not exists idx_fi_reception_comm_templates_tenant_key
  on public.fi_reception_communication_templates (tenant_id, template_key);

create index if not exists idx_fi_reception_comm_templates_tenant
  on public.fi_reception_communication_templates (tenant_id);

alter table public.fi_reception_communication_templates enable row level security;

drop policy if exists fi_reception_comm_templates_select_tenant_member on public.fi_reception_communication_templates;
create policy fi_reception_comm_templates_select_tenant_member
  on public.fi_reception_communication_templates for select to authenticated
  using (
    exists (
      select 1 from public.fi_users u
      where u.auth_user_id = auth.uid()
        and u.tenant_id = fi_reception_communication_templates.tenant_id
    )
  );

grant select on public.fi_reception_communication_templates to authenticated, service_role;
grant insert, update, delete on public.fi_reception_communication_templates to service_role;

create or replace function public.fi_reception_communication_templates_set_updated_at()
returns trigger as $$
begin
  new.updated_at = now();
  return new;
end;
$$ language plpgsql;

drop trigger if exists trg_fi_reception_communication_templates_set_updated_at on public.fi_reception_communication_templates;
create trigger trg_fi_reception_communication_templates_set_updated_at
  before update on public.fi_reception_communication_templates
  for each row
  execute procedure public.fi_reception_communication_templates_set_updated_at();

-- ---------------------------------------------------------------------------
-- Extend reception task audit event kinds
-- ---------------------------------------------------------------------------
alter table public.fi_reception_task_audit_events
  drop constraint if exists fi_reception_task_audit_events_event_kind_check;

alter table public.fi_reception_task_audit_events
  add constraint fi_reception_task_audit_events_event_kind_check
  check (event_kind in (
    'created',
    'assigned',
    'snoozed',
    'status_changed',
    'resolved',
    'dismissed',
    'note_added',
    'communication_sent'
  ));
