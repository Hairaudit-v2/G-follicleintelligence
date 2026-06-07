import { isBookingCancelled } from "./bookingPolicy";
import type { FiBookingRow } from "./types";

export const DEFAULT_APPOINTMENT_BUFFER_MINUTES = 15;

export type BookingAssigneeIdentity =
  | { kind: "unassigned" }
  | { kind: "staff"; staffId: string; linkedUserId: string | null }
  | { kind: "user"; userId: string };

export function bookingAssigneeIdentity(
  row: FiBookingRow,
  staffIdToUserId: Map<string, string | null>
): BookingAssigneeIdentity {
  const sid = row.assigned_staff_id?.trim() || null;
  const uid = row.assigned_user_id?.trim() || null;
  if (sid) {
    const linked = staffIdToUserId.has(sid) ? staffIdToUserId.get(sid) ?? null : null;
    return { kind: "staff", staffId: sid, linkedUserId: linked?.trim() || null };
  }
  if (uid) return { kind: "user", userId: uid };
  return { kind: "unassigned" };
}

export function bookingAssigneeIdentitiesMatch(
  a: BookingAssigneeIdentity,
  b: BookingAssigneeIdentity
): boolean {
  if (a.kind === "unassigned" && b.kind === "unassigned") return true;
  if (a.kind === "unassigned" || b.kind === "unassigned") return false;
  if (a.kind === "staff" && b.kind === "staff") return a.staffId === b.staffId;
  if (a.kind === "staff" && b.kind === "user") {
    return Boolean(a.linkedUserId && a.linkedUserId === b.userId);
  }
  if (a.kind === "user" && b.kind === "staff") {
    return Boolean(b.linkedUserId && b.linkedUserId === a.userId);
  }
  if (a.kind === "user" && b.kind === "user") return a.userId === b.userId;
  return false;
}

export type AppointmentAvailabilityResult =
  | { ok: true }
  | { ok: false; message: string; conflictingBookingId: string | null };

function overlapsWithBuffer(
  aStart: number,
  aEnd: number,
  bStart: number,
  bEnd: number,
  bufferMs: number
): boolean {
  return aStart < bEnd + bufferMs && aEnd + bufferMs > bStart;
}

/**
 * Checks whether a candidate slot conflicts with existing bookings for the same assignee
 * (staff id, linked fi_users, or legacy user-only rows). Unassigned overlaps only unassigned.
 * Applies buffer time before/after each existing booking.
 */
export function checkAppointmentAvailability(args: {
  candidateStartIso: string;
  candidateEndIso: string;
  candidateStaffId: string | null;
  candidateUserId: string | null;
  existing: FiBookingRow[];
  staffIdToUserId: Map<string, string | null>;
  excludeBookingId?: string | null;
  bufferMinutes?: number;
}): AppointmentAvailabilityResult {
  const startMs = Date.parse(args.candidateStartIso);
  const endMs = Date.parse(args.candidateEndIso);
  if (!Number.isFinite(startMs) || !Number.isFinite(endMs) || endMs <= startMs) {
    return { ok: false, message: "End time must be after start time.", conflictingBookingId: null };
  }

  const bufferMs = Math.max(0, (args.bufferMinutes ?? DEFAULT_APPOINTMENT_BUFFER_MINUTES) * 60_000);
  const exclude = args.excludeBookingId?.trim() || null;

  const sid = args.candidateStaffId?.trim() || null;
  const uid = args.candidateUserId?.trim() || null;
  const candidateIdentity: BookingAssigneeIdentity = sid
    ? {
        kind: "staff",
        staffId: sid,
        linkedUserId: args.staffIdToUserId.get(sid)?.trim() || null,
      }
    : uid
      ? { kind: "user", userId: uid }
      : { kind: "unassigned" };

  for (const b of args.existing) {
    if (exclude && b.id === exclude) continue;
    if (isBookingCancelled(b) || b.booking_status === "completed") continue;
    const bIdentity = bookingAssigneeIdentity(b, args.staffIdToUserId);
    if (!bookingAssigneeIdentitiesMatch(candidateIdentity, bIdentity)) continue;

    const bStart = Date.parse(b.start_at);
    const bEnd = Date.parse(b.end_at);
    if (!Number.isFinite(bStart) || !Number.isFinite(bEnd)) continue;

    if (overlapsWithBuffer(startMs, endMs, bStart, bEnd, bufferMs)) {
      const label = b.title?.trim() || b.booking_type || "booking";
      return {
        ok: false,
        message: `This time overlaps "${label}" for the same assignee (including a ${args.bufferMinutes ?? DEFAULT_APPOINTMENT_BUFFER_MINUTES}-minute buffer). Choose a different time, assignee, or reschedule the conflicting booking.`,
        conflictingBookingId: b.id,
      };
    }
  }

  return { ok: true };
}
