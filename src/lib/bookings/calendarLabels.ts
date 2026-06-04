/**
 * Staff-facing strings and design-token class maps for the booking calendar (Stage 3C). Pure.
 */

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

export function calendarDayHeading(lane: CalendarDayLane): string {
  const d = new Date(lane.startMs);
  const dayNum = d.getUTCDate();
  const month = d.toLocaleDateString("en-GB", { month: "short", timeZone: "UTC" });
  return `${lane.headingShortUtc} ${dayNum} ${month}`;
}

export function formatCalendarRangeTitle(view: CalendarViewMode, lanes: CalendarDayLane[]): string {
  if (lanes.length === 0) return "Calendar";
  if (view === "day") {
    const d = new Date(lanes[0].startMs);
    return d.toLocaleDateString("en-GB", {
      weekday: "long",
      day: "numeric",
      month: "long",
      year: "numeric",
      timeZone: "UTC",
    });
  }
  const a = lanes[0].startMs;
  const b = lanes[lanes.length - 1].endMs - 1;
  const start = new Date(a);
  const end = new Date(b);
  const sameMonth =
    start.getUTCMonth() === end.getUTCMonth() && start.getUTCFullYear() === end.getUTCFullYear();
  if (sameMonth) {
    return `${start.getUTCDate()}–${end.getUTCDate()} ${start.toLocaleDateString("en-GB", { month: "long", timeZone: "UTC" })} ${start.getUTCFullYear()} (UTC)`;
  }
  return `${start.toLocaleDateString("en-GB", { day: "numeric", month: "short", timeZone: "UTC" })} – ${end.toLocaleDateString("en-GB", { day: "numeric", month: "short", year: "numeric", timeZone: "UTC" })} (UTC)`;
}

export function bookingTypeCalendarLegendLabel(type: string): string {
  return bookingTypeLabel(type);
}
