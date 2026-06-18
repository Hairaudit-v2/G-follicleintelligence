-- P0 hardening: atomic booking mapping claim.
-- Timely booking creation previously did check-then-act (read mapping → create booking → insert
-- mapping). Under parallel Zapier delivery two bookings could be created and only one mapped,
-- leaving an orphan phantom appointment.
--
-- The fix claims the external mapping FIRST via INSERT ... ON CONFLICT DO NOTHING (guarded by the
-- existing unique constraint fi_external_entity_mappings_unique_external) and backfills internal_id
-- only after the booking row is created. That requires internal_id to be transiently NULL while a
-- claim is held, so we drop the NOT NULL constraint.
--
-- internal_id is NULL only for an in-flight booking claim; every settled mapping still carries the
-- internal FI UUID.

alter table fi_external_entity_mappings
  alter column internal_id drop not null;

comment on column fi_external_entity_mappings.internal_id is
  'Internal FI UUID for the mapped entity. NULL only transiently while a booking mapping is claimed but its internal row is still being created (claim-first idempotency).';
