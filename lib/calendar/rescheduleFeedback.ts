import type { CalendarRescheduleResult } from "@/hooks/useCalendarAppointments";

/** User-facing toast copy for failed drag-and-drop reschedule. */
export function rescheduleErrorMessage(result: CalendarRescheduleResult): string {
  if (result.error?.trim()) return result.error.trim();
  if (result.isConflict && result.conflictingAppointmentId) {
    return "That time is not available — it overlaps another appointment.";
  }
  if (result.conflictingAppointmentId) {
    return "Scheduling conflict — this slot overlaps another appointment.";
  }
  return "Could not update appointment";
}
