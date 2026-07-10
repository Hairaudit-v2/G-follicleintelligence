-- Clinic templates catalog expansion:
-- 1) Booking/lifecycle + invoice payment reminder triggers on fi_reminder_templates
-- 2) Additional reception commercial message keys
-- 3) fi_document_templates for sales T&Cs, invoice terms, policies

-- ---------------------------------------------------------------------------
-- Reminder triggers (booking lifecycle + invoice payment)
-- ---------------------------------------------------------------------------
alter table public.fi_reminder_templates
  drop constraint if exists fi_reminder_templates_trigger_check;

alter table public.fi_reminder_templates
  add constraint fi_reminder_templates_trigger_check check (
    trigger_event in (
      'booking_created',
      'booking_48h_before',
      'booking_24h_before',
      'booking_48h',
      'booking_24h',
      'booking_same_day',
      'booking_cancelled',
      'booking_rescheduled',
      'post_consult',
      'lead_created',
      'invoice_deposit_reminder',
      'invoice_balance_reminder',
      'invoice_due_reminder',
      'invoice_overdue_reminder',
      'invoice_paid_receipt'
    )
  );

comment on column public.fi_reminder_templates.trigger_event is
  'Scheduling/send trigger. Booking offsets auto-enqueue when wired; invoice_* keys are tenant-editable copy for payment reminder / AR flows.';

-- ---------------------------------------------------------------------------
-- Reception communication template keys
-- ---------------------------------------------------------------------------
alter table public.fi_reception_communication_templates
  drop constraint if exists fi_reception_communication_templates_template_key_check;

-- Constraint may have been inline on column; drop via table check name variants
do $$
declare
  cname text;
begin
  for cname in
    select con.conname
    from pg_constraint con
    join pg_class rel on rel.oid = con.conrelid
    join pg_namespace nsp on nsp.oid = rel.relnamespace
    where nsp.nspname = 'public'
      and rel.relname = 'fi_reception_communication_templates'
      and con.contype = 'c'
      and pg_get_constraintdef(con.oid) ilike '%template_key%'
  loop
    execute format('alter table public.fi_reception_communication_templates drop constraint %I', cname);
  end loop;
end $$;

alter table public.fi_reception_communication_templates
  add constraint fi_reception_communication_templates_template_key_check check (
    template_key in (
      'quote_follow_up',
      'deposit_reminder',
      'surgery_readiness',
      'consultation_no_show',
      'cold_lead_reactivation',
      'payment_link_follow_up',
      'appointment_reminder',
      'invoice_payment_reminder',
      'invoice_overdue',
      'balance_due_reminder',
      'sales_terms_send',
      'booking_confirmation',
      'booking_cancellation',
      'post_payment_thank_you'
    )
  );

-- ---------------------------------------------------------------------------
-- Document templates (sales T&Cs, invoice terms, policies)
-- ---------------------------------------------------------------------------
create table if not exists public.fi_document_templates (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null references public.fi_tenants (id) on delete cascade,
  category text not null,
  slug text not null,
  name text not null,
  body text not null,
  is_default boolean not null default false,
  is_active boolean not null default true,
  version integer not null default 1,
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint fi_document_templates_category_chk check (
    category in (
      'sales_terms',
      'invoice_terms',
      'invoice_footer',
      'booking_policy',
      'payment_policy',
      'consent_summary',
      'custom'
    )
  ),
  constraint fi_document_templates_slug_nonempty check (char_length(trim(slug)) > 0),
  constraint fi_document_templates_name_nonempty check (char_length(trim(name)) > 0),
  constraint fi_document_templates_body_nonempty check (char_length(trim(body)) > 0),
  constraint fi_document_templates_version_positive check (version >= 1),
  constraint fi_document_templates_metadata_object check (jsonb_typeof(metadata) = 'object'),
  constraint fi_document_templates_tenant_category_slug_unique unique (tenant_id, category, slug)
);

comment on table public.fi_document_templates is
  'Tenant-editable document copy: sales T&Cs, invoice terms/footers, booking/payment policies.';

create index if not exists idx_fi_document_templates_tenant
  on public.fi_document_templates (tenant_id);

create index if not exists idx_fi_document_templates_tenant_category
  on public.fi_document_templates (tenant_id, category)
  where is_active = true;

alter table public.fi_document_templates enable row level security;

drop policy if exists fi_document_templates_select_tenant_member on public.fi_document_templates;
create policy fi_document_templates_select_tenant_member
  on public.fi_document_templates for select to authenticated
  using (
    exists (
      select 1 from public.fi_users u
      where u.auth_user_id = auth.uid()
        and u.tenant_id = fi_document_templates.tenant_id
    )
  );

grant select on public.fi_document_templates to authenticated, service_role;
grant insert, update, delete on public.fi_document_templates to service_role;

create or replace function public.fi_document_templates_set_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

drop trigger if exists trg_fi_document_templates_set_updated_at on public.fi_document_templates;
create trigger trg_fi_document_templates_set_updated_at
  before update on public.fi_document_templates
  for each row
  execute procedure public.fi_document_templates_set_updated_at();
