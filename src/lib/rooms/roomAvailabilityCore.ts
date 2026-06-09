import { isBookingCancelled } from "@/src/lib/bookings/bookingPolicy";
import type { FiBookingRow } from "@/src/lib/bookings/types";

import type { FiClinicRoomRow, RoomOverlapBookingLike, RoomOverlapContext } from "./roomTypes";

/** Standard overlap: existing.start_at < new.end_at AND existing.end_at > new.start_at */
export function bookingTimesOverlap(
  aStartIso: string,
  aEndIso: string,
  bStartIso: string,
  bEndIso: string
): boolean {
  const aStart = Date.parse(aStartIso);
  const aEnd = Date.parse(aEndIso);
  const bStart = Date.parse(bStartIso);
  const bEnd = Date.parse(bEndIso);
  if (!Number.isFinite(aStart) || !Number.isFinite(aEnd) || !Number.isFinite(bStart) || !Number.isFinite(bEnd)) {
    return false;
  }
  return aStart < bEnd && aEnd > bStart;
}

export function buildRoomOverlapContext(rooms: FiClinicRoomRow[]): RoomOverlapContext {
  const roomsById = new Map<string, FiClinicRoomRow>();
  const roomIdsByPhysicalKey = new Map<string, string[]>();

  for (const room of rooms) {
    roomsById.set(room.id, room);
    const key = room.physical_room_key.trim();
    if (!key) continue;
    const list = roomIdsByPhysicalKey.get(key) ?? [];
    list.push(room.id);
    roomIdsByPhysicalKey.set(key, list);
  }

  return { roomsById, roomIdsByPhysicalKey };
}

export function physicalRoomKeysForRoomId(
  roomId: string,
  ctx: RoomOverlapContext
): { physicalKey: string | null; siblingRoomIds: string[] } {
  const room = ctx.roomsById.get(roomId.trim());
  if (!room) return { physicalKey: null, siblingRoomIds: [] };
  const key = room.physical_room_key.trim();
  const siblings = (ctx.roomIdsByPhysicalKey.get(key) ?? []).filter((id) => id !== room.id);
  return { physicalKey: key || null, siblingRoomIds: siblings };
}

export function roomIdsSharingPhysicalSpace(roomId: string, ctx: RoomOverlapContext): string[] {
  const room = ctx.roomsById.get(roomId.trim());
  if (!room) return [roomId.trim()];
  const key = room.physical_room_key.trim();
  if (!key) return [room.id];
  return ctx.roomIdsByPhysicalKey.get(key) ?? [room.id];
}

function isActiveBookingRow(row: { booking_status: string; cancelled_at?: string | null }): boolean {
  if (row.cancelled_at?.trim()) return false;
  if (isBookingCancelled({ booking_status: row.booking_status, cancelled_at: row.cancelled_at ?? null })) return false;
  if (row.booking_status === "completed") return false;
  return true;
}

export function findRoomOverlapConflict(args: {
  candidateRoomId: string;
  candidateStartIso: string;
  candidateEndIso: string;
  existing: RoomOverlapBookingLike[];
  ctx: RoomOverlapContext;
  excludeBookingId?: string | null;
}): RoomOverlapBookingLike | null {
  const roomId = args.candidateRoomId.trim();
  if (!roomId) return null;

  const blockedRoomIds = new Set(roomIdsSharingPhysicalSpace(roomId, args.ctx));
  const exclude = args.excludeBookingId?.trim() || null;

  for (const b of args.existing) {
    if (exclude && b.id === exclude) continue;
    if (!isActiveBookingRow(b)) continue;
    const bookedRoomId = b.room_id?.trim();
    if (!bookedRoomId || !blockedRoomIds.has(bookedRoomId)) continue;
    if (bookingTimesOverlap(args.candidateStartIso, args.candidateEndIso, b.start_at, b.end_at)) {
      return b;
    }
  }

  return null;
}

export function findStaffOverlapConflict(args: {
  candidateStaffId: string;
  candidateStartIso: string;
  candidateEndIso: string;
  existing: Array<Pick<FiBookingRow, "id" | "assigned_staff_id" | "start_at" | "end_at" | "booking_status" | "cancelled_at">>;
  excludeBookingId?: string | null;
}): (typeof args.existing)[number] | null {
  const staffId = args.candidateStaffId.trim();
  if (!staffId) return null;
  const exclude = args.excludeBookingId?.trim() || null;

  for (const b of args.existing) {
    if (exclude && b.id === exclude) continue;
    if (!isActiveBookingRow(b)) continue;
    if (b.assigned_staff_id?.trim() !== staffId) continue;
    if (bookingTimesOverlap(args.candidateStartIso, args.candidateEndIso, b.start_at, b.end_at)) {
      return b;
    }
  }

  return null;
}

export function resolveDefaultRoomFromOptions<T extends { room: FiClinicRoomRow; eligible: boolean; available: boolean; preferred: boolean }>(
  options: T[]
): T | null {
  const eligibleAvailable = options.filter((o) => o.eligible && o.available && o.room.is_active);
  if (eligibleAvailable.length === 0) return null;
  const preferred = eligibleAvailable.find((o) => o.preferred);
  if (preferred) return preferred;
  if (eligibleAvailable.length === 1) return eligibleAvailable[0] ?? null;
  const sorted = [...eligibleAvailable].sort((a, b) => {
    const so = a.room.sort_order - b.room.sort_order;
    if (so !== 0) return so;
    return a.room.display_name.localeCompare(b.room.display_name);
  });
  return sorted[0] ?? null;
}

export function staffRoleMatchesEligibility(staffRole: string, eligibleRole: string): boolean {
  const r = staffRole.trim().toLowerCase();
  const e = eligibleRole.trim().toLowerCase();
  if (!r || !e) return false;
  if (r === e) return true;
  if (e === "doctor" && /\b(doctor|physician|surgeon|dermatologist|gp|trichologist)\b/.test(r)) return true;
  if (e === "consultant" && (r.includes("consultant") || r.includes("trichologist"))) return true;
  if (e === "surgeon" && r.includes("surgeon")) return true;
  if (e === "nurse" && r.includes("nurse")) return true;
  if (e === "technician" && r.includes("technician")) return true;
  if (e === "trichologist" && r.includes("trichologist")) return true;
  if (e === "clinical_assistant" && (r.includes("assistant") || r.includes("clinical assistant"))) return true;
  return r.includes(e);
}

export function isStaffEligibleForServiceRules(
  staffId: string,
  staffRole: string,
  rules: Array<{ staff_id: string | null; staff_role: string | null; is_active: boolean }>
): boolean {
  const activeRules = rules.filter((r) => r.is_active);
  if (activeRules.length === 0) return true;

  for (const rule of activeRules) {
    const ruleStaffId = rule.staff_id?.trim() || null;
    if (ruleStaffId && ruleStaffId === staffId.trim()) return true;
    const ruleRole = rule.staff_role?.trim() || null;
    if (ruleRole && staffRoleMatchesEligibility(staffRole, ruleRole)) return true;
  }

  return false;
}

export function roomPickerDisabledReason(input: {
  room: FiClinicRoomRow;
  eligible: boolean;
  available: boolean;
}): string | null {
  if (!input.room.is_active) return "Room inactive";
  if (!input.eligible) return "Room not eligible for this service";
  if (!input.available) return "Room already booked";
  return null;
}
