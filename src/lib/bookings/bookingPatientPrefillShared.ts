import { defaultRangeIso } from "@/src/components/fi/bookings/bookingFormUtils";
import type { FiCrmLeadRow } from "@/src/lib/crm/types";
import type { FiBookingRow } from "./types";
import type { AppointmentCreatePrefill } from "./appointmentCreateTypes";
import { buildAppointmentCreatePrefillFromLead } from "./bookingLeadPrefillShared";
import {
  buildPatientBookingTitle,
  deriveRecommendedBookingTypeForPatient,
} from "./bookingPatientSummary";

/** Client-safe prefill from patient row + optional primary lead + bookings. */
export function buildAppointmentCreatePrefillFromPatient(opts: {
  patientId: string;
  personId: string;
  displayName?: string | null;
  primaryLead?: FiCrmLeadRow | null;
  bookings?: FiBookingRow[];
  bookingType?: string;
  startIso?: string;
  endIso?: string;
  clinicId?: string | null;
  assignedUserId?: string | null;
}): Partial<AppointmentCreatePrefill> {
  const bookings = opts.bookings ?? [];
  const def = defaultRangeIso();

  if (opts.primaryLead) {
    const fromLead = buildAppointmentCreatePrefillFromLead({
      lead: opts.primaryLead,
      bookings,
      bookingType: opts.bookingType,
      startIso: opts.startIso,
      endIso: opts.endIso,
    });
    return {
      ...fromLead,
      patientId: opts.patientId.trim(),
      personId: opts.personId.trim(),
    };
  }

  const recommended = deriveRecommendedBookingTypeForPatient({ bookings, primaryLead: null });
  const bookingType = (opts.bookingType?.trim() || recommended.bookingType).trim();

  return {
    leadId: null,
    personId: opts.personId.trim(),
    patientId: opts.patientId.trim(),
    caseId: null,
    bookingType,
    title: buildPatientBookingTitle(bookingType, opts.displayName),
    startIso: opts.startIso ?? def.start,
    endIso: opts.endIso ?? def.end,
    assignedUserId: opts.assignedUserId ?? null,
    clinicId: opts.clinicId ?? null,
  };
}
