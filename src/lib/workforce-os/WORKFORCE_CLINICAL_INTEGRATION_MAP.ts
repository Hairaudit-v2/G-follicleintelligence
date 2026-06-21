/**
 * WorkforceOS Phase 2D — SurgeryOS / ClinicOS integration map.
 *
 * Canonical operational entities
 * - fi_bookings — calendar appointments; primary assignee via assigned_staff_id
 * - fi_booking_resource_assignments — multi-staff / room requirements (SurgeryOS)
 * - fi_surgeries — live theatre events (future surgery bridge via event_source=surgery)
 *
 * WorkforceOS Phase 2C entities
 * - fi_clinical_staffing_templates — required roles by event_type
 * - fi_staff_event_assignments — readiness-aware assignments with snapshots
 *
 * Event identity
 * - Booking: { eventSource: "booking", eventId: booking.id, eventType: resolveWorkforceEventTypeFromBooking(booking) }
 * - Surgery: { eventSource: "surgery", eventId: surgery.id, eventType: resolveWorkforceEventTypeFromSurgery(surgery) }
 *
 * Loader surfaces wired in Phase 2D
 * - Surgery readiness board (`surgeryReadinessBoardLoader.server.ts`)
 * - Procedure day board (`procedureDayBoardLoader.server.ts`)
 * - Tomorrow board (`tomorrowBoardLoader.server.ts`)
 * - Operational calendar (`operationalCalendarLoader.server.ts` → drawer)
 * - Appointment detail / slide-over (`appointmentSlideOverLoader.ts`)
 *
 * Assignment bridge
 * - `workforceEventAssignmentBridge.server.ts` syncs assigned_staff_id + resource staff → fi_staff_event_assignments
 * - Booking mutations call bridge after create/update; cancel soft-cancels workforce assignments
 *
 * Backward compatibility
 * - assigned_staff_id remains calendar column source of truth
 * - fi_users-based surgery/case team fields unchanged
 * - No auto-assignment without existing booking staff or admin action
 */

export const WORKFORCE_CLINICAL_INTEGRATION_MAP_VERSION = "2d";
