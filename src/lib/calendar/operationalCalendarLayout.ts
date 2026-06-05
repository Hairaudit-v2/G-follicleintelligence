/**
 * Pure layout helpers for FI Admin operational calendar (business-hour grid, UTC).
 */

import type { CalendarDayLane } from "@/src/lib/bookings/calendarView";
import { parseUtcCalendarDateString } from "@/src/lib/bookings/calendarQuery";
import type { FiBookingRow } from "@/src/lib/bookings/types";

export type BusinessGridConfig = {
  dayStartHourUtc: number;
  dayEndHourUtc: number;
  /** Vertical resolution for drag snap + grid lines. */
  slotMinutes: 30 | 60;
};

export const DEFAULT_BUSINESS_GRID: BusinessGridConfig = {
  dayStartHourUtc: 8,
  dayEndHourUtc: 18,
  slotMinutes: 30,
};

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

function minutesUtcFromEpoch(ms: number): number {
  const d = new Date(ms);
  return d.getUTCHours() * 60 + d.getUTCMinutes() + d.getUTCSeconds() / 60 + d.getUTCMilliseconds() / 60000;
}

function utcMidnightMs(dayKey: string): number | null {
  const ymd = parseUtcCalendarDateString(dayKey);
  if (!ymd) return null;
  const y = Number(ymd.slice(0, 4));
  const mo = Number(ymd.slice(5, 7)) - 1;
  const d = Number(ymd.slice(8, 10));
  return Date.UTC(y, mo, d, 0, 0, 0, 0);
}

/**
 * Vertical placement within a lane, relative to business-hour window (UTC).
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
  const startMin = minutesUtcFromEpoch(clampS);
  const endMin = minutesUtcFromEpoch(clampE);

  const visStart = Math.max(startMin, gridStartMin);
  const visEnd = Math.min(endMin, gridEndMin);
  if (visEnd <= visStart) return null;

  const pxPerMin = OPERATIONAL_CAL_PX_PER_HOUR / 60;
  const topPx = (visStart - gridStartMin) * pxPerMin;
  const heightPx = Math.max((visEnd - visStart) * pxPerMin, 20);
  return { topPx, heightPx };
}

/** ISO range for the business slot at `slotIndex` (0-based) on `dayKey` (UTC). */
export function utcBusinessSlotIsoRange(
  dayKey: string,
  slotIndex: number,
  cfg: BusinessGridConfig
): { startIso: string; endIso: string } | null {
  const mid = utcMidnightMs(dayKey);
  if (mid == null || !Number.isInteger(slotIndex) || slotIndex < 0) return null;
  const max = slotCount(cfg);
  if (slotIndex >= max) return null;

  const startMinUtc = cfg.dayStartHourUtc * 60 + slotIndex * cfg.slotMinutes;
  const startMs = mid + startMinUtc * 60_000;
  const endMs = startMs + cfg.slotMinutes * 60_000;
  return { startIso: new Date(startMs).toISOString(), endIso: new Date(endMs).toISOString() };
}

export function snapIsoToBusinessSlotUtc(iso: string, cfg: BusinessGridConfig, dayKey: string): string | null {
  const mid = utcMidnightMs(dayKey);
  if (mid == null) return null;
  const ms = Date.parse(iso);
  if (!Number.isFinite(ms)) return null;

  const relMin = (ms - mid) / 60_000;
  const gridStart = cfg.dayStartHourUtc * 60;
  const gridEnd = cfg.dayEndHourUtc * 60;
  const clamped = Math.min(Math.max(relMin, gridStart), gridEnd - cfg.slotMinutes);
  const slotIdx = Math.round((clamped - gridStart) / cfg.slotMinutes);
  const snapped = gridStart + slotIdx * cfg.slotMinutes;
  return new Date(mid + snapped * 60_000).toISOString();
}

export function bookingConflictsForOperationalCalendar(
  candidate: { id: string; start_at: string; end_at: string; assigned_user_id: string | null; clinic_id: string | null },
  others: FiBookingRow[],
  opts?: { ignoreBookingId?: string }
): FiBookingRow[] {
  const ignore = opts?.ignoreBookingId?.trim();
  const s = Date.parse(candidate.start_at);
  const e = Date.parse(candidate.end_at);
  if (!Number.isFinite(s) || !Number.isFinite(e) || e <= s) return [];

  const out: FiBookingRow[] = [];
  for (const o of others) {
    if (ignore && o.id === ignore) continue;
    const os = Date.parse(o.start_at);
    const oe = Date.parse(o.end_at);
    if (!Number.isFinite(os) || !Number.isFinite(oe)) continue;
    if (!(s < oe && e > os)) continue;

    const sameAssignee =
      candidate.assigned_user_id?.trim() &&
      o.assigned_user_id?.trim() &&
      candidate.assigned_user_id.trim() === o.assigned_user_id.trim();
    const sameClinic =
      candidate.clinic_id?.trim() &&
      o.clinic_id?.trim() &&
      candidate.clinic_id.trim() === o.clinic_id.trim();

    if (sameAssignee || sameClinic) out.push(o);
  }
  return out;
}

/** Maps a booking to a resource column id (`u:…`, `c:…`, or `unassigned`) for day view. */
export function resourceColumnIdForBooking(b: FiBookingRow): string {
  if (b.assigned_user_id?.trim()) return `u:${b.assigned_user_id.trim()}`;
  if (b.clinic_id?.trim()) return `c:${b.clinic_id.trim()}`;
  return "unassigned";
}
