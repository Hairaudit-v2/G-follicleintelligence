-- Room assignment on bookings + optional calendar visibility override on staff.

alter table fi_bookings
  add column if not exists room_id uuid references fi_clinic_rooms (id) on delete set null;

alter table fi_bookings
  add column if not exists room_required boolean not null default true;

create index if not exists idx_fi_bookings_tenant_room
  on fi_bookings (tenant_id, room_id)
  where room_id is not null;

comment on column fi_bookings.room_id is
  'ClinicOS: assigned clinic room. Overlap enforced by room_id and shared physical_room_key.';

comment on column fi_bookings.room_required is
  'When true (default), room_id must be set unless explicitly waived for non-room workflows.';

alter table fi_staff
  add column if not exists calendar_visible boolean;

comment on column fi_staff.calendar_visible is
  'Override calendar column visibility. Null = role-based default (exclude reception/admin unless clinical).';
