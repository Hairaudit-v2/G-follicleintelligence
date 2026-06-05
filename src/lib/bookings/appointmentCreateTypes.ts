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
};
