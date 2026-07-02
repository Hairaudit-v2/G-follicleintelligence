/**
 * CalendarOS V2 — resource-first layout model (pure, no I/O).
 * Week: staff/resources as rows, days as columns.
 * Day: staff/resources as columns, time down the left.
 */

import type { ParsedCalendarQuery } from "@/src/lib/bookings/calendarQuery";
import type { CalendarDayLane } from "@/src/lib/bookings/calendarView";
import type { FiBookingRow } from "@/src/lib/bookings/types";
import type { ClinicalStaffPickerOption } from "@/src/lib/staff/clinicalStaffPicker";
import {
  operationalResourceColumnIdForBooking,
  staffColumnId,
} from "@/src/lib/calendar/operationalCalendarColumns";
import {
  layoutBookingInBusinessDayUtc,
  resolveDisplayResourceColumnId,
  type BusinessGridConfig,
} from "@/src/lib/calendar/operationalCalendarLayout";
import type { FiClinicRoomRow } from "@/src/lib/rooms/roomTypes";
import type { OperationalCalendarResourceColumn } from "@/src/lib/calendar/operationalCalendarTypes";
import {
  parseStaffWeeklyHours,
  type StaffWeekdayKey,
  STAFF_WEEKDAY_KEYS,
} from "@/src/lib/staff/staffWeeklyHours";
import { weekdayKeyFromDayKey } from "@/src/lib/calendar-os/calendarWorkforceBlocks";

export const CALENDAR_OS_RESOURCE_ROLE_GROUPS = [
  "surgeons",
  "doctors",
  "nurses",
  "surgical_assistants",
  "reception_admin",
  "rooms",
  "unassigned",
] as const;

export type CalendarOsResourceRoleGroup = (typeof CALENDAR_OS_RESOURCE_ROLE_GROUPS)[number];

export const CALENDAR_OS_RESOURCE_ROLE_GROUP_LABELS: Record<CalendarOsResourceRoleGroup, string> = {
  surgeons: "Surgeons",
  doctors: "Doctors",
  nurses: "Nurses",
  surgical_assistants: "Surgical Assistants",
  reception_admin: "Reception / Admin",
  rooms: "Rooms",
  unassigned: "Unassigned",
};

export type CalendarOsViewMode =
  | "staff"
  | "room"
  | "clinic"
  | "consultations"
  | "prp"
  | "surgery"
  | "follow_up"
  | "doctor"
  | "nurse"
  | "clinic_room";

export type CalendarOsResourceRow = {
  id: string;
  kind: OperationalCalendarResourceColumn["kind"] | "role_group_header";
  label: string;
  subtitle: string | null;
  roleGroup: CalendarOsResourceRoleGroup;
  staffId?: string;
  roomId?: string;
  clinicallyAvailable?: boolean;
  readinessWarning?: string | null;
  isGroupHeader?: boolean;
};

export type CalendarOsWeekCell = {
  resourceId: string;
  dayKey: string;
  bookingIds: string[];
};

export type CalendarOsDayPlacement = {
  bookingId: string;
  resourceId: string;
  topPx: number;
  heightPx: number;
};

export type CalendarOsWorkforceBlockKind = "rdo" | "leave" | "lunch" | "unavailable" | "working_hours";

export type CalendarOsWorkforceBlock = {
  id: string;
  resourceId: string;
  dayKey: string;
  kind: CalendarOsWorkforceBlockKind;
  label: string;
  /** Day view vertical placement when applicable. */
  topPx?: number;
  heightPx?: number;
};

export type CalendarOsResourceModelInput = {
  query: ParsedCalendarQuery;
  lanes: CalendarDayLane[];
  bookings: FiBookingRow[];
  resourceColumns: OperationalCalendarResourceColumn[];
  staffDirectory: ClinicalStaffPickerOption[];
  rooms: FiClinicRoomRow[];
  staffIdByUserId: Map<string, string>;
  gridConfig: BusinessGridConfig;
};

export function mapStaffRoleToCalendarOsGroup(
  staffRole: string | null | undefined
): CalendarOsResourceRoleGroup {
  const role = String(staffRole ?? "")
    .trim()
    .toLowerCase();
  if (!role) return "doctors";
  if (role.includes("surgeon")) return "surgeons";
  if (role.includes("nurse")) return "nurses";
  if (
    role.includes("assistant") ||
    role.includes("technician") ||
    role.includes("scrub") ||
    role.includes("surgical")
  ) {
    return "surgical_assistants";
  }
  if (
    role.includes("reception") ||
    role.includes("admin") ||
    role.includes("coordinator") ||
    role.includes("finance")
  ) {
    return "reception_admin";
  }
  if (role.includes("doctor") || role.includes("consultant") || role.includes("trichologist")) {
    return "doctors";
  }
  return "doctors";
}

export function calendarOsViewModeFromQuery(query: ParsedCalendarQuery): CalendarOsViewMode {
  const type = query.bookingType?.trim().toLowerCase();
  if (type === "consultation" || type === "hair_transplant_consultation") return "consultations";
  if (type === "prp" || type === "prf") return "prp";
  if (type === "surgery") return "surgery";
  if (type === "follow_up" || type === "review") return "follow_up";
  if (query.staffRoleBucket === "doctor") return "doctor";
  if (query.staffRoleBucket === "nurse") return "nurse";
  if (query.resourceView === "room") return query.roomId ? "clinic_room" : "room";
  if (query.resourceView === "clinic") return "clinic";
  return "staff";
}

export function bookingMatchesCalendarOsViewMode(
  booking: FiBookingRow,
  mode: CalendarOsViewMode
): boolean {
  const type = booking.booking_type.trim().toLowerCase();
  switch (mode) {
    case "consultations":
      return (
        type.includes("consultation") ||
        type === "trichology" ||
        type === "review"
      );
    case "prp":
      return type === "prp" || type === "prf" || type === "mesotherapy" || type === "exosomes";
    case "surgery":
      return type === "surgery";
    case "follow_up":
      return type === "follow_up" || type === "review";
    case "doctor":
    case "nurse":
    case "staff":
    case "room":
    case "clinic":
    case "clinic_room":
      return true;
    default:
      return true;
  }
}

export function filterBookingsForCalendarOsView(
  bookings: FiBookingRow[],
  query: ParsedCalendarQuery
): FiBookingRow[] {
  const mode = calendarOsViewModeFromQuery(query);
  return bookings.filter((b) => bookingMatchesCalendarOsViewMode(b, mode));
}

function roomResourceRow(room: FiClinicRoomRow): CalendarOsResourceRow {
  return {
    id: `r:${room.id}`,
    kind: "room",
    label: room.display_name?.trim() || room.room_code?.trim() || "Room",
    subtitle: room.room_type?.trim() || null,
    roleGroup: "rooms",
    roomId: room.id,
    clinicallyAvailable: room.is_active !== false,
    readinessWarning: room.is_active === false ? "Inactive room" : null,
  };
}

function columnToResourceRow(
  col: OperationalCalendarResourceColumn,
  staffById?: Map<string, ClinicalStaffPickerOption>
): CalendarOsResourceRow {
  if (col.id === "unassigned") {
    return {
      id: "unassigned",
      kind: "unassigned",
      label: col.label,
      subtitle: col.subtitle,
      roleGroup: "unassigned",
    };
  }
  if (col.kind === "room") {
    return {
      id: col.id,
      kind: "room",
      label: col.label,
      subtitle: col.subtitle,
      roleGroup: "rooms",
      roomId: col.id.startsWith("r:") ? col.id.slice(2) : undefined,
      clinicallyAvailable: col.clinicallyAvailable,
      readinessWarning: col.readinessWarning,
    };
  }
  const staffId = col.staffId ?? (col.id.startsWith("s:") ? col.id.slice(2) : undefined);
  const staff = staffId ? staffById?.get(staffId) : undefined;
  const roleGroup =
    col.kind === "fi_staff" && staff
      ? mapStaffRoleToCalendarOsGroup(staff.staff_role)
      : "doctors";
  return {
    id: col.id,
    kind: col.kind,
    label: col.label,
    subtitle: col.subtitle,
    roleGroup,
    staffId,
    clinicallyAvailable: col.clinicallyAvailable,
    readinessWarning: col.readinessWarning,
  };
}

export function buildCalendarOsResourceRows(input: {
  query: ParsedCalendarQuery;
  resourceColumns: OperationalCalendarResourceColumn[];
  staffDirectory: ClinicalStaffPickerOption[];
  rooms: FiClinicRoomRow[];
}): CalendarOsResourceRow[] {
  const { query, resourceColumns, staffDirectory, rooms } = input;
  const staffById = new Map(staffDirectory.map((s) => [String(s.id), s]));

  if (query.resourceView === "room") {
    const roomRows =
      resourceColumns.length > 0
        ? resourceColumns
            .filter((c) => c.kind === "room" || c.id === "unassigned")
            .map((c) => {
              if (c.id === "unassigned") {
                return columnToResourceRow(c, staffById);
              }
              const roomId = c.id.startsWith("r:") ? c.id.slice(2) : c.id;
              const room = rooms.find((r) => r.id === roomId);
              return room
                ? roomResourceRow(room)
                : {
                    ...columnToResourceRow(c, staffById),
                    roleGroup: "rooms" as const,
                  };
            })
        : rooms.filter((r) => r.is_active !== false).map(roomResourceRow);
    const unassigned = resourceColumns.find((c) => c.id === "unassigned");
    if (unassigned && !roomRows.some((r) => r.id === "unassigned")) {
      roomRows.push(columnToResourceRow(unassigned, staffById));
    }
    return roomRows;
  }

  const rows: CalendarOsResourceRow[] = [];
  for (const col of resourceColumns) {
    if (col.id === "unassigned") continue;
    const staffId = col.staffId ?? (col.id.startsWith("s:") ? col.id.slice(2) : undefined);
    const staff = staffId ? staffById.get(staffId) : undefined;
    const roleGroup = staff
      ? mapStaffRoleToCalendarOsGroup(staff.staff_role)
      : col.kind === "room"
        ? "rooms"
        : "doctors";
    rows.push({
      id: col.id,
      kind: col.kind,
      label: col.label,
      subtitle: col.subtitle,
      roleGroup,
      staffId,
      clinicallyAvailable: col.clinicallyAvailable,
      readinessWarning: col.readinessWarning,
    });
  }

  const unassignedCol = resourceColumns.find((c) => c.id === "unassigned");
  if (unassignedCol) {
    rows.push({
      id: "unassigned",
      kind: "unassigned",
      label: unassignedCol.label,
      subtitle: unassignedCol.subtitle,
      roleGroup: "unassigned",
    });
  }

  return rows;
}

export function groupCalendarOsResourceRowsByRole(
  rows: CalendarOsResourceRow[]
): { group: CalendarOsResourceRoleGroup; label: string; rows: CalendarOsResourceRow[] }[] {
  const grouped = new Map<CalendarOsResourceRoleGroup, CalendarOsResourceRow[]>();
  for (const row of rows) {
    const list = grouped.get(row.roleGroup) ?? [];
    list.push(row);
    grouped.set(row.roleGroup, list);
  }

  const out: { group: CalendarOsResourceRoleGroup; label: string; rows: CalendarOsResourceRow[] }[] =
    [];
  for (const group of CALENDAR_OS_RESOURCE_ROLE_GROUPS) {
    const list = grouped.get(group);
    if (!list?.length) continue;
    list.sort((a, b) => a.label.localeCompare(b.label));
    out.push({
      group,
      label: CALENDAR_OS_RESOURCE_ROLE_GROUP_LABELS[group],
      rows: list,
    });
  }
  return out;
}

export function mapBookingsToWeekResourceCells(input: CalendarOsResourceModelInput): CalendarOsWeekCell[] {
  const visibleIds = new Set(input.resourceColumns.map((c) => c.id));
  const filtered = filterBookingsForCalendarOsView(input.bookings, input.query);
  const cellMap = new Map<string, CalendarOsWeekCell>();

  for (const booking of filtered) {
    for (const lane of input.lanes) {
      const startMs = Date.parse(booking.start_at);
      const endMs = Date.parse(booking.end_at);
      if (!Number.isFinite(startMs) || !Number.isFinite(endMs)) continue;
      if (endMs <= lane.startMs || startMs >= lane.endMs) continue;

      const resourceId = resolveDisplayResourceColumnId(booking, visibleIds, {
        resourceView: input.query.resourceView,
        staffIdByUserId: input.staffIdByUserId,
      });
      const key = `${resourceId}|${lane.dayKey}`;
      const existing = cellMap.get(key) ?? { resourceId, dayKey: lane.dayKey, bookingIds: [] };
      if (!existing.bookingIds.includes(booking.id)) {
        existing.bookingIds.push(booking.id);
      }
      cellMap.set(key, existing);
    }
  }

  for (const cell of cellMap.values()) {
    cell.bookingIds.sort((a, b) => {
      const ba = input.bookings.find((x) => x.id === a);
      const bb = input.bookings.find((x) => x.id === b);
      return Date.parse(ba?.start_at ?? "") - Date.parse(bb?.start_at ?? "");
    });
  }

  return Array.from(cellMap.values());
}

export function mapBookingsToDayResourcePlacements(
  input: CalendarOsResourceModelInput & { lane: CalendarDayLane }
): CalendarOsDayPlacement[] {
  const visibleIds = new Set(input.resourceColumns.map((c) => c.id));
  const filtered = filterBookingsForCalendarOsView(input.bookings, input.query);
  const out: CalendarOsDayPlacement[] = [];

  for (const booking of filtered) {
    const layout = layoutBookingInBusinessDayUtc(booking, input.lane, input.gridConfig);
    if (!layout) continue;
    const resourceId = resolveDisplayResourceColumnId(booking, visibleIds, {
      resourceView: input.query.resourceView,
      staffIdByUserId: input.staffIdByUserId,
    });
    out.push({
      bookingId: booking.id,
      resourceId,
      topPx: layout.topPx,
      heightPx: layout.heightPx,
    });
  }

  return out;
}

export function isBookingUnassignedForCalendarOs(booking: FiBookingRow): boolean {
  return (
    !booking.assigned_staff_id?.trim() &&
    !booking.assigned_user_id?.trim() &&
    operationalResourceColumnIdForBooking(booking) === "unassigned"
  );
}

export function deriveWorkforceBlocksForStaffRow(input: {
  staff: ClinicalStaffPickerOption;
  dayKey: string;
  gridConfig: BusinessGridConfig;
  lane: CalendarDayLane;
}): CalendarOsWorkforceBlock[] {
  const { staff, dayKey, gridConfig, lane } = input;
  const resourceId = staffColumnId(String(staff.id));
  const blocks: CalendarOsWorkforceBlock[] = [];
  const weekday = weekdayKeyFromDayKey(dayKey, gridConfig.timeZone);
  const weekly = parseStaffWeeklyHours(staff.working_hours ?? null);
  const dayHours = weekday ? weekly[weekday] : undefined;

  if (!staff.is_active) {
    blocks.push({
      id: `${resourceId}:${dayKey}:inactive`,
      resourceId,
      dayKey,
      kind: "unavailable",
      label: "Inactive",
    });
    return blocks;
  }

  const readiness = staff.clinical_readiness;
  if (readiness && !readiness.clinically_available) {
    blocks.push({
      id: `${resourceId}:${dayKey}:readiness`,
      resourceId,
      dayKey,
      kind: "leave",
      label: readiness.block_reason ?? readiness.warning_label ?? "Unavailable",
    });
  }

  if (weekday && dayHours && dayHours.enabled === false) {
    blocks.push({
      id: `${resourceId}:${dayKey}:rdo`,
      resourceId,
      dayKey,
      kind: "rdo",
      label: "RDO",
    });
  }

  if (weekday && dayHours?.start && dayHours?.end && dayHours.enabled !== false) {
    const lunchStartMin = parseHmToMinutes("12:00");
    const lunchEndMin = parseHmToMinutes("13:00");
    const workStart = parseHmToMinutes(dayHours.start);
    const workEnd = parseHmToMinutes(dayHours.end);
    if (
      lunchStartMin != null &&
      lunchEndMin != null &&
      workStart != null &&
      workEnd != null &&
      lunchStartMin >= workStart &&
      lunchEndMin <= workEnd
    ) {
      const placement = minutesRangeToDayPlacement(
        lane,
        gridConfig,
        lunchStartMin,
        lunchEndMin - lunchStartMin
      );
      if (placement) {
        blocks.push({
          id: `${resourceId}:${dayKey}:lunch`,
          resourceId,
          dayKey,
          kind: "lunch",
          label: "Lunch",
          topPx: placement.topPx,
          heightPx: placement.heightPx,
        });
      }
    }
  }

  return blocks;
}

function parseHmToMinutes(hm: string): number | null {
  const m = /^([01]\d|2[0-3]):([0-5]\d)$/.exec(hm.trim());
  if (!m) return null;
  return Number(m[1]) * 60 + Number(m[2]);
}

function minutesRangeToDayPlacement(
  lane: CalendarDayLane,
  cfg: BusinessGridConfig,
  startMinFromMidnight: number,
  durationMin: number
): { topPx: number; heightPx: number } | null {
  const gridStart = cfg.dayStartHourUtc * 60;
  const gridEnd = cfg.dayEndHourUtc * 60;
  const visStart = Math.max(startMinFromMidnight, gridStart);
  const visEnd = Math.min(startMinFromMidnight + durationMin, gridEnd);
  if (visEnd <= visStart) return null;
  const pxPerMin = 44 / 60;
  return {
    topPx: (visStart - gridStart) * pxPerMin,
    heightPx: Math.max((visEnd - visStart) * pxPerMin, 12),
  };
}

export function calendarOsDefaultViewForQuery(query: ParsedCalendarQuery): "day" | "week" {
  if (query.view === "day" || query.view === "3day") return "day";
  return "week";
}

export { STAFF_WEEKDAY_KEYS, type StaffWeekdayKey };
