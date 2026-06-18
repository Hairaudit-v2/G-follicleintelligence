-- Allow consultation-variant booking_type values derived from fi_services when booking_type is null.

alter table public.fi_bookings drop constraint if exists fi_bookings_booking_type_check;

alter table public.fi_bookings add constraint fi_bookings_booking_type_check check (
  booking_type in (
    'consultation',
    'hair_transplant_consultation',
    'trichology',
    'beard_transplant_consultation',
    'eyebrow_transplant_consultation',
    'prp',
    'prf',
    'mesotherapy',
    'exosomes',
    'surgery',
    'review',
    'follow_up',
    'other'
  )
);

alter table public.fi_services drop constraint if exists fi_services_booking_type_check;

alter table public.fi_services add constraint fi_services_booking_type_check check (
  booking_type is null
  or booking_type in (
    'consultation',
    'hair_transplant_consultation',
    'trichology',
    'beard_transplant_consultation',
    'eyebrow_transplant_consultation',
    'prp',
    'prf',
    'mesotherapy',
    'exosomes',
    'surgery',
    'review',
    'follow_up',
    'other'
  )
);
