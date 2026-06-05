import type { SensorOptions } from "@dnd-kit/core";

/** Breakpoints aligned with Tailwind `md` / `lg`. */
export const CALENDAR_BREAKPOINTS = {
  tablet: 768,
  desktop: 1024,
} as const;

export const CALENDAR_MEDIA_QUERIES = {
  tablet: `(min-width: ${CALENDAR_BREAKPOINTS.tablet}px)`,
  desktop: `(min-width: ${CALENDAR_BREAKPOINTS.desktop}px)`,
  compact: `(max-width: ${CALENDAR_BREAKPOINTS.tablet - 1}px)`,
  belowDesktop: `(max-width: ${CALENDAR_BREAKPOINTS.desktop - 1}px)`,
} as const;

export type CalendarLayoutMode = "compact" | "tablet" | "desktop";

export function isSwipeCalendarLayout(mode: CalendarLayoutMode): boolean {
  return mode !== "desktop";
}

export function calendarSidebarsCollapsedByDefault(mode: CalendarLayoutMode): boolean {
  return mode !== "desktop";
}

/** Touch-first drag activation — delay avoids fighting horizontal swipe scroll. */
export function calendarTouchSensorOptions(): SensorOptions {
  return {
    activationConstraint: {
      delay: 220,
      tolerance: 12,
    },
  };
}

export function calendarPointerSensorOptions(mode: CalendarLayoutMode): SensorOptions {
  return {
    activationConstraint: {
      distance: mode === "compact" ? 10 : 6,
    },
  };
}
