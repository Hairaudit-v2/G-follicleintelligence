-- Allow audit trail for admin access revocation (fi_tenant_admin_users row deleted; fi_users unchanged).

alter table fi_tenant_admin_audit_events
  drop constraint if exists fi_tenant_admin_audit_events_kind_chk;

alter table fi_tenant_admin_audit_events
  add constraint fi_tenant_admin_audit_events_kind_chk check (
    event_kind in (
      'admin_user.invited',
      'admin_user.role_changed',
      'admin_user.suspended',
      'admin_user.reactivated',
      'admin_user.removed'
    )
  );
