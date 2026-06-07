/**
 * Typed booking / appointment errors for HTTP routes and server actions.
 */

export class AppointmentConflictError extends Error {
  readonly conflictingBookingId: string | null;

  constructor(message: string, conflictingBookingId: string | null) {
    super(message);
    this.name = "AppointmentConflictError";
    this.conflictingBookingId = conflictingBookingId;
  }
}

/** Working-hours or staff scheduling guard (Stage Calendar 2B). */
export class AppointmentStaffHoursError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "AppointmentStaffHoursError";
  }
}
