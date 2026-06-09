-- Link ConsultationOS rows to calendar bookings (appointment ↔ consultation).

alter table fi_consultations
  add column if not exists booking_id uuid references fi_bookings (id) on delete set null;

create index if not exists idx_fi_consultations_booking_id on fi_consultations (booking_id);

comment on column fi_consultations.booking_id is
  'Optional link to fi_bookings when consultation started from an appointment.';
