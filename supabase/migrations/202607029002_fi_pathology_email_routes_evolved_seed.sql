-- Sprint H2: idempotent Evolved pathology inbound email route seed (tenant resolved by slug).

insert into public.fi_pathology_email_routes (
  tenant_id,
  inbound_email,
  route_status,
  source_label,
  default_source_channel
)
select
  t.id,
  'pathology+evolved@inbound.follicleintelligence.com',
  'active',
  'Evolved Pathology Inbox',
  'email'
from public.fi_tenants t
where t.slug = 'evolved-hair'
  and not exists (
    select 1
    from public.fi_pathology_email_routes r
    where lower(trim(r.inbound_email)) = lower(trim('pathology+evolved@inbound.follicleintelligence.com'))
  );

comment on table public.fi_pathology_email_routes is
  'Maps dedicated pathology inbound email addresses to FI OS tenants for webhook ingestion. '
  'Update inbound_email via Configuration → Pathology email routes when production domain differs.';
