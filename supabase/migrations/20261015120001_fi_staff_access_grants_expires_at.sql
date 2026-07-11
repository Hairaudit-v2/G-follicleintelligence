-- D6G-G0B: optional expiry on staff access grants (capability overrides).
-- Expired grants are ignored by computeEffectiveAccess the same way revoked grants are.

alter table public.fi_staff_access_grants
  add column if not exists expires_at timestamptz;

comment on column public.fi_staff_access_grants.expires_at is
  'When set, the grant is ignored after this timestamp (same as revoked for effective access).';

create index if not exists idx_fi_staff_access_grants_expires_at
  on public.fi_staff_access_grants (expires_at)
  where expires_at is not null and revoked_at is null;
