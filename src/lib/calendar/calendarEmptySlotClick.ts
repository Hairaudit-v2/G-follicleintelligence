import { snapCalendarMinutes } from "@/lib/calendar/dndMath";
import {
  clinicLocalSlotToUtcIso,
  logFiCalendarTimezoneDebug,
  toDatetimeLocalValueInTimezone,
} from "@/src/lib/calendar/calendarTimezone";
import type { BusinessGridConfig } from "@/src/lib/calendar/operationalCalendarLayout";

export type CalendarEmptySlotClickInfo = {
  dayKey: string;
  columnId: string;
  localStart: string;
};

/** Resolve a grid click Y coordinate into a snapped clinic-local quick-create prefill. */
export function resolveCalendarEmptySlotClick(args: {
  dayKey: string;
  columnId: string;
  clientY: number;
  targetRect: Pick<DOMRect, "top">;
  gridConfig: BusinessGridConfig;
  pxPerMinute: number;
}): CalendarEmptySlotClickInfo | null {
  const ppm = args.pxPerMinute;
  if (!Number.isFinite(ppm) || ppm <= 0) return null;

  const y = args.clientY - args.targetRect.top;
  const rawMin = args.gridConfig.dayStartHourUtc * 60 + y / ppm;
  const snapped = snapCalendarMinutes(rawMin, args.gridConfig);
  const iso = clinicLocalSlotToUtcIso(args.dayKey, snapped, args.gridConfig.timeZone);
  if (!iso) return null;

  const localStart = toDatetimeLocalValueInTimezone(iso, args.gridConfig.timeZone);
  logFiCalendarTimezoneDebug("empty-slot-click", {
    dayKey: args.dayKey,
    snappedMinutesFromLocalMidnight: snapped,
    clinicTimezone: args.gridConfig.timeZone,
    slotUtcIso: iso,
    datetimeLocalValue: localStart,
  });

  return {
    dayKey: args.dayKey,
    columnId: args.columnId,
    localStart,
  };
}
