-- FI-BRANDING-SYSTEM-1 — private bucket for tenant logo uploads (service-role reads/writes).

insert into
  storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values (
    'tenant-branding',
    'tenant-branding',
    false,
    2097152,
    array[
      'image/jpeg',
      'image/png',
      'image/webp',
      'image/svg+xml'
    ]::text[]
  )
on conflict (id) do update
set
  public = excluded.public,
  file_size_limit = excluded.file_size_limit,
  allowed_mime_types = excluded.allowed_mime_types;

-- Audit trail: tenant branding changes.
alter table fi_tenant_admin_audit_events
  drop constraint if exists fi_tenant_admin_audit_events_kind_chk;

alter table fi_tenant_admin_audit_events
  add constraint fi_tenant_admin_audit_events_kind_chk check (
    event_kind in (
      'admin_user.invited',
      'admin_user.role_changed',
      'admin_user.suspended',
      'admin_user.reactivated',
      'admin_user.removed',
      'settings.branding_updated'
    )
  );
