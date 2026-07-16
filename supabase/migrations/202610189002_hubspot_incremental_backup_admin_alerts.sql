-- FI-HUBSPOT-BACKUP-1 Stage P3 — allow HubSpot incremental backup admin alerts.
-- Additive: expand fi_admin_notifications source check only.

alter table public.fi_admin_notifications
  drop constraint if exists fi_admin_notifications_source_chk;

alter table public.fi_admin_notifications
  add constraint fi_admin_notifications_source_chk check (
    source in (
      'google_calendar_sync',
      'google_calendar_webhook',
      'hubspot_incremental_backup'
    )
  );

comment on constraint fi_admin_notifications_source_chk on public.fi_admin_notifications is
  'Allowed FI Admin notification sources including HubSpot incremental backup ops alerts.';
