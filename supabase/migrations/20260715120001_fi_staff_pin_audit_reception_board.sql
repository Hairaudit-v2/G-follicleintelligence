-- Allow staff PIN audit trail to record Reception Board flow actions (no raw PIN values).

alter table fi_staff_pin_audit_events drop constraint if exists fi_staff_pin_audit_events_kind_chk;

alter table fi_staff_pin_audit_events
  add constraint fi_staff_pin_audit_events_kind_chk check (
    event_kind in (
      'staff_pin.login_success',
      'staff_pin.login_failed',
      'staff_pin.locked',
      'staff_pin.set',
      'staff_pin.reset',
      'staff_pin.disabled',
      'staff_pin.logout',
      'staff_pin.reception_board_action'
    )
  );
