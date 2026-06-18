-- ---------------------------------------------------------------------------
-- CORRECTNESS FIX: prevent double-booking at the database layer
--
-- createBooking() (src/lib/bookings/bookings.ts) checks resource availability
-- with a SELECT (assertBookingResourceAvailability) and then performs a
-- separate INSERT. Under concurrency this is a TOCTOU race: two simultaneous
-- requests for the same room or staff member at overlapping times can both
-- pass the check and both insert. There was no DB-level constraint enforcing
-- the fi_clinic_rooms design invariant ("Labels sharing physical_room_key
-- cannot overlap in time").
--
-- This migration makes the database the source of truth via partial GiST
-- exclusion constraints. A second overlapping booking now fails with
-- SQLSTATE 23P01 (exclusion_violation) instead of silently succeeding.
--
-- Overlap semantics:
--   * tstzrange(start_at, end_at, '[)') — half-open, so a booking ending at
--     10:00 does NOT conflict with one starting at 10:00.
--   * Only "occupying" statuses are enforced; cancelled / no_show free the slot.
--   * Rooms and staff are enforced independently; NULL room/staff is exempt.
--
-- btree_gist is required for the `uuid = uuid` operator inside a GiST index.
--
-- Forward-only. Takes a brief ACCESS EXCLUSIVE lock and validates existing
-- rows on creation (DB is effectively empty at time of writing).
--
-- APPLICATION FOLLOW-UP (not in this migration): map SQLSTATE 23P01 from the
-- fi_bookings INSERT to the existing AppointmentConflictError -> HTTP 409 so a
-- lost race surfaces to the client identically to the pre-insert check.
-- ---------------------------------------------------------------------------

create extension if not exists btree_gist;

alter table public.fi_bookings
  add constraint fi_bookings_no_room_overlap
  exclude using gist (
    room_id with =,
    tstzrange(start_at, end_at, '[)') with &&
  )
  where (room_id is not null and booking_status not in ('cancelled', 'no_show'));

alter table public.fi_bookings
  add constraint fi_bookings_no_staff_overlap
  exclude using gist (
    assigned_staff_id with =,
    tstzrange(start_at, end_at, '[)') with &&
  )
  where (assigned_staff_id is not null and booking_status not in ('cancelled', 'no_show'));

comment on constraint fi_bookings_no_room_overlap on public.fi_bookings is
  'Prevents two active (non-cancelled/no_show) bookings sharing a room from '
  'overlapping in time. Half-open ranges: end == next start is allowed.';

comment on constraint fi_bookings_no_staff_overlap on public.fi_bookings is
  'Prevents two active (non-cancelled/no_show) bookings sharing an assigned '
  'staff member from overlapping in time.';
