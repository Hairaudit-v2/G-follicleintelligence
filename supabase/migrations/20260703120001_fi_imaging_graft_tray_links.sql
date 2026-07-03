-- IMAGING-GRAFT-LINK-1: bridge graft_tray patient images to SurgeryOS graft counting context.
-- Writes: service role. Authenticated tenant members: SELECT (RLS).

create table if not exists public.fi_imaging_graft_tray_links (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null references public.fi_tenants (id) on delete cascade,
  patient_id uuid not null references public.fi_patients (id) on delete cascade,
  image_id uuid not null references public.fi_patient_images (id) on delete cascade,
  surgery_case_id uuid references public.fi_cases (id) on delete set null,
  surgery_id uuid references public.fi_surgeries (id) on delete set null,
  booking_id uuid references public.fi_bookings (id) on delete set null,
  graft_session_id uuid references public.fi_surgery_graft_sessions (id) on delete set null,
  graft_count_event_id uuid references public.fi_surgery_graft_count_events (id) on delete set null,
  protocol_session_id uuid references public.fi_imaging_protocol_sessions (id) on delete set null,
  protocol_slot_slug text not null default 'graft_tray',
  captured_at timestamptz not null default now(),
  captured_by_staff_id uuid references public.fi_staff (id) on delete set null,
  status text not null default 'linked',
  review_required boolean not null default false,
  mismatch_reason text,
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint fi_imaging_graft_tray_links_status_chk check (
    status in ('linked', 'review_required', 'mismatch_flagged', 'superseded')
  ),
  constraint fi_imaging_graft_tray_links_metadata_object check (jsonb_typeof (metadata) = 'object')
);

comment on table public.fi_imaging_graft_tray_links is
  'Links graft_tray protocol captures to SurgeryOS graft sessions for reconciliation evidence.';

create unique index if not exists idx_fi_imaging_graft_tray_links_image_unique
  on public.fi_imaging_graft_tray_links (tenant_id, image_id);

create index if not exists idx_fi_imaging_graft_tray_links_surgery
  on public.fi_imaging_graft_tray_links (tenant_id, surgery_id);

create index if not exists idx_fi_imaging_graft_tray_links_graft_session
  on public.fi_imaging_graft_tray_links (tenant_id, graft_session_id);

alter table public.fi_imaging_graft_tray_links enable row level security;

drop policy if exists fi_imaging_graft_tray_links_select_tenant_member
  on public.fi_imaging_graft_tray_links;

create policy fi_imaging_graft_tray_links_select_tenant_member
  on public.fi_imaging_graft_tray_links for select to authenticated
  using (
    exists (
      select 1
      from public.fi_tenant_users u
      where u.tenant_id = fi_imaging_graft_tray_links.tenant_id
        and u.user_id = auth.uid()
    )
  );

grant select on public.fi_imaging_graft_tray_links to authenticated, service_role;
grant insert, update, delete on public.fi_imaging_graft_tray_links to service_role;