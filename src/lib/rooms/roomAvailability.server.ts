import "server-only";

import type { SupabaseClient } from "@supabase/supabase-js";

import { supabaseAdmin } from "@/lib/supabaseAdmin";
import { loadBookingsForOperatorView } from "@/src/lib/bookings/bookings";
import { loadStaffMemberForTenant } from "@/src/lib/staff/staff.server";
import { assertNonEmptyUuid } from "@/src/lib/crm/validation";

import {
  buildRoomOverlapContext,
  findRoomOverlapConflictWithAssignments,
  findStaffOverlapConflictWithAssignments,
  isStaffEligibleForServiceRules,
  resolveDefaultRoomFromOptions,
  roomPickerDisabledReason,
} from "./roomAvailabilityCore";
import { loadBookingResourceAssignmentsOverlapByBooking } from "@/src/lib/bookings/bookingResourceAssignmentsOverlap.server";
import {
  loadClinicRoomForTenant,
  loadClinicRoomsForTenant,
  loadServiceRoomEligibilityForService,
  loadServiceStaffEligibilityForService,
  resolveServiceIdForBookingType,
} from "./fiClinicRooms.server";
import type { RoomPickerOption } from "./roomTypes";

export class RoomAvailabilityError extends Error {
  readonly code = "room_availability";
  constructor(message: string) {
    super(message);
    this.name = "RoomAvailabilityError";
  }
}

export class ServiceStaffEligibilityError extends Error {
  readonly code = "service_staff_eligibility";
  constructor(message: string) {
    super(message);
    this.name = "ServiceStaffEligibilityError";
  }
}

export async function loadOverlappingBookingsForRange(
  tenantId: string,
  startAt: string,
  endAt: string,
  client?: SupabaseClient
) {
  const startMs = Date.parse(startAt);
  const endMs = Date.parse(endAt);
  const padStart = new Date(Math.min(startMs, startMs - 86_400_000)).toISOString();
  const padEnd = new Date(Math.max(endMs, endMs + 86_400_000)).toISOString();
  return loadBookingsForOperatorView(
    {
      tenantId,
      rangeStartIso: padStart,
      rangeEndIso: padEnd,
      includeCancelled: false,
    },
    client
  );
}

export function filterRoomEligibilityForClinic<
  T extends { clinic_id: string | null; is_active: boolean },
>(rows: T[], clinicId: string): T[] {
  const cid = clinicId.trim();
  return rows.filter((r) => r.is_active && (!r.clinic_id || r.clinic_id.trim() === cid));
}

export async function loadClinicRoomsForPicker(args: {
  tenantId: string;
  clinicId: string;
  serviceId?: string | null;
  bookingType?: string | null;
  startAt: string;
  endAt: string;
  bookingId?: string | null;
  client?: SupabaseClient;
}): Promise<RoomPickerOption[]> {
  const tid = assertNonEmptyUuid(args.tenantId, "tenantId");
  const clinicId = assertNonEmptyUuid(args.clinicId, "clinicId");
  const client = args.client ?? supabaseAdmin();

  let serviceId = args.serviceId?.trim() || null;
  if (!serviceId && args.bookingType?.trim()) {
    serviceId = await resolveServiceIdForBookingType(tid, args.bookingType.trim(), client);
  }

  const [rooms, eligibility, existing] = await Promise.all([
    loadClinicRoomsForTenant(tid, { clinicId, activeOnly: false }, client),
    serviceId ? loadServiceRoomEligibilityForService(tid, serviceId, client) : Promise.resolve([]),
    loadOverlappingBookingsForRange(tid, args.startAt, args.endAt, client),
  ]);

  const assignmentByBooking = await loadBookingResourceAssignmentsOverlapByBooking(
    tid,
    existing.map((b) => b.id),
    client
  );

  const ctx = buildRoomOverlapContext(rooms);
  const eligibleRoomIds =
    serviceId && eligibility.length > 0
      ? new Set(filterRoomEligibilityForClinic(eligibility, clinicId).map((e) => e.room_id))
      : null;
  const preferredRoomIds = new Set(
    filterRoomEligibilityForClinic(eligibility, clinicId)
      .filter((e) => e.is_preferred)
      .map((e) => e.room_id)
  );

  return rooms.map((room) => {
    const eligible = eligibleRoomIds == null || eligibleRoomIds.has(room.id);
    const conflict = findRoomOverlapConflictWithAssignments({
      candidateRoomId: room.id,
      candidateStartIso: args.startAt,
      candidateEndIso: args.endAt,
      existing,
      ctx,
      assignmentsByBookingId: assignmentByBooking,
      excludeBookingId: args.bookingId,
    });
    const available = !conflict;
    const preferred = preferredRoomIds.has(room.id);
    const disabledReason = roomPickerDisabledReason({ room, eligible, available });
    return { room, eligible, available, preferred, disabledReason };
  });
}

export async function assertRoomAvailableForBooking(args: {
  tenantId: string;
  clinicId: string;
  roomId: string;
  serviceId?: string | null;
  bookingType?: string | null;
  bookingId?: string | null;
  startAt: string;
  endAt: string;
  client?: SupabaseClient;
}): Promise<void> {
  const tid = assertNonEmptyUuid(args.tenantId, "tenantId");
  const clinicId = assertNonEmptyUuid(args.clinicId, "clinicId");
  const roomId = assertNonEmptyUuid(args.roomId, "roomId");
  const client = args.client ?? supabaseAdmin();

  const room = await loadClinicRoomForTenant(tid, roomId, client);
  if (!room) throw new RoomAvailabilityError("Room not found for this tenant.");
  if (!room.is_active) throw new RoomAvailabilityError("Room is inactive and cannot be booked.");
  if (room.clinic_id !== clinicId) {
    throw new RoomAvailabilityError("Room does not belong to the selected clinic.");
  }

  let serviceId = args.serviceId?.trim() || null;
  if (!serviceId && args.bookingType?.trim()) {
    serviceId = await resolveServiceIdForBookingType(tid, args.bookingType.trim(), client);
  }

  if (serviceId) {
    const eligibility = await loadServiceRoomEligibilityForService(tid, serviceId, client);
    const active = filterRoomEligibilityForClinic(eligibility, clinicId);
    if (active.length > 0 && !active.some((e) => e.room_id === roomId)) {
      throw new RoomAvailabilityError("This room is not eligible for the selected service.");
    }
  }

  const [rooms, existing] = await Promise.all([
    loadClinicRoomsForTenant(tid, { clinicId }, client),
    loadOverlappingBookingsForRange(tid, args.startAt, args.endAt, client),
  ]);
  const assignmentByBooking = await loadBookingResourceAssignmentsOverlapByBooking(
    tid,
    existing.map((b) => b.id),
    client
  );
  const ctx = buildRoomOverlapContext(rooms);
  const conflict = findRoomOverlapConflictWithAssignments({
    candidateRoomId: roomId,
    candidateStartIso: args.startAt,
    candidateEndIso: args.endAt,
    existing,
    ctx,
    assignmentsByBookingId: assignmentByBooking,
    excludeBookingId: args.bookingId,
  });
  if (conflict) {
    const label = room.display_name || room.room_code;
    throw new RoomAvailabilityError(
      `${label} is already booked for an overlapping appointment (including shared physical room).`
    );
  }
}

export async function resolveDefaultRoomForService(args: {
  tenantId: string;
  clinicId: string;
  serviceId?: string | null;
  bookingType?: string | null;
  startAt: string;
  endAt: string;
  bookingId?: string | null;
  client?: SupabaseClient;
}): Promise<string | null> {
  const options = await loadClinicRoomsForPicker(args);
  const pick = resolveDefaultRoomFromOptions(options);
  return pick?.room.id ?? null;
}

export async function assertServiceStaffEligible(args: {
  tenantId: string;
  serviceId?: string | null;
  bookingType?: string | null;
  staffId: string;
  client?: SupabaseClient;
}): Promise<void> {
  const tid = assertNonEmptyUuid(args.tenantId, "tenantId");
  const staffId = assertNonEmptyUuid(args.staffId, "staffId");
  const client = args.client ?? supabaseAdmin();

  let serviceId = args.serviceId?.trim() || null;
  if (!serviceId && args.bookingType?.trim()) {
    serviceId = await resolveServiceIdForBookingType(tid, args.bookingType.trim(), client);
  }
  if (!serviceId) return;

  const [rules, staff] = await Promise.all([
    loadServiceStaffEligibilityForService(tid, serviceId, client),
    loadStaffMemberForTenant(tid, staffId, client),
  ]);
  if (!staff) throw new ServiceStaffEligibilityError("Staff member not found for this tenant.");

  const activeRules = rules.filter((r) => r.is_active);
  if (activeRules.length === 0) return;

  if (!isStaffEligibleForServiceRules(staffId, staff.staff_role, activeRules)) {
    throw new ServiceStaffEligibilityError(
      `${staff.full_name} is not eligible to deliver this service based on configured staff rules.`
    );
  }
}

export async function assertBookingResourceAvailability(args: {
  tenantId: string;
  clinicId?: string | null;
  serviceId?: string | null;
  bookingType?: string | null;
  roomId?: string | null;
  roomRequired?: boolean;
  staffId?: string | null;
  bookingId?: string | null;
  startAt: string;
  endAt: string;
  client?: SupabaseClient;
}): Promise<void> {
  const tid = assertNonEmptyUuid(args.tenantId, "tenantId");
  const client = args.client ?? supabaseAdmin();
  const roomRequired = args.roomRequired !== false;
  const roomId = args.roomId?.trim() || null;
  const clinicId = args.clinicId?.trim() || null;
  const staffId = args.staffId?.trim() || null;

  if (roomRequired && !roomId) {
    throw new RoomAvailabilityError("A room must be assigned before saving this appointment.");
  }

  if (staffId) {
    await assertServiceStaffEligible({
      tenantId: tid,
      serviceId: args.serviceId,
      bookingType: args.bookingType,
      staffId,
      client,
    });

    const existing = await loadOverlappingBookingsForRange(tid, args.startAt, args.endAt, client);
    const assignmentByBooking = await loadBookingResourceAssignmentsOverlapByBooking(
      tid,
      existing.map((b) => b.id),
      client
    );
    const staffConflict = findStaffOverlapConflictWithAssignments({
      candidateStaffId: staffId,
      candidateStartIso: args.startAt,
      candidateEndIso: args.endAt,
      existing,
      assignmentsByBookingId: assignmentByBooking,
      excludeBookingId: args.bookingId,
    });
    if (staffConflict) {
      throw new RoomAvailabilityError(
        "This staff member is already booked for an overlapping appointment."
      );
    }
  }

  if (roomId) {
    if (!clinicId) {
      throw new RoomAvailabilityError("clinicId is required when assigning a room.");
    }
    await assertRoomAvailableForBooking({
      tenantId: tid,
      clinicId,
      roomId,
      serviceId: args.serviceId,
      bookingType: args.bookingType,
      bookingId: args.bookingId,
      startAt: args.startAt,
      endAt: args.endAt,
      client,
    });
  } else if (roomRequired) {
    let serviceId = args.serviceId?.trim() || null;
    if (!serviceId && args.bookingType?.trim()) {
      serviceId = await resolveServiceIdForBookingType(tid, args.bookingType.trim(), client);
    }
    if (serviceId && clinicId) {
      const eligibility = await loadServiceRoomEligibilityForService(tid, serviceId, client);
      const active = filterRoomEligibilityForClinic(eligibility, clinicId);
      if (active.length > 0) {
        throw new RoomAvailabilityError("Select an eligible room for this service.");
      }
    }
  }
}
