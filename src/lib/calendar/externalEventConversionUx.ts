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
  room_type?: string | null;
  is_active?: boolean;
  /** Appointment-type / eligibility hint when known. */
  appointment_type_compatible?: boolean | null;
  /** Availability / conflict hint when known. */
  availability_state?: "available" | "conflict" | "unknown" | null;
};

export type ConversionStaffOption = {
  id: string;
  full_name?: string | null;
  email?: string | null;
  staff_role?: string | null;
  is_active?: boolean;
  /** Home clinic from team directory affinity. */
  primary_clinic_id?: string | null;
  /** Primary + additional clinic memberships. */
  clinic_ids?: string[];
  /** Clinical eligibility override (false blocks selection). */
  clinically_eligible?: boolean;
  /** Optional availability summary for display. */
  availability_summary?: string | null;
};

export type StaffClinicCompatibilityState =
  | "compatible"
  | "multi_clinic_compatible"
  | "different_primary_clinic"
  | "clinically_ineligible"
  | "unavailable"
  | "inactive"
  | "no_clinic_relationship"
  | "unassigned";

export const STAFF_CLINIC_COMPATIBILITY_LABELS: Record<StaffClinicCompatibilityState, string> = {
  compatible: "Compatible with clinic",
  multi_clinic_compatible: "Multi-clinic membership",
  different_primary_clinic: "Different primary clinic",
  clinically_ineligible: "Clinically ineligible",
  unavailable: "Unavailable",
  inactive: "Inactive",
  no_clinic_relationship: "No clinic relationship",
  unassigned: "Assign later",
};

export function listActiveTenantStaffForConversion(
  staff: readonly ConversionStaffOption[]
): ConversionStaffOption[] {
  return staff.filter(
    (s) =>
      s.is_active !== false &&
      isStaffBookableForClinicalWorkflow({
        // Outer guard already excludes explicit false; remaining is true | undefined.
        is_active: true,
        staff_role: s.staff_role,
      })
  );
}

export function assessStaffClinicCompatibility(input: {
  staffId: string | null | undefined;
  clinicId: string | null | undefined;
  staff: readonly ConversionStaffOption[];
  crossClinicConfirmed?: boolean;
  /** Authorised override when staff has no clinic relationship. */
  noRelationshipOverride?: boolean;
  /**
   * When the tenant has exactly one clinic, null staff affinity is treated as
   * compatible with that clinic (common Evolved Perth case).
   */
  soleClinicId?: string | null;
}):
  | {
      ok: true;
      status: StaffClinicCompatibilityState;
      state: StaffClinicCompatibilityState;
    }
  | {
      ok: false;
      error: string;
      state: StaffClinicCompatibilityState;
      requiresConfirmation?: boolean;
    } {
  const staffId = input.staffId?.trim() || null;
  if (!staffId) {
    return { ok: true, status: "unassigned", state: "unassigned" };
  }

  const staff = input.staff.find((s) => s.id.trim() === staffId);
  if (!staff) {
    return {
      ok: false,
      state: "unavailable",
      error: "Selected staff is not active for this tenant.",
    };
  }

  if (staff.is_active === false) {
    return {
      ok: false,
      state: "inactive",
      error: "Inactive staff cannot be assigned.",
    };
  }

  if (staff.clinically_eligible === false) {
    return {
      ok: false,
      state: "clinically_ineligible",
      error: "This staff member is not clinically eligible for assignment.",
    };
  }

  if (
    !isStaffBookableForClinicalWorkflow({
      is_active: staff.is_active !== false,
      staff_role: staff.staff_role,
    })
  ) {
    return {
      ok: false,
      state: "clinically_ineligible",
      error: "This staff member is not assignable for clinical bookings.",
    };
  }

  const clinicId = input.clinicId?.trim() || null;
  const soleClinicId = input.soleClinicId?.trim() || null;
  const primary = staff.primary_clinic_id?.trim() || null;
  const memberships = (staff.clinic_ids ?? [])
    .map((id) => id.trim())
    .filter(Boolean);
  const membershipSet = new Set(memberships);
  if (primary) membershipSet.add(primary);

  if (!clinicId) {
    return { ok: true, status: "compatible", state: "compatible" };
  }

  if (primary && primary === clinicId) {
    return { ok: true, status: "compatible", state: "compatible" };
  }

  if (membershipSet.has(clinicId) && (!primary || primary !== clinicId)) {
    return {
      ok: true,
      status: "multi_clinic_compatible",
      state: "multi_clinic_compatible",
    };
  }

  if (primary && primary !== clinicId) {
    if (input.crossClinicConfirmed) {
      return {
        ok: true,
        status: "different_primary_clinic",
        state: "different_primary_clinic",
      };
    }
    return {
      ok: false,
      state: "different_primary_clinic",
      requiresConfirmation: true,
      error:
        "Selected staff has a different primary clinic. Confirm cross-clinic assignment to continue.",
    };
  }

  // No primary and no membership for this clinic.
  if (membershipSet.size === 0) {
    if (soleClinicId && clinicId === soleClinicId) {
      return { ok: true, status: "compatible", state: "compatible" };
    }
    if (input.noRelationshipOverride || input.crossClinicConfirmed) {
      return {
        ok: true,
        status: "no_clinic_relationship",
        state: "no_clinic_relationship",
      };
    }
    return {
      ok: false,
      state: "no_clinic_relationship",
      requiresConfirmation: true,
      error:
        "Selected staff has no clinic relationship on file. Confirm an authorised override to continue.",
    };
  }

  return {
    ok: false,
    state: "no_clinic_relationship",
    error: "Selected staff is not linked to this clinic.",
  };
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
  return rooms.filter(
    (r) => r.clinic_id.trim() === cid && r.is_active !== false
  );
}

export type RoomRevalidationResult = {
  roomId: string | null;
  cleared: boolean;
  explanation: string | null;
};

/**
 * When clinic changes, drop room if it no longer belongs to the clinic.
 * Clearing room must not clear clinic or staff. Surface an explanation when cleared.
 */
export function revalidateRoomForClinic(input: {
  clinicId: string | null | undefined;
  roomId: string | null | undefined;
  rooms: readonly ConversionRoomOption[];
}): string | null {
  return revalidateRoomForClinicDetailed(input).roomId;
}

export function revalidateRoomForClinicDetailed(input: {
  clinicId: string | null | undefined;
  roomId: string | null | undefined;
  rooms: readonly ConversionRoomOption[];
}): RoomRevalidationResult {
  const roomId = input.roomId?.trim() || null;
  if (!roomId) {
    return { roomId: null, cleared: false, explanation: null };
  }

  const room = input.rooms.find((r) => r.id === roomId);
  if (!room) {
    return {
      roomId: null,
      cleared: true,
      explanation: "Selected room is no longer available and was cleared.",
    };
  }
  if (room.is_active === false) {
    return {
      roomId: null,
      cleared: true,
      explanation: "Selected room is inactive and was cleared.",
    };
  }
  const allowed = roomsForSelectedClinic(input.rooms, input.clinicId);
  if (!allowed.some((r) => r.id === roomId)) {
    return {
      roomId: null,
      cleared: true,
      explanation:
        "Selected room does not belong to the confirmed clinic and was cleared.",
    };
  }
  return { roomId, cleared: false, explanation: null };
}

export function mapClinicRoomsToConversionOptions(
  rooms: readonly {
    id: string;
    display_name?: string | null;
    room_code?: string | null;
    clinic_id: string;
    room_type?: string | null;
    is_active?: boolean;
  }[]
): ConversionRoomOption[] {
  return rooms.map((r) => ({
    id: r.id,
    name: r.display_name?.trim() || r.room_code?.trim() || r.id.slice(0, 8),
    clinic_id: r.clinic_id,
    room_type: r.room_type ?? null,
    is_active: r.is_active !== false,
    appointment_type_compatible: null,
    availability_state: "unknown",
  }));
}

export type ConversionSummaryInput = {
  patientDisplayName: string;
  identityAction: PatientIdentityAction;
  clinicName: string | null;
  clinicUnassigned: boolean;
  staffName: string | null;
  staffAssignLater: boolean;
  roomName?: string | null;
  appointmentType: string;
  dateLabel: string;
  timeRangeLabel: string;
  sourceLabel?: string;
  compatibilityWarnings?: string[];
  missingRequired?: string[];
};

export type ConversionSummary = {
  patient: string;
  identityAction: string;
  clinic: string;
  staff: string;
  room: string;
  appointment: {
    type: string;
    date: string;
    timeRange: string;
  };
  source: string;
  compatibilityWarnings: string[];
  missingRequired: string[];
};

export function buildConversionSummary(input: ConversionSummaryInput): ConversionSummary {
  const missingRequired = [...(input.missingRequired ?? [])];
  if (!input.patientDisplayName.trim()) missingRequired.push("Patient");
  if (!input.clinicUnassigned && !input.clinicName?.trim() && !missingRequired.includes("Clinic")) {
    // Soft clinic gap only when not already flagged by policy.
  }

  return {
    patient: input.patientDisplayName.trim() || "—",
    identityAction: patientIdentityActionSummaryLabel(input.identityAction),
    clinic: input.clinicUnassigned
      ? "Unassigned"
      : input.clinicName?.trim() || "—",
    staff: input.staffAssignLater
      ? "Unassigned"
      : input.staffName?.trim() || "Unassigned",
    room: input.roomName?.trim() || "None",
    appointment: {
      type: input.appointmentType.trim() || "—",
      date: input.dateLabel,
      timeRange: input.timeRangeLabel,
    },
    source: input.sourceLabel?.trim() || "Google Calendar",
    compatibilityWarnings: [...(input.compatibilityWarnings ?? [])],
    missingRequired: [...new Set(missingRequired)],
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
