/**
 * FI-CALENDAR-CONVERSION-UX-1B — pure UX contracts for guided external conversion.
 *
 * Keeps operational language in the primary flow; technical identity state stays diagnostic-only.
 */

import type { CalendarAppointmentCapabilitySet } from "@/src/lib/calendar/calendarAppointmentCapabilities";
import { calendarCapabilitySatisfies } from "@/src/lib/calendar/calendarAppointmentCapabilities";
import { isStaffBookableForClinicalWorkflow } from "@/src/lib/staff/staffRolePolicy";

export const EXTERNAL_CONVERSION_WIZARD_STEPS = [
  { id: 1, key: "patient", label: "Patient" },
  { id: 2, key: "clinic", label: "Clinic" },
  { id: 3, key: "staff_room", label: "Staff and room" },
  { id: 4, key: "details", label: "Appointment details" },
  { id: 5, key: "review", label: "Review and create" },
] as const;

export type ExternalConversionStepId = (typeof EXTERNAL_CONVERSION_WIZARD_STEPS)[number]["id"];

/** Operator-facing identity search result (never UUID-first). */
export type ExternalIdentityResultState =
  | "existing_patient_found"
  | "existing_consultation_found"
  | "possible_match_found"
  | "no_fios_record_found"
  | "identity_conflict";

export const EXTERNAL_IDENTITY_RESULT_LABELS: Record<ExternalIdentityResultState, string> = {
  existing_patient_found: "Existing patient found",
  existing_consultation_found: "Existing consultation found",
  possible_match_found: "Possible match found",
  no_fios_record_found: "No FiOS record found",
  identity_conflict: "Identity conflict",
};

/** Primary patient actions — operational language only. */
export type PatientIdentityAction =
  | "link_existing_patient"
  | "link_existing_enquiry_or_consultation"
  | "create_new_patient";

export const PATIENT_IDENTITY_ACTION_LABELS: Record<PatientIdentityAction, string> = {
  link_existing_patient: "Link existing patient",
  link_existing_enquiry_or_consultation: "Link existing enquiry or consultation",
  create_new_patient: "Create new patient",
};

export function patientIdentityActionSummaryLabel(action: PatientIdentityAction): string {
  switch (action) {
    case "link_existing_patient":
      return "Link existing FiOS patient";
    case "link_existing_enquiry_or_consultation":
      return "Link existing enquiry or consultation";
    case "create_new_patient":
      return "Create new FiOS patient";
  }
}

/**
 * Map resolver / search payload into one clear operator result state.
 * Never auto-links on name alone (caller must still require confirmation).
 */
export function resolveExternalIdentityResultState(input: {
  identityState?: string | null;
  patientHitCount?: number;
  consultationHitCount?: number;
  enquiryHitCount?: number;
  hasVerifiedMatch?: boolean;
}): ExternalIdentityResultState {
  const state = input.identityState?.trim() ?? "";
  if (state === "identity_conflict" || state === "ambiguous_identity") {
    return "identity_conflict";
  }
  if (state === "patient_linked") return "existing_patient_found";
  if (state === "consultation_identity_linked") return "existing_consultation_found";
  if (state === "enquiry_identity_linked") return "existing_consultation_found";

  const patients = input.patientHitCount ?? 0;
  const consultations = input.consultationHitCount ?? 0;
  const enquiries = input.enquiryHitCount ?? 0;
  const total = patients + consultations + enquiries;

  if (patients === 1 && consultations === 0 && enquiries === 0) {
    return "existing_patient_found";
  }
  if (consultations >= 1 && patients === 0) {
    return "existing_consultation_found";
  }
  if (enquiries >= 1 && patients === 0 && consultations === 0) {
    return "existing_consultation_found";
  }
  if (total > 1 || (patients >= 1 && consultations >= 1)) {
    return "possible_match_found";
  }
  if (total === 1 || input.hasVerifiedMatch) return "possible_match_found";
  return "no_fios_record_found";
}

/** Ticket permission names mapped onto existing calendar capability keys. */
export type ConversionPermissionKey =
  | "appointment.convert_external"
  | "patient.create"
  | "patient.link"
  | "appointment.assign_clinic"
  | "appointment.assign_staff"
  | "appointment.assign_room"
  | "calendar.google_writeback";

export type ConversionPermissionGate = {
  key: ConversionPermissionKey;
  allowed: boolean;
  explanation: string | null;
};

export function resolveConversionWizardPermissions(
  caps: CalendarAppointmentCapabilitySet
): Record<ConversionPermissionKey, ConversionPermissionGate> {
  const canConvert = calendarCapabilitySatisfies(caps, "appointment.convert_external");
  const canLink = calendarCapabilitySatisfies(caps, "appointment.link_patient");
  const canAssign = calendarCapabilitySatisfies(caps, "appointment.assign_resources");
  const canWriteback = calendarCapabilitySatisfies(caps, "calendar.google_writeback");

  return {
    "appointment.convert_external": {
      key: "appointment.convert_external",
      allowed: canConvert,
      explanation: canConvert
        ? null
        : "You need permission to convert external Google events into FiOS appointments.",
    },
    "patient.create": {
      key: "patient.create",
      allowed: canLink,
      explanation: canLink
        ? null
        : "You need permission to create a patient from Google contact details.",
    },
    "patient.link": {
      key: "patient.link",
      allowed: canLink,
      explanation: canLink
        ? null
        : "You need permission to link this Google event to an existing FiOS person.",
    },
    "appointment.assign_clinic": {
      key: "appointment.assign_clinic",
      allowed: canAssign,
      explanation: canAssign ? null : "You need permission to assign a clinic.",
    },
    "appointment.assign_staff": {
      key: "appointment.assign_staff",
      allowed: canAssign,
      explanation: canAssign ? null : "You need permission to assign staff.",
    },
    "appointment.assign_room": {
      key: "appointment.assign_room",
      allowed: canAssign,
      explanation: canAssign ? null : "You need permission to assign a room.",
    },
    "calendar.google_writeback": {
      key: "calendar.google_writeback",
      allowed: canWriteback,
      explanation: canWriteback
        ? null
        : "Google write-back is not available yet — drag-and-drop stays disabled after conversion until write-back is ready.",
    },
  };
}

export type ConversionRoomOption = {
  id: string;
  name: string;
  clinic_id: string;
};

export type ConversionStaffOption = {
  id: string;
  full_name?: string | null;
  email?: string | null;
  staff_role?: string | null;
  is_active?: boolean;
  /** Optional staff home clinic for compatibility checks. */
  primary_clinic_id?: string | null;
};

export function listActiveTenantStaffForConversion(
  staff: readonly ConversionStaffOption[]
): ConversionStaffOption[] {
  return staff.filter((s) =>
    isStaffBookableForClinicalWorkflow({
      is_active: s.is_active !== false,
      staff_role: s.staff_role,
    })
  );
}

export function assessStaffClinicCompatibility(input: {
  staffId: string | null | undefined;
  clinicId: string | null | undefined;
  staff: readonly ConversionStaffOption[];
  crossClinicConfirmed?: boolean;
}):
  | { ok: true; status: "unassigned" | "compatible" | "confirmed_cross_clinic" }
  | { ok: false; error: string; requiresConfirmation?: boolean } {
  const staffId = input.staffId?.trim() || null;
  if (!staffId) {
    return { ok: true, status: "unassigned" };
  }

  const staff = input.staff.find((s) => s.id.trim() === staffId);
  if (!staff) {
    return { ok: false, error: "Selected staff is not active for this tenant." };
  }

  if (
    !isStaffBookableForClinicalWorkflow({
      is_active: staff.is_active !== false,
      staff_role: staff.staff_role,
    })
  ) {
    return {
      ok: false,
      error: "This staff member is not assignable for clinical bookings.",
    };
  }

  const clinicId = input.clinicId?.trim() || null;
  const primary = staff.primary_clinic_id?.trim() || null;
  if (clinicId && primary && primary !== clinicId) {
    if (input.crossClinicConfirmed) {
      return { ok: true, status: "confirmed_cross_clinic" };
    }
    return {
      ok: false,
      requiresConfirmation: true,
      error:
        "Selected staff usually works at a different clinic. Confirm cross-clinic assignment to continue.",
    };
  }

  return { ok: true, status: "compatible" };
}

/**
 * Unassigning clinician must preserve clinicId.
 */
export function applyStaffUnassigned(clinicId: string | null): {
  clinicId: string | null;
  staffId: null;
  staffAssignment: "assign_later";
} {
  return {
    clinicId,
    staffId: null,
    staffAssignment: "assign_later",
  };
}

export function roomsForSelectedClinic(
  rooms: readonly ConversionRoomOption[],
  clinicId: string | null | undefined
): ConversionRoomOption[] {
  const cid = clinicId?.trim() || null;
  if (!cid) return [];
  return rooms.filter((r) => r.clinic_id.trim() === cid);
}

/**
 * When clinic changes, drop room if it no longer belongs to the clinic.
 * Clearing room must not clear clinic or staff.
 */
export function revalidateRoomForClinic(input: {
  clinicId: string | null | undefined;
  roomId: string | null | undefined;
  rooms: readonly ConversionRoomOption[];
}): string | null {
  const roomId = input.roomId?.trim() || null;
  if (!roomId) return null;
  const allowed = roomsForSelectedClinic(input.rooms, input.clinicId);
  return allowed.some((r) => r.id === roomId) ? roomId : null;
}

export type ConversionSummaryInput = {
  patientDisplayName: string;
  identityAction: PatientIdentityAction;
  clinicName: string | null;
  clinicUnassigned: boolean;
  staffName: string | null;
  staffAssignLater: boolean;
  appointmentType: string;
  dateLabel: string;
  timeRangeLabel: string;
  sourceLabel?: string;
};

export type ConversionSummary = {
  patient: string;
  identityAction: string;
  clinic: string;
  staff: string;
  appointment: {
    type: string;
    date: string;
    timeRange: string;
  };
  source: string;
  missingRequired: string[];
};

export function buildConversionSummary(input: ConversionSummaryInput): ConversionSummary {
  const missingRequired: string[] = [];
  if (!input.patientDisplayName.trim()) missingRequired.push("Patient");
  if (!input.clinicUnassigned && !input.clinicName?.trim()) missingRequired.push("Clinic");

  return {
    patient: input.patientDisplayName.trim() || "—",
    identityAction: patientIdentityActionSummaryLabel(input.identityAction),
    clinic: input.clinicUnassigned
      ? "Unassigned"
      : input.clinicName?.trim() || "—",
    staff: input.staffAssignLater
      ? "Unassigned"
      : input.staffName?.trim() || "Unassigned",
    appointment: {
      type: input.appointmentType.trim() || "—",
      date: input.dateLabel,
      timeRange: input.timeRangeLabel,
    },
    source: input.sourceLabel?.trim() || "Google Calendar",
    missingRequired,
  };
}

/** Phrases that must not appear as primary workflow labels. */
export const TECHNICAL_IDENTITY_PRIMARY_TERMS = [
  "Use consultation identity",
  "Promote consultation to canonical patient",
  "Create patient from Google details",
  "Promote to patient and link",
] as const;

export function primaryWorkflowExposesTechnicalIdentityTerms(
  labels: readonly string[]
): boolean {
  const set = new Set(labels.map((l) => l.trim()));
  return TECHNICAL_IDENTITY_PRIMARY_TERMS.some((t) => set.has(t));
}

export type ConversionAuditPayload = {
  googleEventId: string | null;
  patientId: string | null;
  consultationId: string | null;
  enquiryId: string | null;
  appointmentId: string | null;
  clinicId: string | null;
  staffId: string | null;
  roomId: string | null;
  identityMatchMethod: string | null;
  actingUserId: string | null;
  sourceInteraction: "external_event_conversion";
  previousClassification: string | null;
  newClassification: string | null;
  idempotencyResult: "created" | "reused";
};

export function buildConversionAuditMetadata(
  payload: ConversionAuditPayload
): Record<string, unknown> {
  return {
    google_event_id: payload.googleEventId,
    patient_id: payload.patientId,
    consultation_id: payload.consultationId,
    enquiry_id: payload.enquiryId,
    appointment_id: payload.appointmentId,
    clinic_id: payload.clinicId,
    staff_id: payload.staffId,
    room_id: payload.roomId,
    identity_match_method: payload.identityMatchMethod,
    acting_user_id: payload.actingUserId,
    source_interaction: payload.sourceInteraction,
    previous_classification: payload.previousClassification,
    new_classification: payload.newClassification,
    idempotency_result: payload.idempotencyResult,
  };
}
