import "server-only";

import type { SupabaseClient } from "@supabase/supabase-js";

import { supabaseAdmin } from "@/lib/supabaseAdmin";
import { assertNonEmptyUuid } from "@/src/lib/crm/validation";
import type { FiBookingRow } from "@/src/lib/bookings/types";
import { loadBookingResourceAssignmentsOverlapByBooking } from "@/src/lib/bookings/bookingResourceAssignmentsOverlap.server";
import { RoomAvailabilityError } from "@/src/lib/rooms/roomAvailability.server";
import {
  buildRoomOverlapContext,
  findRoomOverlapConflictWithAssignments,
  findStaffOverlapConflictWithAssignments,
  staffRoleMatchesEligibility,
} from "@/src/lib/rooms/roomAvailabilityCore";
import { loadClinicRoomsForTenant } from "@/src/lib/rooms/fiClinicRooms.server";
import type { FiClinicRoomRow } from "@/src/lib/rooms/roomTypes";
import { loadStaffMemberForTenant } from "@/src/lib/staff/staff.server";
import { assertStaffAppointmentWithinWorkingHours } from "@/src/lib/staff/staffSlotHours.server";
import { AppointmentStaffHoursError } from "@/src/lib/bookings/bookingErrors";

export type ServiceResourceRequirementType =
  | "staff_role"
  | "staff_member"
  | "room_type"
  | "room_id";

export type FiServiceResourceRequirementRow = {
  id: string;
  tenant_id: string;
  service_id: string;
  resource_type: ServiceResourceRequirementType;
  resource_key: string;
  requirement_label: string;
  is_required: boolean;
  quantity: number;
  sort_order: number;
  metadata: Record<string, unknown>;
  created_at?: string;
  updated_at?: string;
};

export type FiBookingResourceAssignmentRow = {
  id: string;
  tenant_id: string;
  booking_id: string;
  resource_type: "staff" | "room";
  resource_id: string;
  role_label: string | null;
  is_primary: boolean;
  metadata: Record<string, unknown>;
  created_at?: string;
  updated_at?: string;
};

export type ResourceAssignmentInput = {
  resource_type: "staff" | "room";
  resource_id: string;
  role_label?: string | null;
  is_primary?: boolean;
};

function mapRequirementRow(raw: Record<string, unknown>): FiServiceResourceRequirementRow {
  const meta = raw.metadata;
  return {
    id: String(raw.id),
    tenant_id: String(raw.tenant_id),
    service_id: String(raw.service_id),
    resource_type: String(raw.resource_type) as FiServiceResourceRequirementRow["resource_type"],
    resource_key: String(raw.resource_key ?? "").trim(),
    requirement_label: String(raw.requirement_label ?? "").trim(),
    is_required: Boolean(raw.is_required),
    quantity: Number(raw.quantity ?? 1),
    sort_order: Number(raw.sort_order ?? 0),
    metadata:
      meta && typeof meta === "object" && !Array.isArray(meta)
        ? (meta as Record<string, unknown>)
        : {},
    created_at: raw.created_at != null ? String(raw.created_at) : undefined,
    updated_at: raw.updated_at != null ? String(raw.updated_at) : undefined,
  };
}

function mapAssignmentRow(raw: Record<string, unknown>): FiBookingResourceAssignmentRow {
  const meta = raw.metadata;
  return {
    id: String(raw.id),
    tenant_id: String(raw.tenant_id),
    booking_id: String(raw.booking_id),
    resource_type: String(raw.resource_type) === "room" ? "room" : "staff",
    resource_id: String(raw.resource_id),
    role_label: raw.role_label != null ? String(raw.role_label) : null,
    is_primary: Boolean(raw.is_primary),
    metadata:
      meta && typeof meta === "object" && !Array.isArray(meta)
        ? (meta as Record<string, unknown>)
        : {},
    created_at: raw.created_at != null ? String(raw.created_at) : undefined,
    updated_at: raw.updated_at != null ? String(raw.updated_at) : undefined,
  };
}

export async function loadServiceResourceRequirements(args: {
  tenantId: string;
  serviceId: string;
  client?: SupabaseClient;
}): Promise<FiServiceResourceRequirementRow[]> {
  const tid = assertNonEmptyUuid(args.tenantId, "tenantId");
  const sid = assertNonEmptyUuid(args.serviceId, "serviceId");
  const supabase = args.client ?? supabaseAdmin();
  const { data, error } = await supabase
    .from("fi_service_resource_requirements")
    .select("*")
    .eq("tenant_id", tid)
    .eq("service_id", sid)
    .order("sort_order", { ascending: true })
    .order("requirement_label", { ascending: true });
  if (error) throw new Error(error.message);
  return (data ?? []).map((r) => mapRequirementRow(r as Record<string, unknown>));
}

export async function loadBookingResourceAssignments(args: {
  tenantId: string;
  bookingId: string;
  client?: SupabaseClient;
}): Promise<FiBookingResourceAssignmentRow[]> {
  const tid = assertNonEmptyUuid(args.tenantId, "tenantId");
  const bid = assertNonEmptyUuid(args.bookingId, "bookingId");
  const supabase = args.client ?? supabaseAdmin();
  const { data, error } = await supabase
    .from("fi_booking_resource_assignments")
    .select("*")
    .eq("tenant_id", tid)
    .eq("booking_id", bid)
    .order("resource_type", { ascending: true });
  if (error) throw new Error(error.message);
  return (data ?? []).map((r) => mapAssignmentRow(r as Record<string, unknown>));
}

export async function loadBookingResourceAssignmentsForBookings(args: {
  tenantId: string;
  bookingIds: string[];
  client?: SupabaseClient;
}): Promise<Map<string, FiBookingResourceAssignmentRow[]>> {
  const tid = assertNonEmptyUuid(args.tenantId, "tenantId");
  const ids = Array.from(new Set(args.bookingIds.map((x) => x.trim()).filter(Boolean)));
  const out = new Map<string, FiBookingResourceAssignmentRow[]>();
  if (ids.length === 0) return out;
  const supabase = args.client ?? supabaseAdmin();
  const { data, error } = await supabase
    .from("fi_booking_resource_assignments")
    .select("*")
    .eq("tenant_id", tid)
    .in("booking_id", ids);
  if (error) throw new Error(error.message);
  for (const raw of data ?? []) {
    const row = mapAssignmentRow(raw as Record<string, unknown>);
    const list = out.get(row.booking_id) ?? [];
    list.push(row);
    out.set(row.booking_id, list);
  }
  return out;
}

function staffMatchesRolePattern(staffRole: string, pattern: string): boolean {
  const tokens = pattern
    .split("|")
    .map((s) => s.trim())
    .filter(Boolean);
  if (tokens.length === 0) return false;
  for (const t of tokens) {
    if (staffRoleMatchesEligibility(staffRole, t)) return true;
  }
  return false;
}

async function loadOverlappingBookings(
  tenantId: string,
  startAt: string,
  endAt: string,
  client: SupabaseClient
) {
  const startMs = Date.parse(startAt);
  const endMs = Date.parse(endAt);
  const padStart = new Date(Math.min(startMs, startMs - 86_400_000)).toISOString();
  const padEnd = new Date(Math.max(endMs, endMs + 86_400_000)).toISOString();
  const { loadBookingsForOperatorView } = await import("@/src/lib/bookings/bookings");
  return loadBookingsForOperatorView(
    { tenantId, rangeStartIso: padStart, rangeEndIso: padEnd, includeCancelled: false },
    client
  );
}

/**
 * Validates every primary + extra staff/room has no overlapping booking (including physical room siblings).
 */
export async function assertBookingResourceAssignmentsAvailable(args: {
  tenantId: string;
  clinicId: string;
  primaryRoomId: string | null;
  primaryStaffId: string | null;
  extras: ResourceAssignmentInput[];
  startAt: string;
  endAt: string;
  bookingId?: string | null;
  client?: SupabaseClient;
}): Promise<void> {
  const tid = assertNonEmptyUuid(args.tenantId, "tenantId");
  const clinicId = assertNonEmptyUuid(args.clinicId, "clinicId");
  const client = args.client ?? supabaseAdmin();
  const exclude = args.bookingId?.trim() || null;

  const staffIds = new Set<string>();
  const roomIds = new Set<string>();
  if (args.primaryStaffId?.trim()) staffIds.add(args.primaryStaffId.trim());
  if (args.primaryRoomId?.trim()) roomIds.add(args.primaryRoomId.trim());
  for (const x of args.extras) {
    if (x.resource_type === "staff" && x.resource_id.trim()) staffIds.add(x.resource_id.trim());
    if (x.resource_type === "room" && x.resource_id.trim()) roomIds.add(x.resource_id.trim());
  }

  const existing = await loadOverlappingBookings(tid, args.startAt, args.endAt, client);
  const assignmentsByBookingId = await loadBookingResourceAssignmentsOverlapByBooking(
    tid,
    existing.map((b) => b.id),
    client
  );
  const rooms = await loadClinicRoomsForTenant(tid, { clinicId, activeOnly: true }, client);
  const ctx = buildRoomOverlapContext(rooms);

  for (const sid of Array.from(staffIds)) {
    const hit = findStaffOverlapConflictWithAssignments({
      candidateStaffId: sid,
      candidateStartIso: args.startAt,
      candidateEndIso: args.endAt,
      existing,
      assignmentsByBookingId,
      excludeBookingId: exclude,
    });
    if (hit) {
      const s = await loadStaffMemberForTenant(tid, sid, client);
      const name = s?.full_name?.trim() || "This staff member";
      throw new RoomAvailabilityError(
        `${name} is already assigned to another overlapping appointment.`
      );
    }
    try {
      await assertStaffAppointmentWithinWorkingHours(tid, sid, args.startAt, args.endAt, client);
    } catch (e) {
      if (e instanceof AppointmentStaffHoursError) throw new RoomAvailabilityError(e.message);
      throw e;
    }
  }

  for (const rid of Array.from(roomIds)) {
    const hit = findRoomOverlapConflictWithAssignments({
      candidateRoomId: rid,
      candidateStartIso: args.startAt,
      candidateEndIso: args.endAt,
      existing,
      ctx,
      assignmentsByBookingId,
      excludeBookingId: exclude,
    });
    if (hit) {
      const room = rooms.find((r) => r.id === rid);
      const label = room?.display_name ?? "A selected room";
      throw new RoomAvailabilityError(
        `${label} is already booked for an overlapping appointment (including shared physical room).`
      );
    }
  }
}

/**
 * Ensures primary + extras satisfy active {@link fi_service_resource_requirements} rows for the service.
 */
export async function assertServiceResourceRequirementsMet(args: {
  tenantId: string;
  clinicId: string;
  serviceId: string | null;
  primaryRoomId: string | null;
  primaryStaffId: string | null;
  extras: ResourceAssignmentInput[];
  client?: SupabaseClient;
}): Promise<void> {
  const tid = assertNonEmptyUuid(args.tenantId, "tenantId");
  const clinicId = assertNonEmptyUuid(args.clinicId, "clinicId");
  const client = args.client ?? supabaseAdmin();
  if (!args.serviceId?.trim()) return;

  const requirements = await loadServiceResourceRequirements({
    tenantId: tid,
    serviceId: args.serviceId.trim(),
    client,
  });
  if (requirements.length === 0) return;

  const rooms = await loadClinicRoomsForTenant(tid, { clinicId, activeOnly: true }, client);
  const roomsById = new Map(rooms.map((r) => [r.id, r]));

  const staffIds = new Set<string>();
  if (args.primaryStaffId?.trim()) staffIds.add(args.primaryStaffId.trim());
  const extraStaffById = new Map<string, ResourceAssignmentInput>();
  for (const x of args.extras) {
    if (x.resource_type === "staff" && x.resource_id.trim()) {
      staffIds.add(x.resource_id.trim());
      extraStaffById.set(x.resource_id.trim(), x);
    }
  }

  const staffRoleById = new Map<string, string>();
  for (const sid of Array.from(staffIds)) {
    const m = await loadStaffMemberForTenant(tid, sid, client);
    staffRoleById.set(sid, m?.staff_role?.trim() || "");
  }

  const roomIds = new Set<string>();
  if (args.primaryRoomId?.trim()) roomIds.add(args.primaryRoomId.trim());
  for (const x of args.extras) {
    if (x.resource_type === "room" && x.resource_id.trim()) roomIds.add(x.resource_id.trim());
  }

  const roomsUsed: FiClinicRoomRow[] = [];
  for (const rid of Array.from(roomIds)) {
    const row = roomsById.get(rid);
    if (row) roomsUsed.push(row);
  }

  for (const req of requirements) {
    if (!req.is_required) continue;
    if (req.resource_type === "staff_role") {
      const matchedIds = new Set<string>();
      for (const sid of Array.from(staffIds)) {
        const role = staffRoleById.get(sid) ?? "";
        if (staffMatchesRolePattern(role, req.resource_key)) matchedIds.add(sid);
      }
      if (matchedIds.size < req.quantity) {
        throw new RoomAvailabilityError(
          `This booking needs ${req.quantity}× ${req.requirement_label} (${req.resource_key.replace(/\|/g, " or ")}). Assign matching staff in Required resources.`
        );
      }
    } else if (req.resource_type === "staff_member") {
      const need = req.resource_key.trim();
      if (!staffIds.has(need)) {
        throw new RoomAvailabilityError(
          `Required staff member for “${req.requirement_label}” is not assigned.`
        );
      }
    } else if (req.resource_type === "room_type") {
      const want = req.resource_key.trim() as FiClinicRoomRow["room_type"];
      const matchedRoomIds = new Set(
        roomsUsed.filter((r) => r.room_type === want).map((r) => r.id)
      );
      if (matchedRoomIds.size < req.quantity) {
        throw new RoomAvailabilityError(
          `This booking needs ${req.quantity}× ${req.requirement_label} (room type “${want}”). Pick additional rooms if needed.`
        );
      }
    } else if (req.resource_type === "room_id") {
      const need = req.resource_key.trim();
      if (!roomIds.has(need)) {
        throw new RoomAvailabilityError(
          `Required room for “${req.requirement_label}” is not assigned.`
        );
      }
    }
  }
}

export async function replaceBookingResourceAssignments(args: {
  tenantId: string;
  bookingId: string;
  rows: ResourceAssignmentInput[];
  client?: SupabaseClient;
}): Promise<void> {
  const tid = assertNonEmptyUuid(args.tenantId, "tenantId");
  const bid = assertNonEmptyUuid(args.bookingId, "bookingId");
  const client = args.client ?? supabaseAdmin();
  const now = new Date().toISOString();

  const { error: delErr } = await client
    .from("fi_booking_resource_assignments")
    .delete()
    .eq("tenant_id", tid)
    .eq("booking_id", bid);
  if (delErr) throw new Error(delErr.message);

  if (args.rows.length === 0) return;

  const { error: insErr } = await client.from("fi_booking_resource_assignments").insert(
    args.rows.map((r) => ({
      tenant_id: tid,
      booking_id: bid,
      resource_type: r.resource_type,
      resource_id: r.resource_id.trim(),
      role_label: r.role_label?.trim() || null,
      is_primary: Boolean(r.is_primary),
      metadata: {},
      created_at: now,
      updated_at: now,
    }))
  );
  if (insErr) throw new Error(insErr.message);
}

export type ResolvedResourceAssignments = {
  extras: ResourceAssignmentInput[];
};

/**
 * Greedy auto-pick of supporting staff/rooms for required catalog rows (best-effort; UI may override).
 */
export async function resolveDefaultResourceAssignments(args: {
  tenantId: string;
  clinicId: string;
  serviceId: string | null;
  bookingType?: string | null;
  primaryRoomId: string | null;
  primaryStaffId: string | null;
  startAt: string;
  endAt: string;
  bookingId?: string | null;
  staffDirectoryIdsInRoleOrder?: string[];
  client?: SupabaseClient;
}): Promise<ResolvedResourceAssignments> {
  void args;
  return { extras: [] };
}

export type SuggestResourceAssignmentsResult = {
  /** requirement id → ordered candidate staff ids for pickers */
  staffOptionsByRequirementId: Record<string, string[]>;
  roomOptionsByRequirementId: Record<string, FiClinicRoomRow[]>;
};

/**
 * Returns eligible staff/room options per requirement row for UI pickers.
 */
export async function suggestResourceAssignments(args: {
  tenantId: string;
  clinicId: string;
  serviceId: string;
  staffCandidates: Array<{ id: string; staff_role: string; is_active: boolean }>;
  client?: SupabaseClient;
}): Promise<SuggestResourceAssignmentsResult> {
  const tid = assertNonEmptyUuid(args.tenantId, "tenantId");
  const cid = assertNonEmptyUuid(args.clinicId, "clinicId");
  const sid = assertNonEmptyUuid(args.serviceId, "serviceId");
  const client = args.client ?? supabaseAdmin();

  const requirements = await loadServiceResourceRequirements({
    tenantId: tid,
    serviceId: sid,
    client,
  });
  const rooms = await loadClinicRoomsForTenant(tid, { clinicId: cid, activeOnly: true }, client);

  const staffOptionsByRequirementId: Record<string, string[]> = {};
  const roomOptionsByRequirementId: Record<string, FiClinicRoomRow[]> = {};

  for (const req of requirements) {
    if (req.resource_type === "staff_role") {
      const ids = args.staffCandidates
        .filter((s) => s.is_active && staffMatchesRolePattern(s.staff_role, req.resource_key))
        .map((s) => s.id);
      staffOptionsByRequirementId[req.id] = ids;
    } else if (req.resource_type === "staff_member") {
      const id = req.resource_key.trim();
      staffOptionsByRequirementId[req.id] = args.staffCandidates.some((s) => s.id === id)
        ? [id]
        : [];
    } else if (req.resource_type === "room_type") {
      const want = req.resource_key.trim() as FiClinicRoomRow["room_type"];
      roomOptionsByRequirementId[req.id] = rooms.filter((r) => r.room_type === want);
    } else if (req.resource_type === "room_id") {
      const id = req.resource_key.trim();
      const row = rooms.find((r) => r.id === id);
      roomOptionsByRequirementId[req.id] = row ? [row] : [];
    }
  }

  return { staffOptionsByRequirementId, roomOptionsByRequirementId };
}

export function assignmentRowsToInput(
  rows: FiBookingResourceAssignmentRow[]
): ResourceAssignmentInput[] {
  return rows.map((r) => ({
    resource_type: r.resource_type,
    resource_id: r.resource_id,
    role_label: r.role_label,
    is_primary: r.is_primary,
  }));
}

export function buildBookingResourceSummaryLines(args: {
  booking: FiBookingRow;
  assignments: FiBookingResourceAssignmentRow[];
  roomLabelById: Record<string, string>;
  staffNameById: Record<string, string>;
}): { roomLine: string | null; teamLine: string | null } {
  const roomNames: string[] = [];
  const rid = args.booking.room_id?.trim();
  if (rid) {
    const primary = args.roomLabelById[rid] ?? rid.slice(0, 8);
    roomNames.push(primary);
  }
  for (const a of args.assignments) {
    if (a.resource_type === "room") {
      const lab = args.roomLabelById[a.resource_id] ?? a.resource_id.slice(0, 8);
      if (!roomNames.includes(lab)) roomNames.push(lab);
    }
  }

  const team: string[] = [];
  const sid = args.booking.assigned_staff_id?.trim();
  if (sid) {
    team.push(args.staffNameById[sid] ?? sid.slice(0, 8));
  }
  for (const a of args.assignments) {
    if (a.resource_type === "staff") {
      const lab = args.staffNameById[a.resource_id] ?? a.resource_id.slice(0, 8);
      if (!team.includes(lab)) team.push(lab);
    }
  }

  return {
    roomLine: roomNames.length ? `Room: ${roomNames.join(", ")}` : null,
    teamLine: team.length ? `Team: ${team.join(", ")}` : null,
  };
}
