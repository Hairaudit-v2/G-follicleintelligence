import { isBookingCancelled } from "./bookingPolicy";
import type { FiBookingRow } from "./types";

export const DEFAULT_APPOINTMENT_BUFFER_MINUTES = 15;

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
 * Checks whether a candidate slot conflicts with existing bookings for the same assignee (or all staff when unassigned).
 * Applies buffer time before/after each existing booking.
 */
export function checkAppointmentAvailability(args: {
  candidateStartIso: string;
  candidateEndIso: string;
  assignedUserId: string | null;
  existing: FiBookingRow[];
  excludeBookingId?: string | null;
  bufferMinutes?: number;
}): AppointmentAvailabilityResult {
  const startMs = Date.parse(args.candidateStartIso);
  const endMs = Date.parse(args.candidateEndIso);
  if (!Number.isFinite(startMs) || !Number.isFinite(endMs) || endMs <= startMs) {
    return { ok: false, message: "End time must be after start time.", conflictingBookingId: null };
  }

  const bufferMs = Math.max(0, (args.bufferMinutes ?? DEFAULT_APPOINTMENT_BUFFER_MINUTES) * 60_000);
  const assignee = args.assignedUserId?.trim() || null;
  const exclude = args.excludeBookingId?.trim() || null;

  for (const b of args.existing) {
    if (exclude && b.id === exclude) continue;
    if (isBookingCancelled(b) || b.booking_status === "completed") continue;
    const bAssignee = b.assigned_user_id?.trim() || null;
    if (assignee && bAssignee && assignee !== bAssignee) continue;
    if (assignee && !bAssignee) continue;
    if (!assignee && bAssignee) continue;

    const bStart = Date.parse(b.start_at);
    const bEnd = Date.parse(b.end_at);
    if (!Number.isFinite(bStart) || !Number.isFinite(bEnd)) continue;

    if (overlapsWithBuffer(startMs, endMs, bStart, bEnd, bufferMs)) {
      const title = b.title?.trim() || b.booking_type;
      return {
        ok: false,
        message: `Conflicts with “${title}” (${b.start_at.slice(0, 16).replace("T", " ")} UTC) including ${args.bufferMinutes ?? DEFAULT_APPOINTMENT_BUFFER_MINUTES}m buffer.`,
        conflictingBookingId: b.id,
      };
    }
  }

  return { ok: true };
}
