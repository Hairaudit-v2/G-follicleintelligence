/**
 * Column projection for FI calendar overlap reads ({@link loadBookingsForCalendarOverlap}).
 * Kept in a non-`server-only` module so unit tests can assert the contract without importing `bookings.ts`.
 */
export const FI_BOOKINGS_CALENDAR_OVERLAP_SELECT =
  "id, tenant_id, lead_id, person_id, patient_id, case_id, clinic_id, room_id, room_required, assigned_staff_id, assigned_user_id, booking_type, booking_status, title, description, start_at, end_at, timezone, location, metadata, cancelled_at, cancelled_by_user_id, cancellation_reason";
