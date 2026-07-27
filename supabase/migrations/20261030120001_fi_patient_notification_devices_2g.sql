-- FI-PATIENT-APP-2G — Patient notification devices + push dispatch dedupe.
-- Provider-neutral device registry (Expo/FCM/APNs). Tokens are sensitive; service-role writes only.

create table if not exists public.fi_patient_notification_devices (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null references public.fi_tenants (id) on delete cascade,
  patient_id uuid not null references public.fi_patients (id) on delete cascade,
  platform text not null
    check (platform in ('android', 'ios', 'web')),
  provider text not null
    check (provider in ('expo', 'fcm', 'apns')),
  provider_token text not null,
  token_fingerprint text not null,
  device_label text,
  app_version text,
  environment text not null default 'production'
    check (environment in ('development', 'preview', 'production')),
  created_at timestamptz not null default now(),
  last_seen_at timestamptz not null default now(),
  disabled_at timestamptz,
  metadata jsonb not null default '{}'::jsonb,
  constraint fi_patient_notification_devices_metadata_object
    check (jsonb_typeof (metadata) = 'object'),
  constraint fi_patient_notification_devices_token_nonempty
    check (char_length(trim(provider_token)) > 0),
  constraint fi_patient_notification_devices_fp_nonempty
    check (char_length(trim(token_fingerprint)) = 64)
);

comment on table public.fi_patient_notification_devices is
  'FI-PATIENT-APP-2G: provider-neutral patient push device registry. Tokens are secrets.';

-- One active registration per provider token fingerprint (reassignment disables prior owners).
create unique index if not exists uq_fi_patient_notif_devices_active_fp
  on public.fi_patient_notification_devices (provider, token_fingerprint)
  where disabled_at is null;

create index if not exists idx_fi_patient_notif_devices_patient_active
  on public.fi_patient_notification_devices (tenant_id, patient_id, last_seen_at desc)
  where disabled_at is null;

create table if not exists public.fi_patient_notification_dispatch_log (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null references public.fi_tenants (id) on delete cascade,
  patient_id uuid not null references public.fi_patients (id) on delete cascade,
  event_type text not null,
  channel text not null
    check (channel in ('email', 'sms', 'push')),
  dedupe_key text not null,
  status text not null
    check (status in ('sent', 'skipped', 'failed')),
  skip_reason text,
  created_at timestamptz not null default now(),
  metadata jsonb not null default '{}'::jsonb,
  constraint fi_patient_notification_dispatch_log_metadata_object
    check (jsonb_typeof (metadata) = 'object'),
  constraint fi_patient_notification_dispatch_log_dedupe_nonempty
    check (char_length(trim(dedupe_key)) > 0)
);

comment on table public.fi_patient_notification_dispatch_log is
  'FI-PATIENT-APP-2G: bounded push/email/sms dispatch dedupe ledger (no PHI/tokens).';

create unique index if not exists uq_fi_patient_notif_dispatch_dedupe
  on public.fi_patient_notification_dispatch_log (tenant_id, patient_id, channel, dedupe_key);

create index if not exists idx_fi_patient_notif_dispatch_patient
  on public.fi_patient_notification_dispatch_log (tenant_id, patient_id, created_at desc);

alter table public.fi_patient_notification_devices enable row level security;
alter table public.fi_patient_notification_dispatch_log enable row level security;

-- No authenticated client policies — patient gateway uses service role after gate.
grant select, insert, update, delete on public.fi_patient_notification_devices to service_role;
grant select, insert, update, delete on public.fi_patient_notification_dispatch_log to service_role;
