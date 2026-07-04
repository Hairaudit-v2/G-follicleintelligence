-- WorkforceOS — harden roster manual adjustment RPC and audit RLS (follow-up to 20261005170001).

revoke all on function public.fi_clear_generated_roster_shifts(uuid, timestamptz, timestamptz, uuid, text) from public;
revoke all on function public.fi_clear_generated_roster_shifts(uuid, timestamptz, timestamptz, uuid, text) from anon;
revoke all on function public.fi_clear_generated_roster_shifts(uuid, timestamptz, timestamptz, uuid, text) from authenticated;
grant execute on function public.fi_clear_generated_roster_shifts(uuid, timestamptz, timestamptz, uuid, text) to service_role;

drop policy if exists fi_roster_shift_audit_events_select_tenant_member on public.fi_roster_shift_audit_events;
create policy fi_roster_shift_audit_events_select_tenant_member
  on public.fi_roster_shift_audit_events
  for select
  to authenticated
  using (
    exists (
      select 1
      from public.fi_users u
      where u.auth_user_id = auth.uid()
        and u.tenant_id = fi_roster_shift_audit_events.tenant_id
    )
  );

grant select on public.fi_roster_shift_audit_events to authenticated;
