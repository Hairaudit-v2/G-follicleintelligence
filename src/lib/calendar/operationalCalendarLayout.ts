/**
 * Pure layout helpers for FI Admin operational calendar (business-hour grid, clinic-local).
 */

import {
  bookingAssigneeIdentity,
  bookingAssigneeIdentitiesMatch,
  DEFAULT_APPOINTMENT_BUFFER_MINUTES,
} from "@/src/lib/bookings/appointmentAvailability";
import { isBookingCancelled } from "@/src/lib/bookings/bookingPolicy";

import type { CalendarDayLane } from "@/src/lib/bookings/calendarView";
import {
  isoFromLocalDayMinutes,
  localBusinessSlotIsoRange,
  parseCalendarDateString,
  zonedMidnightUtcMs,
} from "@/src/lib/calendar/calendarTimezone";
import type { FiBookingRow } from "@/src/lib/bookings/types";

export type BusinessGridConfig = {
  /** Clinic-local business day start hour (field name kept for DB compat). */
  dayStartHourUtc: number;
  /** Clinic-local business day end hour (exclusive). */
  dayEndHourUtc: number;
  /** Vertical resolution for drag snap + grid lines. */
  slotMinutes: 30 | 60;
  /** IANA timezone for grid hours and layout. */
  timeZone: string;
};

export const DEFAULT_BUSINESS_GRID: BusinessGridConfig = {
  dayStartHourUtc: 8,
  dayEndHourUtc: 18,
  slotMinutes: 30,
  timeZone: "UTC",
};

/**
 * `datetime-local` string for FI OS month empty-day quick create: clinic business open hour
 * (`dayStartHourUtc`, clinic-local wall time), or 09:00 when the configured hour is invalid.
 */
export function monthEmptyDayQuickCreateLocalStart(dayKey: string, cfg: BusinessGridConfig): string {
  const raw = cfg.dayStartHourUtc;
  const hour =
    Number.isFinite(raw) && raw >= 0 && raw <= 23 ? Math.floor(raw) : 9;
  const hh = String(hour).padStart(2, "0");
  return `${dayKey.trim()}T${hh}:00`;
}

/** Pixel height of one hour row (matches legacy FI calendar density). */
export const OPERATIONAL_CAL_PX_PER_HOUR = 44;

export function slotCount(cfg: BusinessGridConfig): number {
  const spanH = Math.max(1, cfg.dayEndHourUtc - cfg.dayStartHourUtc);
  return (spanH * 60) / cfg.slotMinutes;
}

export function businessGridBodyHeightPx(cfg: BusinessGridConfig): number {
  const hours = Math.max(1, cfg.dayEndHourUtc - cfg.dayStartHourUtc);
  return hours * OPERATIONAL_CAL_PX_PER_HOUR;
}

function minutesFromLaneStart(laneStartMs: number, ms: number): number {
  return Math.max(0, (ms - laneStartMs) / 60_000);
}

/**
 * Vertical placement within a lane, relative to business-hour window (clinic-local).
 * Returns null when the booking does not intersect the visible grid.
 */
export function layoutBookingInBusinessDayUtc(
  booking: FiBookingRow,
  lane: CalendarDayLane,
  cfg: BusinessGridConfig
): { topPx: number; heightPx: number } | null {
  const s = Date.parse(booking.start_at);
  const e = Date.parse(booking.end_at);
  if (!Number.isFinite(s) || !Number.isFinite(e)) return null;

  const laneStart = lane.startMs;
  const laneEnd = lane.endMs;
  const clampS = Math.max(s, laneStart);
  const clampE = Math.min(e, laneEnd);
  if (clampE <= clampS) return null;

  const gridStartMin = cfg.dayStartHourUtc * 60;
  const gridEndMin = cfg.dayEndHourUtc * 60;
  const startMin = minutesFromLaneStart(laneStart, clampS);
  const endMin = minutesFromLaneStart(laneStart, clampE);

  const visStart = Math.max(startMin, gridStartMin);
  const visEnd = Math.min(endMin, gridEndMin);
  if (visEnd <= visStart) return null;

  const pxPerMin = OPERATIONAL_CAL_PX_PER_HOUR / 60;
  const topPx = (visStart - gridStartMin) * pxPerMin;
  const heightPx = Math.max((visEnd - visStart) * pxPerMin, 20);
  return { topPx, heightPx };
}

/** ISO range for the business slot at `slotIndex` (0-based) on `dayKey` (clinic-local). */
export function utcBusinessSlotIsoRange(
  dayKey: string,
  slotIndex: number,
  cfg: BusinessGridConfig
): { startIso: string; endIso: string } | null {
  return localBusinessSlotIsoRange(dayKey, slotIndex, cfg, cfg.timeZone);
}

export function snapIsoToBusinessSlotUtc(iso: string, cfg: BusinessGridConfig, dayKey: string): string | null {
  const parsed = parseCalendarDateString(dayKey, cfg.timeZone);
  if (!parsed) return null;
  const mid = zonedMidnightUtcMs(parsed, cfg.timeZone);
  if (mid == null) return null;
  const ms = Date.parse(iso);
  if (!Number.isFinite(ms)) return null;

  const relMin = (ms - mid) / 60_000;
  const gridStart = cfg.dayStartHourUtc * 60;
  const gridEnd = cfg.dayEndHourUtc * 60;
  const clamped = Math.min(Math.max(relMin, gridStart), gridEnd - cfg.slotMinutes);
  const slotIdx = Math.round((clamped - gridStart) / cfg.slotMinutes);
  const snapped = gridStart + slotIdx * cfg.slotMinutes;
  return isoFromLocalDayMinutes(parsed, snapped, cfg.timeZone);
}

export function bookingConflictsForOperationalCalendar(
  candidate: Pick<FiBookingRow, "id" | "start_at" | "end_at" | "assigned_staff_id" | "assigned_user_id" | "clinic_id">,
  others: FiBookingRow[],
  opts?: {
    ignoreBookingId?: string;
    sameResourceColumnOverlapConflicts?: boolean;
    /** Minutes padded around each existing booking when testing overlap (matches server availability). */
    bufferMinutes?: number;
    staffIdToUserId?: Map<string, string | null>;
  }
): FiBookingRow[] {
  const ignore = opts?.ignoreBookingId?.trim();
  const s = Date.parse(candidate.start_at);
  const e = Date.parse(candidate.end_at);
  if (!Number.isFinite(s) || !Number.isFinite(e) || e <= s) return [];

  const bufferMs = Math.max(0, (opts?.bufferMinutes ?? DEFAULT_APPOINTMENT_BUFFER_MINUTES) * 60_000);
  const staffMap = opts?.staffIdToUserId ?? new Map<string, string | null>();

  const candCol = resourceColumnIdForBooking(candidate as FiBookingRow);
  const candIdentity = bookingAssigneeIdentity(candidate as FiBookingRow, staffMap);

  const out: FiBookingRow[] = [];
  for (const o of others) {
    if (ignore && o.id === ignore) continue;
    if (isBookingCancelled(o) || o.booking_status === "completed") continue;
    const os = Date.parse(o.start_at);
    const oe = Date.parse(o.end_at);
    if (!Number.isFinite(os) || !Number.isFinite(oe)) continue;
    if (!(s < oe + bufferMs && e + bufferMs > os)) continue;

    const sameAssignee = bookingAssigneeIdentitiesMatch(candIdentity, bookingAssigneeIdentity(o, staffMap));
    const sameClinic =
      candidate.clinic_id?.trim() &&
      o.clinic_id?.trim() &&
      candidate.clinic_id.trim() === o.clinic_id.trim();
    const sameResourceColumn =
      Boolean(opts?.sameResourceColumnOverlapConflicts) &&
      candCol === resourceColumnIdForBooking(o) &&
      candCol !== "unassigned";

    const unassignedOverlap =
      Boolean(opts?.sameResourceColumnOverlapConflicts) && candCol === "unassigned" && resourceColumnIdForBooking(o) === "unassigned";

    if (sameAssignee || sameClinic || sameResourceColumn || unassignedOverlap) out.push(o);
  }
  return out;
}

/** Maps a booking to a resource column id (`s:…`, `u:…`, `c:…`, or `unassigned`) for day view. */
export function resourceColumnIdForBooking(b: FiBookingRow): string {
  if (b.assigned_staff_id?.trim()) return `s:${b.assigned_staff_id.trim()}`;
  if (b.assigned_user_id?.trim()) return `u:${b.assigned_user_id.trim()}`;
  if (b.clinic_id?.trim()) return `c:${b.clinic_id.trim()}`;
  return "unassigned";
}
