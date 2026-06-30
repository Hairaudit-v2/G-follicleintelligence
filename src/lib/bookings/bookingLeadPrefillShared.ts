import { defaultRangeIso } from "@/src/components/fi/bookings/bookingFormUtils";
import type { FiCrmLeadRow } from "@/src/lib/crm/types";
import type { FiBookingRow } from "./types";
import type { AppointmentCreatePrefill } from "./appointmentCreateTypes";
import { deriveRecommendedBookingTypeForLead } from "./bookingLeadSummary";
import { bookingTypeLabel } from "./operatorBookingLabels";

/** Client-safe prefill from lead row + bookings (no extra server fetch). */
export function buildAppointmentCreatePrefillFromLead(opts: {
  lead: FiCrmLeadRow;
  bookings?: FiBookingRow[];
  bookingType?: string;
  startIso?: string;
  endIso?: string;
}): Partial<AppointmentCreatePrefill> {
  const def = defaultRangeIso();
  const bookings = opts.bookings ?? [];
  const recommended = deriveRecommendedBookingTypeForLead({ lead: opts.lead, bookings });
  const bookingType = (opts.bookingType?.trim() || recommended.bookingType).trim();
  const summary = opts.lead.summary?.trim();
  const title = summary
    ? `${bookingTypeLabel(bookingType)} — ${summary}`
    : bookingTypeLabel(bookingType);

  return {
    leadId: opts.lead.id,
    personId: opts.lead.person_id,
    patientId: opts.lead.patient_id,
    caseId: opts.lead.case_id,
    bookingType,
    title,
    startIso: opts.startIso ?? def.start,
    endIso: opts.endIso ?? def.end,
    assignedUserId: opts.lead.primary_owner_user_id,
    clinicId: opts.lead.clinic_id,
  };
}
