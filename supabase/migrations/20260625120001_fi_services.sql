-- Tenant procedure / service catalog for booking durations, pricing hints, and calendar colours.

create table if not exists fi_services (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null references fi_tenants (id) on delete cascade,
  name text not null,
  duration_minutes int not null,
  base_price numeric(12, 2) not null default 0,
  color text,
  category text,
  is_active boolean not null default true,
  /** When set, maps this catalog row to `fi_bookings.booking_type` (one active definition per type per tenant). */
  booking_type text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint fi_services_duration_positive check (duration_minutes > 0 and duration_minutes <= 1440),
  constraint fi_services_name_nonempty check (char_length(trim(name)) > 0),
  constraint fi_services_booking_type_check check (
    booking_type is null
    or booking_type in (
      'consultation',
      'prp',
      'prf',
      'mesotherapy',
      'exosomes',
      'surgery',
      'review',
      'follow_up',
      'other'
    )
  ),
  constraint fi_services_color_hex check (
    color is null
    or (
      char_length(color) <= 32
      and color ~* '^#[0-9a-f]{3}([0-9a-f]{3})?$'
    )
  )
);

comment on table fi_services is
  'Follicle Intelligence: tenant-scoped service / procedure catalog (duration, price, colour) for bookings and calendar.';

create index if not exists idx_fi_services_tenant_active on fi_services (tenant_id, is_active);
create index if not exists idx_fi_services_tenant_category on fi_services (tenant_id, category);

create unique index if not exists idx_fi_services_tenant_booking_type_unique
  on fi_services (tenant_id, booking_type)
  where booking_type is not null;

alter table fi_services enable row level security;

drop policy if exists fi_services_select_tenant_member on fi_services;
create policy fi_services_select_tenant_member
  on fi_services for select to authenticated
  using (
    exists (
      select 1 from fi_users u
      where u.auth_user_id = auth.uid()
        and u.tenant_id = fi_services.tenant_id
    )
  );

grant select on fi_services to authenticated, service_role;
grant insert, update, delete on fi_services to service_role;
