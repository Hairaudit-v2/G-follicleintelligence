/**
 * WorkforceOS Phase 2D — map FI OS operational events to clinical staffing template event types.
 */

import type { FiBookingRow } from "@/src/lib/bookings/types";

export type WorkforceClinicalEventSource = "booking" | "surgery" | "calendar" | "manual";

export type WorkforceClinicalEventType =
  | "surgery"
  | "consultation"
  | "prp"
  | "exosomes"
  | "review"
  | "theatre_day"
  | "manual";

const BOOKING_TYPE_TO_WORKFORCE: Record<string, WorkforceClinicalEventType> = {
  surgery: "surgery",
  consultation: "consultation",
  prp: "prp",
  prf: "prp",
  exosomes: "exosomes",
  mesotherapy: "exosomes",
  review: "review",
  follow_up: "review",
  other: "consultation",
};

function normalizeBookingType(raw: string | null | undefined): string {
  return (raw ?? "").trim().toLowerCase();
}

function readMetadataDayKind(metadata: FiBookingRow["metadata"]): string {
  if (!metadata || typeof metadata !== "object" || Array.isArray(metadata)) return "";
  const keys = ["procedure_day_kind", "event_kind", "day_kind", "calendar_event_kind"] as const;
  for (const key of keys) {
    const value = metadata[key];
    if (typeof value === "string" && value.trim()) return value.trim().toLowerCase();
  }
  return "";
}

function isTheatreDayKind(kind: string): boolean {
  return kind === "surgery_day" || kind === "procedure_day" || kind === "theatre_day";
}

/** Map a booking row to a WorkforceOS template `event_type`. */
export function resolveWorkforceEventTypeFromBooking(booking: Pick<FiBookingRow, "booking_type" | "metadata">): WorkforceClinicalEventType {
  const bookingType = normalizeBookingType(booking.booking_type);
  const dayKind = readMetadataDayKind(booking.metadata);

  if (isTheatreDayKind(dayKind)) {
    return bookingType === "surgery" ? "surgery" : "theatre_day";
  }

  return BOOKING_TYPE_TO_WORKFORCE[bookingType] ?? "consultation";
}

/** Map a live surgery entity to a WorkforceOS template `event_type`. */
export function resolveWorkforceEventTypeFromSurgery(
  surgery: { procedure_phase?: string | null; metadata?: Record<string, unknown> | null } = {}
): WorkforceClinicalEventType {
  const meta = surgery.metadata;
  if (meta && typeof meta === "object" && !Array.isArray(meta)) {
    const dayKind = String(meta.procedure_day_kind ?? meta.event_kind ?? "").trim().toLowerCase();
    if (isTheatreDayKind(dayKind)) return "surgery";
  }
  const phase = (surgery.procedure_phase ?? "").trim().toLowerCase();
  if (phase === "theatre_day" || phase === "procedure_day") return "theatre_day";
  return "surgery";
}

export function resolveWorkforceEventSource(entity: {
  kind: "booking" | "surgery";
}): WorkforceClinicalEventSource {
  return entity.kind === "booking" ? "booking" : "surgery";
}

export function getWorkforceEventWindow(entity: {
  start_at: string;
  end_at: string;
}): { startsAt: string; endsAt: string } {
  return { startsAt: entity.start_at, endsAt: entity.end_at };
}

/** Normalize FI staff role / resource label to template role keys. */
export function resolveWorkforceAssignedRole(input: {
  staffRole?: string | null;
  roleLabel?: string | null;
  bookingType?: string | null;
}): string {
  const label = input.roleLabel?.trim().toLowerCase();
  if (label) return label;

  const role = (input.staffRole ?? "").trim().toLowerCase();
  const aliases: Record<string, string> = {
    surgeon: "surgeon",
    nurse: "nurse",
    technician: "technician",
    tech: "technician",
    consultant: "consultant",
    doctor: "doctor",
    clinician: "consultant",
  };
  if (role && aliases[role]) return aliases[role];

  const bookingType = normalizeBookingType(input.bookingType);
  if (bookingType === "surgery") return role || "surgeon";
  if (bookingType === "prp" || bookingType === "exosomes" || bookingType === "prf") return role || "doctor";
  return role || "consultant";
}

export type WorkforceStaffCandidate = { staffId: string; assignedRole: string };

export function buildWorkforceCandidateAssignments(input: {
  primaryStaffId?: string | null;
  primaryStaffRole?: string | null;
  bookingType?: string | null;
  resourceStaff?: Array<{ staffId: string; roleLabel?: string | null; staffRole?: string | null }>;
  existingAssignments?: Array<{ staffId: string; assignedRole: string }>;
}): WorkforceStaffCandidate[] {
  const out: WorkforceStaffCandidate[] = [];
  const seen = new Set<string>();

  const push = (staffId: string, assignedRole: string) => {
    const sid = staffId.trim();
    const role = assignedRole.trim().toLowerCase();
    if (!sid || !role) return;
    const key = `${sid}:${role}`;
    if (seen.has(key)) return;
    seen.add(key);
    out.push({ staffId: sid, assignedRole: role });
  };

  for (const row of input.existingAssignments ?? []) {
    push(row.staffId, row.assignedRole);
  }

  if (input.primaryStaffId?.trim()) {
    push(
      input.primaryStaffId,
      resolveWorkforceAssignedRole({
        staffRole: input.primaryStaffRole,
        bookingType: input.bookingType,
      })
    );
  }

  for (const resource of input.resourceStaff ?? []) {
    push(
      resource.staffId,
      resolveWorkforceAssignedRole({
        staffRole: resource.staffRole,
        roleLabel: resource.roleLabel,
        bookingType: input.bookingType,
      })
    );
  }

  return out;
}

export function isBookingActiveForStaffing(booking: Pick<FiBookingRow, "booking_status" | "cancelled_at">): boolean {
  const status = booking.booking_status.trim().toLowerCase();
  if (status === "cancelled" || booking.cancelled_at) return false;
  return true;
}
