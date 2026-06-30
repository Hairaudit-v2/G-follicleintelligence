import "server-only";

import type { SupabaseClient } from "@supabase/supabase-js";

import { supabaseAdmin } from "@/lib/supabaseAdmin";
import { assertNonEmptyUuid } from "@/src/lib/crm/validation";
import {
  addUtcMinutesToIso,
  addDaysToCalendarDate,
  calendarDateStringFromInstant,
  isoFromLocalDayMinutes,
  localClockMinutesFromInstant,
  normalizeCalendarTimezone,
  parseIsoUtcMs,
  toDatetimeLocalValueInTimezone,
} from "@/src/lib/calendar/calendarTimezone";
import { loadTenantOperationalCalendarSettings } from "@/src/lib/calendar/tenantOperationalCalendarSettings.server";
import type { BusinessGridConfig } from "@/src/lib/calendar/operationalCalendarLayout";
import {
  filterRoomEligibilityForClinic,
  loadOverlappingBookingsForRange,
} from "@/src/lib/rooms/roomAvailability.server";
import {
  buildRoomOverlapContext,
  findRoomOverlapConflictWithAssignments,
  findStaffOverlapConflictWithAssignments,
  isStaffEligibleForServiceRules,
} from "@/src/lib/rooms/roomAvailabilityCore";
import { loadBookingResourceAssignmentsOverlapByBooking } from "@/src/lib/bookings/bookingResourceAssignmentsOverlap.server";
import {
  loadClinicRoomsForTenant,
  loadServiceRoomEligibilityForService,
  loadServiceStaffEligibilityForService,
  resolveServiceIdForBookingType,
} from "@/src/lib/rooms/fiClinicRooms.server";
import type { FiClinicRoomRow } from "@/src/lib/rooms/roomTypes";
import { loadStaffMemberForTenant } from "@/src/lib/staff/staff.server";
import { isStaffBookableForClinicalWorkflow } from "@/src/lib/staff/staffRolePolicy";
import { isSupportStaffRole } from "@/src/lib/staff/clinicalStaffPicker";
import {
  DEFAULT_STAFF_HOURS_FALLBACK_TZ,
  isUtcRangeWithinStaffWeeklyHours,
  parseStaffWeeklyHours,
  staffWeekdayKeyFromUtcMs,
} from "@/src/lib/staff/staffWeeklyHours";

export type NextAvailableBookingSlot = {
  startAt: string;
  endAt: string;
  roomId: string;
  roomLabel: string;
  staffId?: string;
  staffLabel?: string;
  reason: string;
};

export type FindNextAvailableBookingSlotsResult = {
  slots: NextAvailableBookingSlot[];
};

export type FindNextAvailableBookingSlotsInput = {
  tenantId: string;
  clinicId: string;
  serviceId?: string | null;
  bookingType?: string | null;
  staffId?: string | null;
  roomId?: string | null;
  bookingId?: string | null;
  preferredStartAt: string;
  durationMinutes: number;
  limit?: number;
  /** Default 14. */
  maxDaysForward?: number;
  client?: SupabaseClient;
};

function localClockKey(iso: string, timeZone: string): string {
  return toDatetimeLocalValueInTimezone(iso, timeZone).slice(0, 16);
}

function fitsSameLocalCalendarDayForStaff(
  startMs: number,
  endMs: number,
  staffTz: string
): boolean {
  if (!Number.isFinite(startMs) || !Number.isFinite(endMs) || endMs <= startMs) return false;
  return (
    staffWeekdayKeyFromUtcMs(startMs, staffTz) === staffWeekdayKeyFromUtcMs(endMs - 1, staffTz)
  );
}

function fitsClinicBusinessDay(
  startIso: string,
  endIso: string,
  dayKey: string,
  cfg: BusinessGridConfig
): boolean {
  const tz = cfg.timeZone;
  const sm = parseIsoUtcMs(startIso);
  const em = parseIsoUtcMs(endIso);
  if (sm == null || em == null || em <= sm) return false;
  const startDay = toDatetimeLocalValueInTimezone(startIso, tz).slice(0, 10);
  const endDay = toDatetimeLocalValueInTimezone(addUtcMinutesToIso(endIso, -1), tz).slice(0, 10);
  if (startDay !== dayKey || endDay !== dayKey) return false;
  const open = cfg.dayStartHourUtc * 60;
  const close = cfg.dayEndHourUtc * 60;
  const startMin = localClockMinutesFromInstant(sm, tz);
  const endMinLast = localClockMinutesFromInstant(em - 1, tz);
  if (startMin == null || endMinLast == null) return false;
  if (startMin < open || endMinLast >= close) return false;
  return true;
}

function sortRoomsForSearch(
  rooms: FiClinicRoomRow[],
  preferredRoomId: string | null,
  preferredRoomIds: Set<string>
): FiClinicRoomRow[] {
  return [...rooms].sort((a, b) => {
    if (preferredRoomId) {
      if (a.id === preferredRoomId) return -1;
      if (b.id === preferredRoomId) return 1;
    }
    const ap = preferredRoomIds.has(a.id) ? 0 : 1;
    const bp = preferredRoomIds.has(b.id) ? 0 : 1;
    if (ap !== bp) return ap - bp;
    if (a.sort_order !== b.sort_order) return a.sort_order - b.sort_order;
    return a.display_name.localeCompare(b.display_name);
  });
}

function isSuggestableClinicalAssignableStaff(staff: {
  is_active: boolean;
  staff_role: string | null | undefined;
}): boolean {
  if (!isStaffBookableForClinicalWorkflow(staff)) return false;
  if (isSupportStaffRole(staff.staff_role)) return false;
  return true;
}

/**
 * Search forward on the tenant operational grid for bookable (room + optional staff) slots
 * that pass the same overlap, eligibility, and working-hours rules as save-time booking.
 */
export async function findNextAvailableBookingSlots(
  input: FindNextAvailableBookingSlotsInput
): Promise<FindNextAvailableBookingSlotsResult> {
  const tid = assertNonEmptyUuid(input.tenantId, "tenantId");
  const clinicId = assertNonEmptyUuid(input.clinicId, "clinicId");
  const client = input.client ?? supabaseAdmin();

  const limit = Math.min(20, Math.max(1, input.limit ?? 5));
  const maxDays = Math.min(30, Math.max(1, input.maxDaysForward ?? 14));
  const durationMinutes = Math.max(1, Math.floor(input.durationMinutes));

  const preferredMs = Date.parse(input.preferredStartAt.trim());
  if (!Number.isFinite(preferredMs)) {
    return { slots: [] };
  }

  const preferredStartAt = input.preferredStartAt.trim();
  const preferredRoomId = input.roomId?.trim() || null;
  const staffId = input.staffId?.trim() || null;
  const bookingId = input.bookingId?.trim() || null;

  const { gridConfig } = await loadTenantOperationalCalendarSettings(tid);
  const cfg: BusinessGridConfig = gridConfig;
  const gridTz = cfg.timeZone;

  let serviceId = input.serviceId?.trim() || null;
  if (!serviceId && input.bookingType?.trim()) {
    serviceId = await resolveServiceIdForBookingType(tid, input.bookingType.trim(), client);
  }

  let staff: Awaited<ReturnType<typeof loadStaffMemberForTenant>> = null;
  let staffWeekly = parseStaffWeeklyHours({});
  let staffTz = normalizeCalendarTimezone(DEFAULT_STAFF_HOURS_FALLBACK_TZ);
  let staffRules: Awaited<ReturnType<typeof loadServiceStaffEligibilityForService>> = [];

  if (staffId) {
    staff = await loadStaffMemberForTenant(tid, staffId, client);
    if (!staff || !isSuggestableClinicalAssignableStaff(staff)) {
      return { slots: [] };
    }
    staffWeekly = parseStaffWeeklyHours(staff.working_hours);
    staffTz = normalizeCalendarTimezone(
      staff.default_timezone?.trim() || DEFAULT_STAFF_HOURS_FALLBACK_TZ
    );
    if (serviceId) {
      staffRules = await loadServiceStaffEligibilityForService(tid, serviceId, client);
    }
    const activeRules = staffRules.filter((r) => r.is_active);
    if (
      serviceId &&
      activeRules.length > 0 &&
      !isStaffEligibleForServiceRules(staffId, staff.staff_role, activeRules)
    ) {
      return { slots: [] };
    }
  }

  const [roomsRaw, roomEligibility] = await Promise.all([
    loadClinicRoomsForTenant(tid, { clinicId, activeOnly: true }, client),
    serviceId ? loadServiceRoomEligibilityForService(tid, serviceId, client) : Promise.resolve([]),
  ]);

  const eligibleRoomIds: Set<string> | null =
    serviceId && roomEligibility.length > 0
      ? new Set(filterRoomEligibilityForClinic(roomEligibility, clinicId).map((e) => e.room_id))
      : null;

  const preferredFromEligibility = new Set(
    filterRoomEligibilityForClinic(roomEligibility, clinicId)
      .filter((e) => e.is_preferred)
      .map((e) => e.room_id)
  );

  const rooms = roomsRaw.filter((r) => {
    if (!r.is_active) return false;
    if (eligibleRoomIds && !eligibleRoomIds.has(r.id)) return false;
    return true;
  });

  if (rooms.length === 0) {
    return { slots: [] };
  }

  const sortedRooms = sortRoomsForSearch(rooms, preferredRoomId, preferredFromEligibility);
  const ctx = buildRoomOverlapContext(roomsRaw);

  const horizonEndIso = addUtcMinutesToIso(
    new Date(preferredMs + maxDays * 86_400_000).toISOString(),
    durationMinutes + 120
  );
  const existing = await loadOverlappingBookingsForRange(
    tid,
    preferredStartAt,
    horizonEndIso,
    client
  );
  const assignmentByBooking = await loadBookingResourceAssignmentsOverlapByBooking(
    tid,
    existing.map((b) => b.id),
    client
  );

  const slots: NextAvailableBookingSlot[] = [];
  const seen = new Set<string>();
  const prefClockKey = localClockKey(preferredStartAt, gridTz);

  const startDayKey = calendarDateStringFromInstant(new Date(preferredMs), gridTz);

  for (let d = 0; d < maxDays && slots.length < limit; d++) {
    const dayKey = addDaysToCalendarDate(startDayKey, d, gridTz);
    const dayStartMin = cfg.dayStartHourUtc * 60;
    const dayEndMin = cfg.dayEndHourUtc * 60;

    for (let m = dayStartMin; m + durationMinutes <= dayEndMin; m += cfg.slotMinutes) {
      if (slots.length >= limit) break;

      const startIso = isoFromLocalDayMinutes(dayKey, m, gridTz);
      if (!startIso) continue;
      const endIso = addUtcMinutesToIso(startIso, durationMinutes);
      const startMs = parseIsoUtcMs(startIso);
      const endMs = parseIsoUtcMs(endIso);
      if (
        startMs == null ||
        endMs == null ||
        startMs < preferredMs ||
        !fitsClinicBusinessDay(startIso, endIso, dayKey, cfg)
      ) {
        continue;
      }

      if (staffId && staff) {
        if (!fitsSameLocalCalendarDayForStaff(startMs, endMs, staffTz)) continue;
        if (!isUtcRangeWithinStaffWeeklyHours(startMs, endMs, staffWeekly, staffTz)) continue;
        if (
          findStaffOverlapConflictWithAssignments({
            candidateStaffId: staffId,
            candidateStartIso: startIso,
            candidateEndIso: endIso,
            existing,
            assignmentsByBookingId: assignmentByBooking,
            excludeBookingId: bookingId,
          })
        ) {
          continue;
        }
      }

      for (const room of sortedRooms) {
        if (slots.length >= limit) break;

        if (
          findRoomOverlapConflictWithAssignments({
            candidateRoomId: room.id,
            candidateStartIso: startIso,
            candidateEndIso: endIso,
            existing,
            ctx,
            assignmentsByBookingId: assignmentByBooking,
            excludeBookingId: bookingId,
          })
        ) {
          continue;
        }

        const dedupeKey = `${startIso}|${room.id}|${staffId ?? ""}`;
        if (seen.has(dedupeKey)) continue;
        seen.add(dedupeKey);

        const clockKey = localClockKey(startIso, gridTz);
        const sameWallAsPreferred = clockKey === prefClockKey;
        let reason: string;
        if (sameWallAsPreferred && preferredRoomId && room.id !== preferredRoomId) {
          reason = `${room.display_name} is available at the same time.`;
        } else if (sameWallAsPreferred) {
          reason = `${room.display_name} is available at this time.`;
        } else if (staffId && staff) {
          reason = `Next available time for ${staff.full_name.trim() || "this provider"}.`;
        } else {
          reason = `Next available time in ${room.display_name}.`;
        }

        const slot: NextAvailableBookingSlot = {
          startAt: startIso,
          endAt: endIso,
          roomId: room.id,
          roomLabel: room.display_name,
          reason,
        };
        if (staffId && staff) {
          slot.staffId = staffId;
          slot.staffLabel = staff.full_name.trim() || undefined;
        }
        slots.push(slot);
      }
    }
  }

  return { slots };
}
