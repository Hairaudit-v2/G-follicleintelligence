/**
 * CalendarOS V2 — resource-first layout model (pure, no I/O).
 * Week: staff/resources as rows, days as columns.
 * Day: staff/resources as columns, time down the left.
 */

import type { ParsedCalendarQuery } from "@/src/lib/bookings/calendarQuery";
import type { CalendarDayLane } from "@/src/lib/bookings/calendarView";
import type { FiBookingRow } from "@/src/lib/bookings/types";
import type { ClinicalStaffPickerOption } from "@/src/lib/team/directory";
import {
  operationalResourceColumnIdForBooking,
} from "@/src/lib/calendar/operationalCalendarColumns";
import {
  layoutBookingInBusinessDayUtc,
  resolveDisplayResourceColumnId,
  type BusinessGridConfig,
} from "@/src/lib/calendar/operationalCalendarLayout";
import type { FiClinicRoomRow } from "@/src/lib/rooms/roomTypes";
import type { OperationalCalendarResourceColumn } from "@/src/lib/calendar/operationalCalendarTypes";
import type {
  CalendarOsAvailabilityBlockInput,
  CalendarOsWorkforceBlock,
  CalendarOsWorkforceBlockKind,
} from "@/src/lib/calendar-os/calendarWorkforceBlocks";
import { deriveWorkforceBlocksForStaffRow as deriveWorkforceBlocksForStaffRowImpl } from "@/src/lib/calendar-os/calendarWorkforceBlocks";
import { STAFF_WEEKDAY_KEYS, type StaffWeekdayKey } from "@/src/lib/team/roster/availability";

export type {
  CalendarOsAvailabilityBlockInput,
  CalendarOsWorkforceBlock,
  CalendarOsWorkforceBlockKind,
} from "@/src/lib/calendar-os/calendarWorkforceBlocks";

export { STAFF_WEEKDAY_KEYS, type StaffWeekdayKey };

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

export type CalendarOsResourceUtilisation = {
  bookingCount: number;
  bookedMinutes: number;
  /** 0–100 utilisation vs a nominal 8h day. */
  percent: number;
  level: "low" | "moderate" | "high" | "full";
};

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
  utilisation?: CalendarOsResourceUtilisation;
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
      return type.includes("consultation") || type === "trichology" || type === "review";
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
    col.kind === "fi_staff" && staff ? mapStaffRoleToCalendarOsGroup(staff.staff_role) : "doctors";
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

  const out: {
    group: CalendarOsResourceRoleGroup;
    label: string;
    rows: CalendarOsResourceRow[];
  }[] = [];
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

export function mapBookingsToWeekResourceCells(
  input: CalendarOsResourceModelInput
): CalendarOsWeekCell[] {
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
  availabilityBlocks?: CalendarOsAvailabilityBlockInput[];
  staffTimezone?: string | null;
}): CalendarOsWorkforceBlock[] {
  return deriveWorkforceBlocksForStaffRowImpl(input);
}

export function calendarOsDefaultViewForQuery(query: ParsedCalendarQuery): "day" | "week" {
  if (query.view === "day" || query.view === "3day") return "day";
  return "week";
}

const NOMINAL_DAY_MINUTES = 8 * 60;

export function deriveCalendarOsResourceUtilisation(
  bookingIds: string[],
  bookings: FiBookingRow[]
): CalendarOsResourceUtilisation {
  let bookedMinutes = 0;
  for (const id of bookingIds) {
    const b = bookings.find((x) => x.id === id);
    if (!b) continue;
    const start = Date.parse(b.start_at);
    const end = Date.parse(b.end_at);
    if (!Number.isFinite(start) || !Number.isFinite(end) || end <= start) continue;
    bookedMinutes += Math.round((end - start) / 60_000);
  }
  const percent = Math.min(100, Math.round((bookedMinutes / NOMINAL_DAY_MINUTES) * 100));
  let level: CalendarOsResourceUtilisation["level"] = "low";
  if (percent >= 90) level = "full";
  else if (percent >= 65) level = "high";
  else if (percent >= 35) level = "moderate";
  return { bookingCount: bookingIds.length, bookedMinutes, percent, level };
}

export function attachUtilisationToResourceRows(
  rows: CalendarOsResourceRow[],
  cells: CalendarOsWeekCell[],
  bookings: FiBookingRow[],
  dayKey?: string
): CalendarOsResourceRow[] {
  const byResource = new Map<string, string[]>();
  for (const cell of cells) {
    if (dayKey && cell.dayKey !== dayKey) continue;
    const list = byResource.get(cell.resourceId) ?? [];
    for (const id of cell.bookingIds) {
      if (!list.includes(id)) list.push(id);
    }
    byResource.set(cell.resourceId, list);
  }
  return rows.map((row) => ({
    ...row,
    utilisation: deriveCalendarOsResourceUtilisation(byResource.get(row.id) ?? [], bookings),
  }));
}

export function staffInitialsFromLabel(label: string): string {
  const parts = label.trim().split(/\s+/).filter(Boolean);
  if (parts.length === 0) return "?";
  if (parts.length === 1) return parts[0]!.slice(0, 2).toUpperCase();
  return `${parts[0]![0] ?? ""}${parts[parts.length - 1]![0] ?? ""}`.toUpperCase();
}
