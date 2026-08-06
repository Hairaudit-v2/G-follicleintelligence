/**
 * FI-CALENDAR-CONVERSION-UX-1C — appointment-type resource requirement levels.
 *
 * Prefer canonical service resource requirements when available; fall back to
 * booking-type heuristics so the wizard can govern without hard-coding surgery UI.
 */

export type ConversionResourceLevel = "required" | "recommended" | "optional";

export type ConversionAppointmentResourcePolicy = {
  appointmentType: string;
  clinic: ConversionResourceLevel;
  staff: ConversionResourceLevel;
  room: ConversionResourceLevel;
  /** True when policy came from service requirements rather than heuristics. */
  fromServiceRequirements: boolean;
  notes: string[];
};

export type ConversionServiceRequirementHint = {
  resource_type: "staff_role" | "staff_member" | "room_type" | "room_id" | string;
  is_required: boolean;
  resource_key?: string | null;
  requirement_label?: string | null;
};

function normalizeAppointmentType(value: string | null | undefined): string {
  return (value ?? "").trim().toLowerCase();
}

function isSurgeryType(type: string): boolean {
  return (
    type.includes("surgery") ||
    type.includes("transplant") ||
    type.includes("operative") ||
    type === "or"
  );
}

function isConsultType(type: string): boolean {
  return (
    type.includes("consult") ||
    type.includes("assessment") ||
    type.includes("follow") ||
    type.includes("enquiry")
  );
}

/**
 * Resolve clinic / staff / room requirement levels for conversion.
 * Pass service requirements when loaded from `fi_service_resource_requirements`.
 */
export function resolveConversionAppointmentResourcePolicy(input: {
  appointmentType: string | null | undefined;
  serviceRequirements?: readonly ConversionServiceRequirementHint[] | null;
  /** When true, clinic may remain unassigned (operator permission). */
  allowClinicUnassigned?: boolean;
}): ConversionAppointmentResourcePolicy {
  const appointmentType = input.appointmentType?.trim() || "consultation";
  const type = normalizeAppointmentType(appointmentType);
  const notes: string[] = [];

  const reqs = input.serviceRequirements ?? [];
  if (reqs.length > 0) {
    const staffRequired = reqs.some(
      (r) =>
        r.is_required &&
        (r.resource_type === "staff_role" || r.resource_type === "staff_member")
    );
    const roomRequired = reqs.some(
      (r) =>
        r.is_required && (r.resource_type === "room_type" || r.resource_type === "room_id")
    );
    const staffRecommended = reqs.some(
      (r) =>
        !r.is_required &&
        (r.resource_type === "staff_role" || r.resource_type === "staff_member")
    );
    const roomRecommended = reqs.some(
      (r) =>
        !r.is_required && (r.resource_type === "room_type" || r.resource_type === "room_id")
    );

    notes.push("Derived from service resource requirements.");
    return {
      appointmentType,
      clinic: input.allowClinicUnassigned ? "recommended" : "required",
      staff: staffRequired ? "required" : staffRecommended ? "recommended" : "optional",
      room: roomRequired ? "required" : roomRecommended ? "recommended" : "optional",
      fromServiceRequirements: true,
      notes,
    };
  }

  if (isSurgeryType(type)) {
    notes.push("Surgery defaults: clinic and responsible staff required; clinical room required.");
    return {
      appointmentType,
      clinic: "required",
      staff: "required",
      room: "required",
      fromServiceRequirements: false,
      notes,
    };
  }

  if (isConsultType(type)) {
    notes.push("Consultation defaults: clinic recommended; staff and room optional.");
    return {
      appointmentType,
      clinic: input.allowClinicUnassigned ? "optional" : "recommended",
      staff: "optional",
      room: "optional",
      fromServiceRequirements: false,
      notes,
    };
  }

  notes.push("Generic appointment defaults.");
  return {
    appointmentType,
    clinic: input.allowClinicUnassigned ? "optional" : "recommended",
    staff: "recommended",
    room: "optional",
    fromServiceRequirements: false,
    notes,
  };
}

export function listMissingConversionRequirements(input: {
  policy: ConversionAppointmentResourcePolicy;
  clinicId: string | null | undefined;
  staffId: string | null | undefined;
  staffAssignLater: boolean;
  roomId: string | null | undefined;
  staffOverrideConfirmed?: boolean;
  roomOverrideConfirmed?: boolean;
}): string[] {
  const missing: string[] = [];
  const clinicId = input.clinicId?.trim() || null;
  const staffId = input.staffAssignLater ? null : input.staffId?.trim() || null;
  const roomId = input.roomId?.trim() || null;

  if (input.policy.clinic === "required" && !clinicId) {
    missing.push("Clinic");
  }
  if (input.policy.staff === "required" && !staffId && !input.staffOverrideConfirmed) {
    missing.push("Assigned staff");
  }
  if (input.policy.room === "required" && !roomId && !input.roomOverrideConfirmed) {
    missing.push("Room");
  }
  return missing;
}
