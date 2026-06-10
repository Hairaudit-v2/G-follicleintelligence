import "server-only";

import type { SupabaseClient } from "@supabase/supabase-js";

import { supabaseAdmin } from "@/lib/supabaseAdmin";
import { assertNonEmptyUuid } from "@/src/lib/crm/validation";
import { AppointmentStaffHoursError } from "@/src/lib/bookings/bookingErrors";
import { assertStaffAppointmentWithinWorkingHours } from "@/src/lib/staff/staffSlotHours.server";
import { loadStaffMemberForTenant } from "@/src/lib/staff/staff.server";
import { toDatetimeLocalValueInTimezone } from "@/src/lib/calendar/calendarTimezone";
import { loadTenantOperationalCalendarSettings } from "@/src/lib/calendar/tenantOperationalCalendarSettings.server";
import {
  assertServiceStaffEligible,
  filterRoomEligibilityForClinic,
  loadOverlappingBookingsForRange,
  resolveDefaultRoomForService,
  ServiceStaffEligibilityError,
} from "@/src/lib/rooms/roomAvailability.server";
import {
  buildRoomOverlapContext,
  findRoomOverlapConflictWithAssignments,
  findStaffOverlapConflictWithAssignments,
} from "@/src/lib/rooms/roomAvailabilityCore";
import {
  loadClinicRoomForTenant,
  loadClinicRoomsForTenant,
  loadServiceRoomEligibilityForService,
  resolveServiceIdForBookingType,
} from "@/src/lib/rooms/fiClinicRooms.server";
import { loadBookingResourceAssignmentsOverlapByBooking } from "@/src/lib/bookings/bookingResourceAssignmentsOverlap.server";
import { BOOKING_CONFLICT_PREVIEW_CALM_INCOMPLETE_MESSAGE } from "@/src/lib/calendar/bookingConflictPreviewConstants";

export type BookingConflictMessageType = "room" | "staff" | "service" | "hours" | "clinic";

export type BookingConflictSeverity = "info" | "warning" | "error";

export type BookingConflictMessage = {
  type: BookingConflictMessageType;
  severity: BookingConflictSeverity;
  message: string;
};

export type BookingConflictPreviewStatus = "available" | "warning" | "blocked";

export type BookingConflictPreviewResult = {
  status: BookingConflictPreviewStatus;
  messages: BookingConflictMessage[];
};

export type BookingConflictPreviewIntent = "quick_create" | "edit";

export type BookingConflictPreviewInput = {
  tenantId: string;
  clinicId?: string | null;
  serviceId?: string | null;
  bookingType?: string | null;
  roomId?: string | null;
  /** Mirrors `fi_bookings.room_required` (defaults true, same as save). */
  roomRequired?: boolean;
  staffId?: string | null;
  /** Exclude this booking from overlap checks (edit/reschedule). */
  bookingId?: string | null;
  startAt: string;
  endAt: string;
  client?: SupabaseClient;
  /**
   * `quick_create`: incomplete context returns a calm warning instead of blocked room-required noise.
   * `edit` (default): strict preview, including data-integrity cases (e.g. missing room on an existing row).
   */
  previewIntent?: BookingConflictPreviewIntent;
  /** Draft extra staff/rooms (multi-resource). Primary `staffId` / `roomId` still validated separately. */
  extraResourceAssignments?: Array<{
    resource_type: "staff" | "room";
    resource_id: string;
  }> | null;
};

function statusFromMessages(messages: BookingConflictMessage[]): BookingConflictPreviewStatus {
  if (messages.some((m) => m.severity === "error")) return "blocked";
  if (messages.some((m) => m.severity === "warning")) return "warning";
  return "available";
}

function localMinutesOfDay(iso: string, timeZone: string): { dayKey: string; minutes: number } | null {
  const local = toDatetimeLocalValueInTimezone(iso, timeZone);
  if (!local) return null;
  const hour = Number(local.slice(11, 13));
  const minute = Number(local.slice(14, 16));
  if (!Number.isFinite(hour) || !Number.isFinite(minute)) return null;
  return { dayKey: local.slice(0, 10), minutes: hour * 60 + minute };
}

function formatGridHour(hour: number): string {
  return `${String(Math.max(0, Math.min(24, Math.floor(hour)))).padStart(2, "0")}:00`;
}

/**
 * Non-throwing preview of every save-time booking resource check (room overlap including shared
 * physical rooms, staff overlap, service room/staff eligibility, staff working hours) plus an
 * advisory clinic-hours check. Reuses the same core logic as
 * {@link assertBookingResourceAvailability} so preview and save never disagree.
 */
export async function previewBookingConflicts(
  input: BookingConflictPreviewInput
): Promise<BookingConflictPreviewResult> {
  const tid = assertNonEmptyUuid(input.tenantId, "tenantId");
  const client = input.client ?? supabaseAdmin();
  const messages: BookingConflictMessage[] = [];

  const intent: BookingConflictPreviewIntent = input.previewIntent ?? "edit";

  const startAt = input.startAt.trim();
  const endAt = input.endAt.trim();
  const startMs = Date.parse(startAt);
  const endMs = Date.parse(endAt);
  const timesValid = Number.isFinite(startMs) && Number.isFinite(endMs) && endMs > startMs;

  const clinicId = input.clinicId?.trim() || null;
  const hasServiceContext = Boolean(input.bookingType?.trim() || input.serviceId?.trim());

  if (intent === "quick_create") {
    if (!hasServiceContext || !clinicId || !timesValid) {
      return {
        status: "warning",
        messages: [
          {
            type: "service",
            severity: "info",
            message: BOOKING_CONFLICT_PREVIEW_CALM_INCOMPLETE_MESSAGE,
          },
        ],
      };
    }
  } else if (!timesValid) {
    return {
      status: "blocked",
      messages: [{ type: "hours", severity: "error", message: "End time must be after the start time." }],
    };
  }

  const roomId = input.roomId?.trim() || null;
  const staffId = input.staffId?.trim() || null;
  const bookingId = input.bookingId?.trim() || null;
  const roomRequired = input.roomRequired !== false;

  let serviceId = input.serviceId?.trim() || null;
  if (!serviceId && input.bookingType?.trim()) {
    serviceId = await resolveServiceIdForBookingType(tid, input.bookingType.trim(), client);
  }

  const [rooms, roomEligibility, staff, calendarSettings] = await Promise.all([
    clinicId ? loadClinicRoomsForTenant(tid, { clinicId }, client) : Promise.resolve([]),
    serviceId
      ? loadServiceRoomEligibilityForService(tid, serviceId, client)
      : Promise.resolve([]),
    staffId ? loadStaffMemberForTenant(tid, staffId, client) : Promise.resolve(null),
    loadTenantOperationalCalendarSettings(tid).catch(() => null),
  ]);

  const existing = await loadOverlappingBookingsForRange(tid, startAt, endAt, client);
  const assignmentByBooking = await loadBookingResourceAssignmentsOverlapByBooking(
    tid,
    existing.map((b) => b.id),
    client
  );

  // Staff checks: eligibility, working hours, overlap.
  if (staffId) {
    if (!staff) {
      messages.push({
        type: "staff",
        severity: "error",
        message: "Selected staff member could not be found for this clinic.",
      });
    } else {
      try {
        await assertServiceStaffEligible({
          tenantId: tid,
          serviceId,
          bookingType: input.bookingType,
          staffId,
          client,
        });
      } catch (e) {
        if (e instanceof ServiceStaffEligibilityError) {
          messages.push({ type: "service", severity: "error", message: e.message });
        } else {
          throw e;
        }
      }

      try {
        await assertStaffAppointmentWithinWorkingHours(tid, staffId, startAt, endAt, client);
      } catch (e) {
        if (e instanceof AppointmentStaffHoursError) {
          messages.push({ type: "hours", severity: "error", message: e.message });
        } else {
          throw e;
        }
      }

      const staffConflict = findStaffOverlapConflictWithAssignments({
        candidateStaffId: staffId,
        candidateStartIso: startAt,
        candidateEndIso: endAt,
        existing,
        assignmentsByBookingId: assignmentByBooking,
        excludeBookingId: bookingId,
      });
      if (staffConflict) {
        messages.push({
          type: "staff",
          severity: "error",
          message: `${staff.full_name} is already assigned to another appointment at this time.`,
        });
      }
    }
  }

  // Room checks: clinic membership, active flag, service eligibility, overlap (incl. shared physical room).
  if (roomId) {
    const room =
      rooms.find((r) => r.id === roomId) ?? (await loadClinicRoomForTenant(tid, roomId, client));
    if (!room) {
      messages.push({ type: "room", severity: "error", message: "Selected room could not be found for this clinic." });
    } else if (clinicId && room.clinic_id !== clinicId) {
      messages.push({
        type: "room",
        severity: "error",
        message: `${room.display_name} does not belong to the selected clinic.`,
      });
    } else if (!room.is_active) {
      messages.push({
        type: "room",
        severity: "error",
        message: `${room.display_name} is inactive and cannot be booked.`,
      });
    } else {
      if (serviceId && clinicId) {
        const activeRules = filterRoomEligibilityForClinic(roomEligibility, clinicId);
        if (activeRules.length > 0 && !activeRules.some((e) => e.room_id === roomId)) {
          messages.push({
            type: "service",
            severity: "error",
            message: `This service is not eligible for ${room.display_name}.`,
          });
        }
      }

      const ctx = buildRoomOverlapContext(rooms.length > 0 ? rooms : [room]);
      const conflict = findRoomOverlapConflictWithAssignments({
        candidateRoomId: roomId,
        candidateStartIso: startAt,
        candidateEndIso: endAt,
        existing,
        ctx,
        assignmentsByBookingId: assignmentByBooking,
        excludeBookingId: bookingId,
      });
      if (conflict) {
        const conflictRoomId = conflict.room_id?.trim() || null;
        if (conflictRoomId && conflictRoomId !== roomId) {
          const sibling = ctx.roomsById.get(conflictRoomId);
          const siblingName = sibling?.display_name ?? "Another room";
          messages.push({
            type: "room",
            severity: "error",
            message: `${siblingName} shares the same physical room as ${room.display_name} and is already booked at this time.`,
          });
        } else {
          messages.push({
            type: "room",
            severity: "error",
            message: `${room.display_name} is already booked at this time.`,
          });
        }
      }
    }
  } else if (roomRequired) {
    // Mirror save: a default room is auto-assigned when possible, otherwise save fails.
    const autoRoomId =
      clinicId != null
        ? await resolveDefaultRoomForService({
            tenantId: tid,
            clinicId,
            serviceId,
            bookingType: input.bookingType,
            startAt,
            endAt,
            bookingId,
            client,
          })
        : null;
    if (autoRoomId) {
      const autoRoom = rooms.find((r) => r.id === autoRoomId);
      messages.push({
        type: "room",
        severity: "info",
        message: `${autoRoom?.display_name ?? "An eligible room"} will be assigned automatically when you save.`,
      });
    } else if (clinicId) {
      messages.push({
        type: "room",
        severity: "error",
        message: "No eligible room is available at this time. Pick another time or room.",
      });
    } else if (intent !== "quick_create") {
      messages.push({
        type: "room",
        severity: "error",
        message: "A room must be assigned before saving. Select a clinic so a room can be allocated.",
      });
    }
  }

  const extras = input.extraResourceAssignments ?? [];
  if (extras.length > 0 && timesValid) {
    const seenStaff = new Set<string>();
    if (staffId) seenStaff.add(staffId);
    const seenRooms = new Set<string>();
    if (roomId) seenRooms.add(roomId);

    for (const x of extras) {
      if (x.resource_type === "staff") {
        const sid = x.resource_id.trim();
        if (!sid || seenStaff.has(sid)) continue;
        seenStaff.add(sid);
        const s = await loadStaffMemberForTenant(tid, sid, client);
        if (!s) {
          messages.push({
            type: "staff",
            severity: "error",
            message: "A selected team member could not be found for this clinic.",
          });
          continue;
        }
        try {
          await assertServiceStaffEligible({
            tenantId: tid,
            serviceId,
            bookingType: input.bookingType,
            staffId: sid,
            client,
          });
        } catch (e) {
          if (e instanceof ServiceStaffEligibilityError) {
            messages.push({ type: "service", severity: "error", message: e.message });
          } else {
            throw e;
          }
        }
        try {
          await assertStaffAppointmentWithinWorkingHours(tid, sid, startAt, endAt, client);
        } catch (e) {
          if (e instanceof AppointmentStaffHoursError) {
            messages.push({ type: "hours", severity: "error", message: e.message });
          } else {
            throw e;
          }
        }
        const hit = findStaffOverlapConflictWithAssignments({
          candidateStaffId: sid,
          candidateStartIso: startAt,
          candidateEndIso: endAt,
          existing,
          assignmentsByBookingId: assignmentByBooking,
          excludeBookingId: bookingId,
        });
        if (hit) {
          messages.push({
            type: "staff",
            severity: "error",
            message: `${s.full_name.trim() || "This team member"} is already assigned to another appointment at this time.`,
          });
        }
      } else if (x.resource_type === "room") {
        const rid = x.resource_id.trim();
        if (!rid || seenRooms.has(rid)) continue;
        seenRooms.add(rid);
        const rrow =
          rooms.find((r) => r.id === rid) ?? (clinicId ? await loadClinicRoomForTenant(tid, rid, client) : null);
        if (!rrow) {
          messages.push({ type: "room", severity: "error", message: "A selected extra room could not be found." });
          continue;
        }
        if (clinicId && rrow.clinic_id !== clinicId) {
          messages.push({
            type: "room",
            severity: "error",
            message: `${rrow.display_name} does not belong to the selected clinic.`,
          });
        } else if (!rrow.is_active) {
          messages.push({
            type: "room",
            severity: "error",
            message: `${rrow.display_name} is inactive and cannot be booked.`,
          });
        } else {
          if (serviceId && clinicId) {
            const activeRules = filterRoomEligibilityForClinic(roomEligibility, clinicId);
            if (activeRules.length > 0 && !activeRules.some((e) => e.room_id === rid)) {
              messages.push({
                type: "service",
                severity: "error",
                message: `This service is not eligible for ${rrow.display_name}.`,
              });
            }
          }
          const ctx = buildRoomOverlapContext(rooms.length > 0 ? rooms : [rrow]);
          const conflict = findRoomOverlapConflictWithAssignments({
            candidateRoomId: rid,
            candidateStartIso: startAt,
            candidateEndIso: endAt,
            existing,
            ctx,
            assignmentsByBookingId: assignmentByBooking,
            excludeBookingId: bookingId,
          });
          if (conflict) {
            messages.push({
              type: "room",
              severity: "error",
              message: `${rrow.display_name} is already booked at this time (including shared physical room).`,
            });
          }
        }
      }
    }
  }

  // Advisory clinic-hours check (calendar grid hours are not enforced on save).
  if (calendarSettings) {
    const { dayStartHourUtc, dayEndHourUtc, timeZone } = calendarSettings.gridConfig;
    const start = localMinutesOfDay(startAt, timeZone);
    const end = localMinutesOfDay(endAt, timeZone);
    if (start && end) {
      const sameDay = start.dayKey === end.dayKey;
      const endsAtLocalMidnight = !sameDay && end.minutes === 0;
      const effectiveEndMinutes = sameDay ? end.minutes : endsAtLocalMidnight ? 24 * 60 : null;
      if (
        effectiveEndMinutes == null ||
        start.minutes < dayStartHourUtc * 60 ||
        effectiveEndMinutes > dayEndHourUtc * 60
      ) {
        messages.push({
          type: "clinic",
          severity: "warning",
          message: `This time falls outside the clinic's scheduled hours (${formatGridHour(dayStartHourUtc)}–${formatGridHour(dayEndHourUtc)}).`,
        });
      }
    }
  }

  return { status: statusFromMessages(messages), messages };
}
