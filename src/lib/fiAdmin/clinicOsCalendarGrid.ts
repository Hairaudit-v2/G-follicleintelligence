import { minutesFromLaneStart, zonedMidnightUtcMs } from "@/src/lib/calendar/calendarTimezone";

/** Minutes from business-day start on the clinic-local grid (clamped to visible window). */
export function clinicOsGridPlacementForBooking(
  startAt: string,
  endAt: string,
  dayYmd: string,
  dayStartHour: number,
  dayEndHour: number,
  calendarTimezone: string
): { startMin: number; durationMin: number } | null {
  const startMs = Date.parse(startAt);
  const endMs = Date.parse(endAt);
  if (!Number.isFinite(startMs) || !Number.isFinite(endMs)) return null;

  const dayStartMs = zonedMidnightUtcMs(dayYmd, calendarTimezone);
  if (dayStartMs == null) return null;

  const dur = Math.max(1, Math.round((endMs - startMs) / 60000));
  const startMinFromMidnight = minutesFromLaneStart(dayStartMs, startMs);
  const gridStartMin = dayStartHour * 60;
  const gridLastMin = dayEndHour * 60;
  const startMin = startMinFromMidnight - gridStartMin;
  const endMin = startMin + dur;
  if (endMin <= 0 || startMin >= gridLastMin - gridStartMin) return null;

  const visStart = Math.max(0, startMin);
  const visEnd = Math.min(gridLastMin - gridStartMin, endMin);
  return { startMin: visStart, durationMin: Math.max(15, visEnd - visStart) };
}
