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
  clinicId: string | null;
};
