/**
 * CalendarOS V2 — display density tokens (pure).
 * Tuned for Timely-like operational density on standard laptop viewports.
 */

export const CALENDAR_OS_DISPLAY_DENSITIES = ["comfortable", "compact", "command"] as const;

export type CalendarOsDisplayDensity = (typeof CALENDAR_OS_DISPLAY_DENSITIES)[number];

/** Legacy layout baseline — day placement math scales from this reference hour height. */
export const CALENDAR_OS_LAYOUT_BASE_PX_PER_HOUR = 44;

export type CalendarOsDensityTokens = {
  /** Week view: resource label column width (px). */
  weekResourceLabelWidth: number;
  /** Week view: minimum day column width (px). 0 = fluid `minmax(0, 1fr)`. */
  weekDayColMinWidth: number;
  /** Week view: minimum resource row height (px). */
  weekRowMinHeight: number;
  /** Week view: role group header vertical padding class suffix. */
  weekGroupHeaderPy: string;
  /** Day view: time gutter width (px). */
  dayTimeGutterWidth: number;
  /** Day view: minimum resource column width (px). 0 = fluid `minmax(0, 1fr)`. */
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
    weekResourceLabelWidth: 120,
    weekDayColMinWidth: 0,
    weekRowMinHeight: 31,
    weekGroupHeaderPy: "py-0.5",
    dayTimeGutterWidth: 40,
    dayResourceColMinWidth: 0,
    dayPxPerHour: 26,
    dayHeaderPy: "py-1",
    bookingUltraCompact: true,
    showHoverDetail: true,
    panelCompact: true,
    showUtilisation: true,
    showWorkingStatus: true,
  },
  compact: {
    weekResourceLabelWidth: 108,
    weekDayColMinWidth: 0,
    weekRowMinHeight: 26,
    weekGroupHeaderPy: "py-0.5",
    dayTimeGutterWidth: 36,
    dayResourceColMinWidth: 0,
    dayPxPerHour: 24,
    dayHeaderPy: "py-1",
    bookingUltraCompact: true,
    showHoverDetail: true,
    panelCompact: true,
    showUtilisation: true,
    showWorkingStatus: true,
  },
  command: {
    weekResourceLabelWidth: 96,
    weekDayColMinWidth: 0,
    weekRowMinHeight: 22,
    weekGroupHeaderPy: "py-0",
    dayTimeGutterWidth: 32,
    dayResourceColMinWidth: 0,
    dayPxPerHour: 22,
    dayHeaderPy: "py-0.5",
    bookingUltraCompact: true,
    showHoverDetail: true,
    panelCompact: true,
    showUtilisation: true,
    showWorkingStatus: false,
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

function fluidColMin(minWidth: number): string {
  return minWidth > 0 ? `minmax(${minWidth}px, 1fr)` : "minmax(0, 1fr)";
}

export function calendarOsWeekGridTemplate(
  density: CalendarOsDisplayDensity,
  dayCount: number
): string {
  const t = calendarOsDensityTokens(density);
  return `${t.weekResourceLabelWidth}px repeat(${dayCount}, ${fluidColMin(t.weekDayColMinWidth)})`;
}

export function calendarOsDayGridTemplate(
  density: CalendarOsDisplayDensity,
  resourceCount: number
): string {
  const t = calendarOsDensityTokens(density);
  return `${t.dayTimeGutterWidth}px repeat(${resourceCount}, ${fluidColMin(t.dayResourceColMinWidth)})`;
}

export function calendarOsDayBodyHeightPx(density: CalendarOsDisplayDensity, gridHours: number): number {
  const t = calendarOsDensityTokens(density);
  return gridHours * t.dayPxPerHour;
}