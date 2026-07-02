/**
 * CalendarOS V2 — display density tokens (pure).
 */

export const CALENDAR_OS_DISPLAY_DENSITIES = ["comfortable", "compact", "command"] as const;

export type CalendarOsDisplayDensity = (typeof CALENDAR_OS_DISPLAY_DENSITIES)[number];

export type CalendarOsDensityTokens = {
  /** Week view: resource label column width (px). */
  weekResourceLabelWidth: number;
  /** Week view: minimum day column width (px). */
  weekDayColMinWidth: number;
  /** Week view: minimum resource row height (px). */
  weekRowMinHeight: number;
  /** Week view: role group header vertical padding class suffix. */
  weekGroupHeaderPy: string;
  /** Day view: time gutter width (px). */
  dayTimeGutterWidth: number;
  /** Day view: minimum resource column width (px). */
  dayResourceColMinWidth: number;
  /** Day view: px per hour for time grid. */
  dayPxPerHour: number;
  /** Day view: sticky header padding. */
  dayHeaderPy: string;
  /** Booking cards use ultra-compact layout. */
  bookingUltraCompact: boolean;
  /** Show expanded card detail on hover. */
  showHoverDetail: boolean;
  /** Operational panel uses tighter metric cards. */
  panelCompact: boolean;
  /** Show utilisation bars on resource lanes. */
  showUtilisation: boolean;
  /** Show staff working-status dot on lanes. */
  showWorkingStatus: boolean;
};

const DENSITY_TOKENS: Record<CalendarOsDisplayDensity, CalendarOsDensityTokens> = {
  comfortable: {
    weekResourceLabelWidth: 180,
    weekDayColMinWidth: 140,
    weekRowMinHeight: 52,
    weekGroupHeaderPy: "py-1",
    dayTimeGutterWidth: 52,
    dayResourceColMinWidth: 160,
    dayPxPerHour: 44,
    dayHeaderPy: "py-2",
    bookingUltraCompact: false,
    showHoverDetail: true,
    panelCompact: false,
    showUtilisation: true,
    showWorkingStatus: true,
  },
  compact: {
    weekResourceLabelWidth: 152,
    weekDayColMinWidth: 112,
    weekRowMinHeight: 40,
    weekGroupHeaderPy: "py-0.5",
    dayTimeGutterWidth: 44,
    dayResourceColMinWidth: 128,
    dayPxPerHour: 40,
    dayHeaderPy: "py-1.5",
    bookingUltraCompact: true,
    showHoverDetail: true,
    panelCompact: true,
    showUtilisation: true,
    showWorkingStatus: true,
  },
  command: {
    weekResourceLabelWidth: 136,
    weekDayColMinWidth: 96,
    weekRowMinHeight: 34,
    weekGroupHeaderPy: "py-0.5",
    dayTimeGutterWidth: 40,
    dayResourceColMinWidth: 108,
    dayPxPerHour: 36,
    dayHeaderPy: "py-1",
    bookingUltraCompact: true,
    showHoverDetail: false,
    panelCompact: true,
    showUtilisation: true,
    showWorkingStatus: true,
  },
};

export function isCalendarOsDisplayDensity(v: string): v is CalendarOsDisplayDensity {
  return (CALENDAR_OS_DISPLAY_DENSITIES as readonly string[]).includes(v);
}

export function normalizeCalendarOsDisplayDensity(
  raw: string | null | undefined
): CalendarOsDisplayDensity {
  const v = String(raw ?? "").trim().toLowerCase();
  return isCalendarOsDisplayDensity(v) ? v : "comfortable";
}

export function calendarOsDensityTokens(density: CalendarOsDisplayDensity): CalendarOsDensityTokens {
  return DENSITY_TOKENS[density];
}

export function calendarOsDensityStorageKey(tenantId: string): string {
  return `fi-calendar-os-density:${tenantId.trim()}`;
}

export function calendarOsWeekGridTemplate(
  density: CalendarOsDisplayDensity,
  dayCount: number
): string {
  const t = calendarOsDensityTokens(density);
  return `${t.weekResourceLabelWidth}px repeat(${dayCount}, minmax(${t.weekDayColMinWidth}px, 1fr))`;
}

export function calendarOsDayGridTemplate(
  density: CalendarOsDisplayDensity,
  resourceCount: number
): string {
  const t = calendarOsDensityTokens(density);
  return `${t.dayTimeGutterWidth}px repeat(${resourceCount}, minmax(${t.dayResourceColMinWidth}px, 1fr))`;
}

export function calendarOsDayBodyHeightPx(density: CalendarOsDisplayDensity, gridHours: number): number {
  const t = calendarOsDensityTokens(density);
  return gridHours * t.dayPxPerHour;
}
