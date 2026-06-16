export type AppointmentCreatePrefill = {
  leadId: string | null;
  personId: string | null;
  patientId: string | null;
  caseId: string | null;
  bookingType: string;
  title: string | null;
  startIso: string;
  endIso: string;
  assignedUserId: string | null;
  /** `fi_staff.id` when known (scheduling). */
  assignedStaffId?: string | null;
  clinicId: string | null;
  /** Optional staff-visible notes (e.g. accepted-quote context). */
  description?: string | null;
  /** Consultation anchor for deep links in the create UI (not a DB column on `fi_bookings`). */
  consultationId?: string | null;
  /**
   * Shallow JSON merged into `fi_bookings.metadata` on create — keep small (calendar overlap reads include metadata).
   */
  initialMetadata?: Record<string, unknown> | null;
};
