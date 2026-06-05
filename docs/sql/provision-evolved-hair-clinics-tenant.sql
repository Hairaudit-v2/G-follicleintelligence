-- =============================================================================
-- Evolved Hair Clinics — repeatable tenant provision (staging / prod / SQL editor)
-- =============================================================================
-- Org display name: public.fi_tenants.name (there is no separate org_name column).
-- Branding + timezone: public.fi_tenant_settings (one row per tenant_id).
--
-- Idempotent:
--   - Tenant: upsert by slug
--   - Settings: upsert by tenant_id
--   - CRM stages: insert default hair_restoration_default set only when none exist
--   - Reminder templates: insert three starters only when tenant has zero templates
--   - fi_users: insert seed CRM operators only when that email is not already present
--
-- Run as a role that bypasses RLS (e.g. postgres / supabase_admin), or via Supabase SQL Editor.
-- =============================================================================

begin;

-- ---------------------------------------------------------------------------
-- 1) Tenant row (canonical slug: evolved)
-- ---------------------------------------------------------------------------
insert into public.fi_tenants (name, slug)
values ('Evolved Hair Clinics', 'evolved')
on conflict (slug) do update
  set name = excluded.name,
      updated_at = now();

-- ---------------------------------------------------------------------------
-- 2) Tenant settings — Australia/Perth + Clinic OS branding colours
-- ---------------------------------------------------------------------------
insert into public.fi_tenant_settings (
  tenant_id,
  brand_name,
  default_timezone,
  primary_colour,
  secondary_colour,
  accent_colour,
  support_email
)
select
  t.id,
  'Evolved Hair Clinics',
  'Australia/Perth',
  '#0c4a6e',
  '#075985',
  '#0ea5e9',
  'hello@evolvedhair.com.au'
from public.fi_tenants t
where t.slug = 'evolved'
on conflict (tenant_id) do update set
  brand_name = excluded.brand_name,
  default_timezone = excluded.default_timezone,
  primary_colour = excluded.primary_colour,
  secondary_colour = excluded.secondary_colour,
  accent_colour = excluded.accent_colour,
  support_email = excluded.support_email,
  updated_at = now();

-- ---------------------------------------------------------------------------
-- 3) Default CRM pipeline stages (tenant-wide hair_restoration_default)
-- ---------------------------------------------------------------------------
insert into public.fi_crm_pipeline_stages (
  tenant_id,
  organisation_id,
  clinic_id,
  pipeline_key,
  slug,
  label,
  sort_order,
  is_entry,
  is_won,
  is_lost,
  metadata
)
select
  t.id,
  null,
  null,
  'hair_restoration_default',
  v.slug,
  v.label,
  v.sort_order,
  v.is_entry,
  v.is_won,
  v.is_lost,
  jsonb_build_object('seed', 'fi_crm_default_hair_restoration', 'slug', v.slug)
from public.fi_tenants t
cross join (
  values
    ('new', 'New inquiry', 0, true, false, false),
    ('contacted', 'Contacted', 10, false, false, false),
    ('qualified', 'Qualified', 20, false, false, false),
    ('consult_scheduled', 'Consult scheduled', 30, false, false, false),
    ('consult_completed', 'Consult completed', 40, false, false, false),
    ('treatment_planning', 'Treatment planning', 50, false, false, false),
    ('quote_sent', 'Quote sent', 60, false, false, false),
    ('deposit_or_booked', 'Deposit / booked', 70, false, false, false),
    ('in_treatment', 'In treatment', 80, false, false, false),
    ('won_closed', 'Won / completed', 90, false, true, false),
    ('lost', 'Lost', 100, false, false, true),
    ('nurture', 'Nurture', 110, false, false, false)
) as v(slug, label, sort_order, is_entry, is_won, is_lost)
where t.slug = 'evolved'
  and not exists (
    select 1
    from public.fi_crm_pipeline_stages s
    where s.tenant_id = t.id
      and s.organisation_id is null
      and s.clinic_id is null
      and s.pipeline_key = 'hair_restoration_default'
  );

-- ---------------------------------------------------------------------------
-- 4) Reminder templates (24h confirm, 48h, post-consult) — email only
-- ---------------------------------------------------------------------------
insert into public.fi_reminder_templates (
  tenant_id,
  name,
  type,
  trigger_event,
  subject,
  body,
  is_active,
  metadata
)
select
  t.id,
  v.name,
  v.type,
  v.trigger_event,
  v.subject,
  v.body,
  true,
  '{}'::jsonb
from public.fi_tenants t
cross join (
  values
    (
      '24h appointment confirmation (email)',
      'email',
      'booking_24h_before',
      'Tomorrow: your appointment at {{clinic_name}}',
      'Hi {{patient_name}}, this confirms your appointment tomorrow at {{booking_time}} at {{clinic_name}}. Reply if you need to reschedule.'
    ),
    (
      '48h reminder (email)',
      'email',
      'booking_48h_before',
      'Reminder: appointment in 48 hours',
      'Hi {{patient_name}}, a quick reminder about your appointment at {{booking_time}} at {{clinic_name}} (in about 48 hours).'
    ),
    (
      'Post-consult follow-up (email)',
      'email',
      'post_consult',
      'After your consultation',
      'Hi {{patient_name}}, thank you for visiting {{clinic_name}}. If you have any questions after your consultation, reply to this email.'
    )
) as v(name, type, trigger_event, subject, body)
where t.slug = 'evolved'
  and not exists (
    select 1 from public.fi_reminder_templates r where r.tenant_id = t.id
  );

-- ---------------------------------------------------------------------------
-- 5) Seed CRM operators (link auth_user_id after creating Supabase Auth users)
-- ---------------------------------------------------------------------------
insert into public.fi_users (tenant_id, email, role, auth_user_id)
select t.id, v.email, v.role, null
from public.fi_tenants t
cross join (
  values
    ('evolved.crm.seed1@follicleintelligence.local', 'crm_operator'),
    ('evolved.crm.seed2@follicleintelligence.local', 'crm_operator'),
    ('evolved.crm.seed3@follicleintelligence.local', 'crm_operator')
) as v(email, role)
where t.slug = 'evolved'
  and not exists (
    select 1 from public.fi_users u where u.tenant_id = t.id and u.email = v.email
  );

commit;

-- Verify (optional):
-- select id, name, slug from fi_tenants where slug = 'evolved';
-- select * from fi_tenant_settings where tenant_id = (select id from fi_tenants where slug = 'evolved');
-- select slug, label, sort_order from fi_crm_pipeline_stages where tenant_id = (select id from fi_tenants where slug = 'evolved') order by sort_order;
-- select name, trigger_event from fi_reminder_templates where tenant_id = (select id from fi_tenants where slug = 'evolved');
-- select email, role, auth_user_id from fi_users where tenant_id = (select id from fi_tenants where slug = 'evolved') order by email;
