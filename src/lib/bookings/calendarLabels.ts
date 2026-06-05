/**
 * Staff-facing strings and design-token class maps for the booking calendar (Stage 3C). Pure.
 */

import { DEFAULT_CALENDAR_TIMEZONE, normalizeCalendarTimezone } from "@/src/lib/calendar/calendarTimezone";
import { BOOKING_TYPES, type BookingType } from "./bookingPolicy";
import { bookingTypeLabel } from "./operatorBookingLabels";
import type { CalendarDayLane } from "./calendarView";
import type { CalendarViewMode } from "./calendarQuery";

/** Tailwind classes using theme tokens from `tailwind.config` / `:root` (no raw hex). */
const BOOKING_TYPE_EVENT_CLASSES: Record<BookingType, string> = {
  consultation: "border-primary/50 bg-primary/15 text-primary-foreground",
  prp: "border-secondary/45 bg-secondary/35 text-secondary-foreground",
  prf: "border-muted-foreground/30 bg-muted text-muted-foreground",
  mesotherapy: "border-accent/40 bg-accent text-accent-foreground",
  exosomes: "border-primary/35 bg-card text-card-foreground",
  surgery: "border-border bg-secondary/50 text-secondary-foreground",
  review: "border-primary/30 bg-primary/8 text-primary-foreground",
  follow_up: "border-popover-foreground/25 bg-popover text-popover-foreground",
  other: "border-border bg-muted/80 text-muted-foreground",
};

const TYPE_SET = new Set<string>(BOOKING_TYPES);

/** Event chip colours: one semantic tone per known booking type. */
export function bookingTypeCalendarEventClasses(bookingType: string): string {
  const t = bookingType.trim();
  if (TYPE_SET.has(t)) return BOOKING_TYPE_EVENT_CLASSES[t as BookingType];
  return "border-border bg-muted text-muted-foreground";
}

export function calendarDayHeading(lane: CalendarDayLane, timeZone?: string): string {
  const tz = normalizeCalendarTimezone(timeZone ?? lane.timeZone);
  const d = new Date(lane.startMs);
  const dayNum = new Intl.DateTimeFormat("en-GB", { day: "numeric", timeZone: tz }).format(d);
  const month = d.toLocaleDateString("en-GB", { month: "short", timeZone: tz });
  return `${lane.headingShortUtc} ${dayNum} ${month}`;
}

export function formatCalendarRangeTitle(
  view: CalendarViewMode,
  lanes: CalendarDayLane[],
  timeZone: string = DEFAULT_CALENDAR_TIMEZONE
): string {
  const tz = normalizeCalendarTimezone(timeZone);
  if (lanes.length === 0) return "Calendar";
  if (view === "month" && lanes.length > 0) {
    const anchorMs = lanes[14]?.startMs ?? lanes[0].startMs;
    return new Date(anchorMs).toLocaleDateString("en-GB", {
      month: "long",
      year: "numeric",
      timeZone: tz,
    });
  }
  if (view === "day") {
    const d = new Date(lanes[0].startMs);
    return d.toLocaleDateString("en-GB", {
      weekday: "long",
      day: "numeric",
      month: "long",
      year: "numeric",
      timeZone: tz,
    });
  }
  if (view === "3day" && lanes.length > 0) {
    const start = new Date(lanes[0].startMs);
    const end = new Date(lanes[lanes.length - 1].endMs - 1);
    return `${start.toLocaleDateString("en-GB", { weekday: "short", day: "numeric", month: "short", timeZone: tz })} – ${end.toLocaleDateString("en-GB", { weekday: "short", day: "numeric", month: "short", year: "numeric", timeZone: tz })}`;
  }
  const a = lanes[0].startMs;
  const b = lanes[lanes.length - 1].endMs - 1;
  const start = new Date(a);
  const end = new Date(b);
  const startParts = new Intl.DateTimeFormat("en-GB", { month: "numeric", year: "numeric", timeZone: tz }).formatToParts(start);
  const endParts = new Intl.DateTimeFormat("en-GB", { month: "numeric", year: "numeric", timeZone: tz }).formatToParts(end);
  const startMonth = startParts.find((p) => p.type === "month")?.value;
  const endMonth = endParts.find((p) => p.type === "month")?.value;
  const startYear = startParts.find((p) => p.type === "year")?.value;
  const endYear = endParts.find((p) => p.type === "year")?.value;
  const sameMonth = startMonth === endMonth && startYear === endYear;
  if (sameMonth) {
    const startDay = new Intl.DateTimeFormat("en-GB", { day: "numeric", timeZone: tz }).format(start);
    const endDay = new Intl.DateTimeFormat("en-GB", { day: "numeric", timeZone: tz }).format(end);
    const monthLabel = start.toLocaleDateString("en-GB", { month: "long", timeZone: tz });
    return `${startDay}–${endDay} ${monthLabel} ${startYear}`;
  }
  return `${start.toLocaleDateString("en-GB", { day: "numeric", month: "short", timeZone: tz })} – ${end.toLocaleDateString("en-GB", { day: "numeric", month: "short", year: "numeric", timeZone: tz })}`;
}

export function bookingTypeCalendarLegendLabel(type: string): string {
  return bookingTypeLabel(type);
}

/** Status ring / accent for calendar chips (non-terminal emphasis). */
export function bookingStatusCalendarAccent(status: string): string {
  const s = status.trim();
  if (s === "cancelled") return "ring-2 ring-red-300/80";
  if (s === "completed") return "ring-2 ring-emerald-400/70";
  if (s === "no_show") return "ring-2 ring-amber-400/80";
  if (s === "arrived") return "ring-2 ring-primary/50";
  if (s === "confirmed") return "ring-1 ring-primary/35";
  return "";
}
