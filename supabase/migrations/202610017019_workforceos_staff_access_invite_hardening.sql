-- WorkforceOS: Staff Access invite lifecycle hardening — resend tracking, token hash, PIN setup, audit events.

-- ---------------------------------------------------------------------------
-- fi_staff_login_invitations — resend + acceptance tracking
-- ---------------------------------------------------------------------------

alter table public.fi_staff_login_invitations
  add column if not exists invite_token_hash text,
  add column if not exists auth_invite_link text,
  add column if not exists accepted_at timestamptz,
  add column if not exists sent_at timestamptz,
  add column if not exists resent_at timestamptz,
  add column if not exists resend_count integer not null default 0,
  add column if not exists last_sent_by_user_id uuid,
  add column if not exists revoked_by_user_id uuid;

comment on column public.fi_staff_login_invitations.invite_token_hash is
  'SHA-256 hex hash of the raw invite token — raw token is never stored.';
comment on column public.fi_staff_login_invitations.auth_invite_link is
  'Supabase auth magic link used during acceptance; not emailed directly when app link is used.';

create index if not exists idx_fi_staff_login_invitations_token_hash
  on public.fi_staff_login_invitations (tenant_id, invite_token_hash)
  where invite_token_hash is not null;

-- ---------------------------------------------------------------------------
-- fi_staff_onboarding_invitations — resend + revocation tracking
-- ---------------------------------------------------------------------------

alter table public.fi_staff_onboarding_invitations
  add column if not exists invite_token_hash text,
  add column if not exists sent_at timestamptz,
  add column if not exists resent_at timestamptz,
  add column if not exists resend_count integer not null default 0,
  add column if not exists last_sent_by_user_id uuid,
  add column if not exists revoked_at timestamptz;

-- Backfill token hash from legacy plain-text invite_token where present.
update public.fi_staff_onboarding_invitations
set invite_token_hash = encode(sha256(invite_token::bytea), 'hex')
where invite_token_hash is null
  and invite_token is not null
  and length(trim(invite_token)) > 0;

alter table public.fi_staff_onboarding_invitations
  drop constraint if exists fi_staff_onboarding_invitations_status_chk;

alter table public.fi_staff_onboarding_invitations
  add constraint fi_staff_onboarding_invitations_status_chk check (
    status in ('pending', 'sent', 'accepted', 'expired', 'revoked')
  );

create index if not exists idx_fi_staff_onboarding_invitations_token_hash
  on public.fi_staff_onboarding_invitations (tenant_id, invite_token_hash)
  where invite_token_hash is not null;

-- ---------------------------------------------------------------------------
-- fi_staff_access_pin_setups — token-gated PIN setup for Staff Access invites
-- ---------------------------------------------------------------------------

create table if not exists public.fi_staff_access_pin_setups (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null references public.fi_tenants (id) on delete cascade,
  staff_member_id uuid not null references public.fi_staff_members (id) on delete cascade,
  fi_staff_id uuid not null references public.fi_staff (id) on delete cascade,
  login_invitation_id uuid references public.fi_staff_login_invitations (id) on delete set null,
  setup_token_hash text not null,
  status text not null default 'pending',
  expires_at timestamptz not null,
  completed_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint fi_staff_access_pin_setups_status_chk check (
    status in ('pending', 'completed', 'expired', 'revoked')
  )
);

comment on table public.fi_staff_access_pin_setups is
  'Token-gated PIN setup for Staff Access Centre login invites — staff self-service without admin.';

create index if not exists idx_fi_staff_access_pin_setups_tenant_staff
  on public.fi_staff_access_pin_setups (tenant_id, fi_staff_id);

create index if not exists idx_fi_staff_access_pin_setups_token_hash
  on public.fi_staff_access_pin_setups (tenant_id, setup_token_hash)
  where status = 'pending';

alter table public.fi_staff_access_pin_setups enable row level security;

grant select, insert, update, delete on public.fi_staff_access_pin_setups to service_role;

-- ---------------------------------------------------------------------------
-- fi_staff_member_audit_events — staff access invite lifecycle events
-- ---------------------------------------------------------------------------

alter table public.fi_staff_member_audit_events
  drop constraint if exists fi_staff_member_audit_events_event_type_chk;

alter table public.fi_staff_member_audit_events
  add constraint fi_staff_member_audit_events_event_type_chk check (
    event_type in (
      'staff_synced_from_iiohr',
      'staff_sync_updated_from_iiohr',
      'staff_profile_updated',
      'staff_archived',
      'staff_restored',
      'staff_employment_status_changed',
      'staff_hr_reconciled',
      'staff_hr_linked_manually',
      'staff_hr_link_removed',
      'staff_onboarding_created',
      'workforce_manual_identity_linked',
      'workforce_duplicate_dismissed',
      'workforce_duplicate_approved_for_merge',
      'workforce_staff_merged',
      'workforce_staff_offboarded',
      'workforce_credential_upserted',
      'workforce_certification_upserted',
      'workforce_compliance_automation_run',
      'workforce_canonical_staff_selected',
      'workforce_merge_recommendation_generated',
      'workforce_manual_review_requested',
      'workforce_reconciliation_recommendation_approved',
      'workforce_duplicate_merge_recommended',
      'workforce_iiohr_sync_completed',
      'workforce_future_bookings_unassigned_on_offboard',
      'workforce_iiohr_departure_aligned',
      'workforce_iiohr_departure_queued',
      'staff_access_invite_sent',
      'staff_access_invite_resent',
      'staff_access_invite_accepted',
      'staff_pin_setup_link_created',
      'staff_pin_reset_requested',
      'staff_pin_reset_completed'
    )
  );
