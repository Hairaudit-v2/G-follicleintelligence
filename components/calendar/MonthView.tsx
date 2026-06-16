"use client";

import {
  DndContext,
  DragOverlay,
  PointerSensor,
  TouchSensor,
  pointerWithin,
  useDraggable,
  useDroppable,
  useSensor,
  useSensors,
  type DragEndEvent,
  type DragStartEvent,
} from "@dnd-kit/core";
import type { Variants } from "framer-motion";
import { motion, useReducedMotion } from "framer-motion";
import { ChevronLeft, ChevronRight, Loader2 } from "lucide-react";
import { useRouter } from "next/navigation";
import { memo, useCallback, useEffect, useMemo, useRef, useState, type ReactNode } from "react";

import {
  AppointmentCard,
  appointmentCardDataFromBooking,
  type AppointmentCardData,
} from "@/components/calendar/AppointmentCard";
import { CalendarToastProvider, useCalendarToast } from "@/components/calendar/CalendarToast";
import { parseWaitlistDragId } from "@/components/calendar/SidebarAgenda";
import { snapCalendarMinutes } from "@/lib/calendar/dndMath";
import { fiCrmCalendarGridClassNames } from "@/lib/design-system";
import {
  calendarPointerSensorOptions,
  calendarTouchSensorOptions,
} from "@/lib/calendar/calendarResponsive";
import { calendarShellVariants } from "@/lib/calendar/calendarMotion";
import { rescheduleErrorMessage } from "@/lib/calendar/rescheduleFeedback";
import { getAppointmentStyle } from "@/lib/calendar/getAppointmentStyle";
import type { CalendarRescheduleResult } from "@/hooks/useCalendarAppointments";
import { cn } from "@/lib/utils";
import {
  addMonthsToCalendarDate,
  bookingDurationMinutesUtc,
  calendarDateStringFromInstant,
  DEFAULT_CALENDAR_TIMEZONE,
  formatIsoMonthYearInTimezone,
  formatIsoTimeNumericInTimezone,
  isoFromLocalDayMinutes,
  localClockMinutesFromInstant,
  minutesFromLaneStart,
  normalizeCalendarTimezone,
  parseCalendarDateString,
  parseIsoUtcMs,
  zonedMidnightUtcMs,
} from "@/src/lib/calendar/calendarTimezone";
import {
  buildCalendarHref,
  mergeCalendarHrefQuery,
  type CalendarRoute,
  type ParsedCalendarQuery,
} from "@/src/lib/bookings/calendarQuery";
import { buildCalendarMonth } from "@/src/lib/bookings/calendarView";
import { resourceColumnIdForBooking, type BusinessGridConfig } from "@/src/lib/calendar/operationalCalendarLayout";
import type {
  OperationalCalendarBookingDisplay,
  OperationalCalendarResourceColumn,
} from "@/src/lib/calendar/operationalCalendarTypes";
import type { FiBookingRow } from "@/src/lib/bookings/types";
import { logCalendarClientPerf } from "@/src/lib/calendar/calendarPerfDev";

// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------

export const MONTH_DAY_DROP_PREFIX = "month:";

export const MONTH_WEEKDAY_LABELS = ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"] as const;

export const MONTH_GRID_WEEKS = 6;

export const MONTH_MAX_VISIBLE_APPOINTMENTS = 3;

/** Stable empty reference so month cells do not receive a fresh `[]` each render (memo props churn). */
const EMPTY_DAY_BOOKINGS: FiBookingRow[] = [];

const PROVIDER_DOT_COLORS = [
  "bg-sky-400",
  "bg-indigo-400",
  "bg-emerald-400",
  "bg-rose-400",
  "bg-amber-400",
  "bg-violet-400",
] as const;

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export type MonthGridCell = {
  dayKey: string;
  dayOfMonth: number;
  inCurrentMonth: boolean;
  isToday: boolean;
  isWeekend: boolean;
  startMs: number;
  endMs: number;
};

export type MonthViewRescheduleMeta = {
  assignedUserId?: string | null;
  clinicId?: string | null;
  clearWaitlist?: boolean;
};

export type MonthViewProps = {
  sidebar?: ReactNode;
  rightPanel?: ReactNode;
  /** Any clinic-local `YYYY-MM-DD` within the visible month. */
  monthAnchor: string;
  bookings: FiBookingRow[];
  bookingDisplay: Record<string, OperationalCalendarBookingDisplay>;
  resourceColumns: OperationalCalendarResourceColumn[];
  staffIdByUserId?: Map<string, string>;
  gridConfig: BusinessGridConfig;
  canMutateBookings: boolean;
  onSelectBooking: (b: FiBookingRow) => void;
  onRescheduleBooking: (
    booking: FiBookingRow,
    startIso: string,
    endIso: string,
    meta?: MonthViewRescheduleMeta
  ) => Promise<CalendarRescheduleResult>;
  /** When set with `query`, day clicks and month nav use the calendar router. */
  tenantId?: string;
  query?: ParsedCalendarQuery;
  onNavigateDay?: (dayKey: string) => void;
  onNavigateMonth?: (dateAnchor: string) => void;
  calendarRoute?: CalendarRoute;
  /** Booking ids awaiting PATCH after optimistic reschedule. */
  pendingAppointmentIds?: ReadonlySet<string>;
  calendarShellMode?: "default" | "fiOs";
  fiOsDrawerDismiss?: () => void;
  /**
   * FI OS: when set, days in the current month with no appointments open Quick Book instead of day view
   * (day number + “Open · click to schedule” targets).
   */
  onEmptyDayQuickCreate?: (dayKey: string) => void;
};

// ---------------------------------------------------------------------------
// Grid helpers
// ---------------------------------------------------------------------------

export function monthDayDropId(dayKey: string): string {
  return `${MONTH_DAY_DROP_PREFIX}${dayKey}`;
}

export function parseMonthDayDropId(id: string, timeZone?: string): string | null {
  if (!id.startsWith(MONTH_DAY_DROP_PREFIX)) return null;
  const dayKey = id.slice(MONTH_DAY_DROP_PREFIX.length).trim();
  return parseCalendarDateString(dayKey, normalizeCalendarTimezone(timeZone)) ? dayKey : null;
}

/** Six-week Monday-start grid covering the month containing `monthAnchor`. */
export function buildMonthGridCells(monthAnchor: string, timeZone: string, now: Date = new Date()): MonthGridCell[] {
  const tz = normalizeCalendarTimezone(timeZone);
  const todayKey = calendarDateStringFromInstant(now, tz);
  const anchor = parseCalendarDateString(monthAnchor, tz) ?? calendarDateStringFromInstant(now, tz);
  const anchorMs = zonedMidnightUtcMs(anchor, tz) ?? Date.now();
  const monthParts = new Intl.DateTimeFormat("en-US", { timeZone: tz, month: "numeric", year: "numeric" })
    .formatToParts(new Date(anchorMs))
    .reduce<Record<string, string>>((acc, p) => {
      if (p.type !== "literal") acc[p.type] = p.value;
      return acc;
    }, {});
  const monthIndex = Number(monthParts.month) - 1;
  const year = Number(monthParts.year);
  const lanes = buildCalendarMonth(monthAnchor, tz);

  return lanes.map((lane) => {
    const cellParts = new Intl.DateTimeFormat("en-US", {
      timeZone: tz,
      day: "numeric",
      month: "numeric",
      year: "numeric",
      weekday: "short",
    })
      .formatToParts(new Date(lane.startMs))
      .reduce<Record<string, string>>((acc, p) => {
        if (p.type !== "literal") acc[p.type] = p.value;
        return acc;
      }, {});
    const cellMonth = Number(cellParts.month) - 1;
    const cellYear = Number(cellParts.year);
    const dow = cellParts.weekday;
    return {
      dayKey: lane.dayKey,
      dayOfMonth: Number(cellParts.day),
      inCurrentMonth: cellMonth === monthIndex && cellYear === year,
      isToday: lane.dayKey === todayKey,
      isWeekend: dow === "Sat" || dow === "Sun",
      startMs: lane.startMs,
      endMs: lane.endMs,
    };
  });
}

export function bucketBookingsForMonthCells(
  bookings: FiBookingRow[],
  cells: MonthGridCell[]
): Map<string, FiBookingRow[]> {
  const map = new Map<string, FiBookingRow[]>();
  for (const cell of cells) {
    map.set(cell.dayKey, []);
  }
  if (cells.length === 0) return map;

  /** Chronological scan lets us `break` once `cell.startMs >= booking end` (cheaper than 42 × N for long ranges). */
  const sortedCells = [...cells].sort((a, b) => a.startMs - b.startMs);
  const gridStart = sortedCells[0]!.startMs;
  const gridEnd = sortedCells[sortedCells.length - 1]!.endMs;

  for (const booking of bookings) {
    const s = parseIsoUtcMs(booking.start_at);
    const e = parseIsoUtcMs(booking.end_at);
    if (s == null || e == null) continue;
    if (e <= gridStart || s >= gridEnd) continue;

    for (const cell of sortedCells) {
      if (cell.endMs <= s) continue;
      if (cell.startMs >= e) break;
      if (s < cell.endMs && e > cell.startMs) {
        map.get(cell.dayKey)!.push(booking);
      }
    }
  }

  for (const cell of cells) {
    const arr = map.get(cell.dayKey);
    if (arr) {
      arr.sort((a, b) => (parseIsoUtcMs(a.start_at) ?? 0) - (parseIsoUtcMs(b.start_at) ?? 0));
    }
  }

  return map;
}

export function formatMonthTitle(monthAnchor: string, timeZone: string = DEFAULT_CALENDAR_TIMEZONE): string {
  const tz = normalizeCalendarTimezone(timeZone);
  const anchor = parseCalendarDateString(monthAnchor, tz) ?? monthAnchor;
  const ms = zonedMidnightUtcMs(anchor, tz) ?? parseIsoUtcMs(`${anchor}T12:00:00.000Z`);
  if (ms == null) return monthAnchor;
  return formatIsoMonthYearInTimezone(ms, tz);
}

function defaultWaitlistDropMinutes(cfg: BusinessGridConfig): number {
  return cfg.dayStartHourUtc * 60 + 60;
}

function formatPillTime(iso: string, timezone?: string | null, fallbackTz?: string): string {
  return formatIsoTimeNumericInTimezone(iso, normalizeCalendarTimezone(timezone || fallbackTz));
}

// ---------------------------------------------------------------------------
// Provider summary
// ---------------------------------------------------------------------------

type ProviderDaySummary = {
  columnId: string;
  label: string;
  count: number;
  colorClass: string;
};

function summarizeProvidersForDay(
  dayBookings: FiBookingRow[],
  resourceColumns: OperationalCalendarResourceColumn[],
  staffIdByUserId?: Map<string, string>
): ProviderDaySummary[] {
  const counts = new Map<string, number>();

  for (const booking of dayBookings) {
    const colId = resourceColumnIdForBooking(booking, { staffIdByUserId });
    counts.set(colId, (counts.get(colId) ?? 0) + 1);
  }

  const columnIndex = new Map(resourceColumns.map((c, i) => [c.id, i]));
  const summaries: ProviderDaySummary[] = [];

  counts.forEach((count, columnId) => {
    const col = resourceColumns.find((c) => c.id === columnId);
    const idx = columnIndex.get(columnId) ?? summaries.length;
    summaries.push({
      columnId,
      label: col?.label ?? "Unassigned",
      count,
      colorClass: PROVIDER_DOT_COLORS[idx % PROVIDER_DOT_COLORS.length],
    });
  });

  return summaries.sort((a, b) => b.count - a.count);
}

// ---------------------------------------------------------------------------
// Sub-components
// ---------------------------------------------------------------------------

const MonthAppointmentPill = memo(function MonthAppointmentPill({
  booking,
  label,
  draggable,
  isPendingSave,
  onSelect,
  calendarTimezone,
}: {
  booking: FiBookingRow;
  label: string;
  draggable: boolean;
  isPendingSave?: boolean;
  onSelect: () => void;
  /** Grid / tenant clinic IANA zone when `booking.timezone` is unset. */
  calendarTimezone: string;
}) {
  const meta = booking.metadata ?? {};
  const isVirtual = Boolean(meta.is_virtual ?? meta.virtual ?? meta.zoom);
  const appointmentStyle = getAppointmentStyle({
    procedureType: booking.booking_type,
    status: booking.booking_status,
    isVirtual,
  });
  const Icon = appointmentStyle.icon;
  const time = formatPillTime(booking.start_at, booking.timezone, calendarTimezone);

  const { attributes, listeners, setNodeRef, transform, isDragging } = useDraggable({
    id: booking.id,
    disabled: !draggable || isPendingSave,
    data: {
      type: "appointment",
      appointment: appointmentCardDataFromBooking(booking, { anchorLabel: label }),
    },
  });

  return (
    <button
      ref={setNodeRef}
      type="button"
      aria-busy={isPendingSave || undefined}
      {...(draggable && !isPendingSave ? { ...listeners, ...attributes } : {})}
      onClick={(e) => {
        e.stopPropagation();
        onSelect();
      }}
      style={transform ? { transform: `translate3d(${transform.x}px, ${transform.y}px, 0)` } : undefined}
      className={cn(
        "group/pill relative flex w-full min-w-0 items-center gap-1.5 rounded-lg border px-1.5 py-1 text-left transition",
        "border-[#1e2937]/80 bg-[#0f172a]/90 shadow-sm",
        "hover:border-slate-600/70 hover:bg-[#1e293b]/90 hover:shadow-md hover:shadow-black/20",
        "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-sky-400/40",
        appointmentStyle.borderColor,
        appointmentStyle.backgroundTint,
        isDragging && "z-10 scale-[1.02] opacity-80 shadow-lg ring-2 ring-sky-400/30",
        isPendingSave && "opacity-75 ring-2 ring-amber-400/35"
      )}
    >
      {isPendingSave ? (
        <Loader2 className="absolute right-1 top-1 h-3 w-3 shrink-0 animate-spin text-amber-200" aria-hidden />
      ) : null}
      <span aria-hidden className={cn("h-4 w-0.5 shrink-0 rounded-full", appointmentStyle.accentClass)} />
      <Icon className={cn("h-3 w-3 shrink-0 opacity-80", appointmentStyle.textColor)} strokeWidth={2} aria-hidden />
      <span className="min-w-0 flex-1 truncate">
        <span className={cn("text-[10px] font-bold tabular-nums", appointmentStyle.textColor)}>{time}</span>
        <span className={cn("ml-1 text-[10px] font-semibold text-slate-200", appointmentStyle.textColor)}>
          {label}
        </span>
      </span>
    </button>
  );
});

const MonthDayCell = memo(function MonthDayCell({
  cell,
  dayBookings,
  bookingDisplay,
  resourceColumns,
  staffIdByUserId,
  droppable,
  draggableAppointments,
  pendingAppointmentIds,
  onDayClick,
  onEmptyDayQuickCreate,
  onSelectBooking,
  calendarTimezone,
}: {
  cell: MonthGridCell;
  dayBookings: FiBookingRow[];
  bookingDisplay: Record<string, OperationalCalendarBookingDisplay>;
  resourceColumns: OperationalCalendarResourceColumn[];
  staffIdByUserId?: Map<string, string>;
  droppable: boolean;
  draggableAppointments: boolean;
  pendingAppointmentIds?: ReadonlySet<string>;
  onDayClick: (dayKey: string) => void;
  /** When set with a quiet in-month day, primary actions open quick create instead of day view. */
  onEmptyDayQuickCreate?: (dayKey: string) => void;
  onSelectBooking: (b: FiBookingRow) => void;
  calendarTimezone: string;
}) {
  const { setNodeRef, isOver } = useDroppable({
    id: monthDayDropId(cell.dayKey),
    disabled: !droppable,
    data: { dayKey: cell.dayKey },
  });

  const visible = dayBookings.slice(0, MONTH_MAX_VISIBLE_APPOINTMENTS);
  const overflow = dayBookings.length - visible.length;
  const providerSummary = summarizeProvidersForDay(dayBookings, resourceColumns, staffIdByUserId);
  const visibleProviders = providerSummary.slice(0, 4);
  const overflowProviders = providerSummary.length - visibleProviders.length;
  const isQuietDay = cell.inCurrentMonth && dayBookings.length === 0;
  const openEmptyDayQuickCreate = isQuietDay && onEmptyDayQuickCreate ? onEmptyDayQuickCreate : null;

  return (
    <div
      ref={setNodeRef}
      className={cn(
        "group/cell flex min-h-[7.5rem] flex-col border-b border-r border-[#1e2937] p-2 transition-colors last:border-r-0",
        "bg-[#0f172a] hover:bg-[#111827]",
        !cell.inCurrentMonth && "bg-[#0b1220]/80",
        cell.isWeekend && cell.inCurrentMonth && "bg-[#0d1526]",
        cell.isToday && "bg-sky-950/25 ring-1 ring-inset ring-sky-400/35",
        isOver && droppable && "bg-emerald-950/30 ring-2 ring-inset ring-emerald-400/40"
      )}
    >
      <button
        type="button"
        onClick={() => (openEmptyDayQuickCreate ? openEmptyDayQuickCreate(cell.dayKey) : onDayClick(cell.dayKey))}
        className="mb-1.5 flex w-full items-start justify-between gap-1 text-left focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-sky-400/40"
        aria-label={
          openEmptyDayQuickCreate ? `Quick book appointment on ${cell.dayKey}` : `Open day view for ${cell.dayKey}`
        }
      >
        <span
          className={cn(
            "inline-flex h-7 min-w-[1.75rem] items-center justify-center rounded-full px-1.5 text-sm tabular-nums transition",
            cell.isToday
              ? "bg-sky-500 font-bold text-white shadow-md shadow-sky-500/30"
              : cell.inCurrentMonth
                ? "font-bold text-slate-100 group-hover/cell:bg-slate-800/80"
                : "font-medium text-slate-600"
          )}
        >
          {cell.dayOfMonth}
        </span>

        {providerSummary.length > 0 ? (
          <span className="flex shrink-0 items-center gap-0.5 pt-0.5" aria-hidden>
            {visibleProviders.map((p) => (
              <span
                key={p.columnId}
                title={`${p.label} · ${p.count}`}
                className={cn("h-1.5 w-1.5 rounded-full ring-1 ring-[#0f172a]", p.colorClass)}
              />
            ))}
            {overflowProviders > 0 ? (
              <span className="text-[9px] font-semibold tabular-nums text-slate-500">+{overflowProviders}</span>
            ) : null}
          </span>
        ) : null}
      </button>

      <div className="flex min-h-0 flex-1 flex-col gap-1">
        {visible.map((booking) => {
          const display = bookingDisplay[booking.id];
          const label = display?.anchorLabel?.trim() || booking.title?.trim() || "Patient";
          return (
            <MonthAppointmentPill
              key={booking.id}
              booking={booking}
              label={label}
              draggable={draggableAppointments}
              isPendingSave={pendingAppointmentIds?.has(booking.id)}
              calendarTimezone={calendarTimezone}
              onSelect={() => onSelectBooking(booking)}
            />
          );
        })}

        {overflow > 0 ? (
          <button
            type="button"
            onClick={() => onDayClick(cell.dayKey)}
            className="mt-auto w-full rounded-md px-1 py-0.5 text-left text-[10px] font-semibold text-slate-400 transition hover:bg-slate-800/60 hover:text-slate-200"
          >
            +{overflow} more
          </button>
        ) : isQuietDay ? (
          <button
            type="button"
            onClick={() =>
              openEmptyDayQuickCreate ? openEmptyDayQuickCreate(cell.dayKey) : onDayClick(cell.dayKey)
            }
            className="mt-auto w-full rounded-md border border-dashed border-[#1e2937]/80 px-1.5 py-1 text-[10px] font-medium text-slate-600 opacity-0 transition group-hover/cell:opacity-100 hover:border-slate-600 hover:bg-slate-900/50 hover:text-slate-300"
          >
            {openEmptyDayQuickCreate ? "Quick book" : "Open · click to schedule"}
          </button>
        ) : null}
      </div>
    </div>
  );
});

// ---------------------------------------------------------------------------
// Month view
// ---------------------------------------------------------------------------

function MonthViewInner({
  sidebar,
  rightPanel,
  monthAnchor,
  bookings,
  bookingDisplay,
  resourceColumns,
  staffIdByUserId,
  gridConfig,
  canMutateBookings,
  onSelectBooking,
  onRescheduleBooking,
  tenantId,
  query,
  onNavigateDay,
  onNavigateMonth,
  calendarRoute = "fi-admin",
  pendingAppointmentIds,
  calendarShellMode = "default",
  fiOsDrawerDismiss,
  onEmptyDayQuickCreate,
}: MonthViewProps) {
  const router = useRouter();
  const { success, error: toastError } = useCalendarToast();
  const [activeDrag, setActiveDrag] = useState<AppointmentCardData | null>(null);

  const sensors = useSensors(
    useSensor(PointerSensor, calendarPointerSensorOptions("desktop")),
    useSensor(TouchSensor, calendarTouchSensorOptions())
  );

  const cells = useMemo(
    () => buildMonthGridCells(monthAnchor, gridConfig.timeZone),
    [monthAnchor, gridConfig.timeZone]
  );
  const buckets = useMemo(() => bucketBookingsForMonthCells(bookings, cells), [bookings, cells]);
  const monthTitle = useMemo(
    () => formatMonthTitle(monthAnchor, gridConfig.timeZone),
    [monthAnchor, gridConfig.timeZone]
  );

  const renderCountRef = useRef(0);
  renderCountRef.current += 1;
  useEffect(() => {
    logCalendarClientPerf("month-view", {
      renderCount: renderCountRef.current,
      monthAnchor,
      bookingCount: bookings.length,
      cellCount: cells.length,
    });
  }, [bookings.length, cells.length, monthAnchor]);

  const monthStats = useMemo(() => {
    let total = 0;
    let daysWithAppointments = 0;
    let busiestCount = 0;
    let inMonthDays = 0;

    for (const cell of cells) {
      if (!cell.inCurrentMonth) continue;
      inMonthDays++;
      const count = buckets.get(cell.dayKey)?.length ?? 0;
      total += count;
      if (count > 0) daysWithAppointments++;
      if (count > busiestCount) busiestCount = count;
    }

    return {
      total,
      inMonthDays,
      openDays: inMonthDays - daysWithAppointments,
      busiestCount,
    };
  }, [buckets, cells]);

  const navigateMonth = useCallback(
    (delta: number) => {
      const nextAnchor = addMonthsToCalendarDate(monthAnchor, delta, gridConfig.timeZone);
      if (onNavigateMonth) {
        onNavigateMonth(nextAnchor);
        return;
      }
      if (tenantId && query) {
        router.push(
          buildCalendarHref(
            tenantId,
            mergeCalendarHrefQuery(query, { date: nextAnchor, view: "month" }),
            { route: calendarRoute }
          )
        );
      }
    },
    [calendarRoute, gridConfig.timeZone, monthAnchor, onNavigateMonth, query, router, tenantId]
  );

  const openDay = useCallback(
    (dayKey: string) => {
      if (onNavigateDay) {
        onNavigateDay(dayKey);
        return;
      }
      if (tenantId && query) {
        router.push(
          buildCalendarHref(
            tenantId,
            mergeCalendarHrefQuery(query, { view: "day", date: dayKey }),
            { route: calendarRoute }
          )
        );
      }
    },
    [calendarRoute, onNavigateDay, query, router, tenantId]
  );

  const onDragStart = useCallback((event: DragStartEvent) => {
    const data = event.active.data.current;
    if (data?.appointment) {
      setActiveDrag(data.appointment as AppointmentCardData);
    }
  }, []);

  const onDragEnd = useCallback(
    async (event: DragEndEvent) => {
      setActiveDrag(null);
      if (!canMutateBookings) return;

      const { active, over } = event;
      if (!over) return;

      const dayKey = parseMonthDayDropId(String(over.id), gridConfig.timeZone);
      if (!dayKey) return;

      const cell = cells.find((c) => c.dayKey === dayKey);
      if (!cell) return;

      const waitlistBookingId = parseWaitlistDragId(String(active.id));
      const bookingId = waitlistBookingId ?? String(active.id);
      const booking = bookings.find((b) => b.id === bookingId);
      if (!booking) return;

      const waitData = active.data.current as { item?: { durationMin?: number } } | undefined;
      const durationMin = waitlistBookingId
        ? Math.max(30, waitData?.item?.durationMin ?? 30)
        : Math.max(15, bookingDurationMinutesUtc(booking.start_at, booking.end_at) ?? 30);

      let startMin = defaultWaitlistDropMinutes(gridConfig);
      if (!waitlistBookingId) {
        const origMs = parseIsoUtcMs(booking.start_at);
        if (origMs == null) return;
        const origDayKey = calendarDateStringFromInstant(new Date(origMs), gridConfig.timeZone);
        if (origDayKey === dayKey) {
          startMin = minutesFromLaneStart(cell.startMs, origMs);
        } else {
          startMin =
            localClockMinutesFromInstant(origMs, gridConfig.timeZone) ??
            defaultWaitlistDropMinutes(gridConfig);
        }
      }
      startMin = snapCalendarMinutes(startMin, gridConfig);
      const startIso = isoFromLocalDayMinutes(dayKey, startMin, gridConfig.timeZone);
      const endIso = isoFromLocalDayMinutes(dayKey, startMin + durationMin, gridConfig.timeZone);
      if (!startIso || !endIso) return;

      const meta: MonthViewRescheduleMeta | undefined = waitlistBookingId ? { clearWaitlist: true } : undefined;
      const result = await onRescheduleBooking(booking, startIso, endIso, meta);

      if (result.ok) {
        success(waitlistBookingId ? "Scheduled from waitlist" : "Appointment moved");
      } else {
        toastError(rescheduleErrorMessage(result));
      }
    },
    [bookings, canMutateBookings, cells, gridConfig, onRescheduleBooking, success, toastError]
  );

  const shellIsFiOs = calendarShellMode === "fiOs";
  const fiOsPanelsOpen = shellIsFiOs && Boolean(sidebar || rightPanel);
  const prefersReducedMotion = useReducedMotion();
  const instantCalendarShell = shellIsFiOs || prefersReducedMotion === true;
  const calendarShellMotion: Variants = useMemo(
    () =>
      instantCalendarShell
        ? {
            hidden: { opacity: 1, y: 0 },
            show: { opacity: 1, y: 0, transition: { duration: 0 } },
          }
        : calendarShellVariants,
    [instantCalendarShell]
  );

  const monthMain = (
    <div className="flex min-h-0 min-w-0 flex-1 flex-col">
      <header className="flex items-center justify-between gap-3 border-b border-[#1e2937] px-4 py-3">
        <div className="min-w-0">
          <h2 className="truncate text-lg font-semibold tracking-tight text-slate-50">{monthTitle}</h2>
          <p className="text-xs text-slate-400">
            {monthStats.total > 0 ? (
              <>
                {monthStats.total} appointment{monthStats.total === 1 ? "" : "s"} this month
                {monthStats.busiestCount > 1 ? ` · busiest day ${monthStats.busiestCount}` : ""}
                {monthStats.openDays > 0
                  ? ` · ${monthStats.openDays} open day${monthStats.openDays === 1 ? "" : "s"}`
                  : ""}
              </>
            ) : (
              <>Quiet month — click any day to open the schedule or drag from the waitlist</>
            )}
          </p>
        </div>
        <div className="inline-flex shrink-0 items-center rounded-xl border border-[#1e2937] bg-[#0b1220] p-0.5">
          <button
            type="button"
            onClick={() => navigateMonth(-1)}
            className="inline-flex h-8 w-8 items-center justify-center rounded-lg text-slate-400 transition hover:bg-slate-800 hover:text-slate-100"
            aria-label="Previous month"
          >
            <ChevronLeft className="h-4 w-4" />
          </button>
          <button
            type="button"
            onClick={() => navigateMonth(1)}
            className="inline-flex h-8 w-8 items-center justify-center rounded-lg text-slate-400 transition hover:bg-slate-800 hover:text-slate-100"
            aria-label="Next month"
          >
            <ChevronRight className="h-4 w-4" />
          </button>
        </div>
      </header>

      <div className="grid grid-cols-7 border-b border-[#1e2937] bg-[#0b1220]/60">
        {MONTH_WEEKDAY_LABELS.map((label) => (
          <div
            key={label}
            className={cn(
              "px-2 py-2.5 text-center text-[11px] font-semibold uppercase tracking-wider text-slate-500",
              fiCrmCalendarGridClassNames.slotLabel
            )}
          >
            {label}
          </div>
        ))}
      </div>

      <div className="grid min-h-0 flex-1 auto-rows-fr overflow-y-auto overscroll-y-contain [grid-template-columns:repeat(7,minmax(0,1fr))]">
        {cells.map((cell) => (
          <MonthDayCell
            key={cell.dayKey}
            cell={cell}
            dayBookings={buckets.get(cell.dayKey) ?? EMPTY_DAY_BOOKINGS}
            bookingDisplay={bookingDisplay}
            resourceColumns={resourceColumns}
            staffIdByUserId={staffIdByUserId}
            droppable={canMutateBookings}
            draggableAppointments={canMutateBookings}
            pendingAppointmentIds={pendingAppointmentIds}
            onDayClick={openDay}
            onEmptyDayQuickCreate={onEmptyDayQuickCreate}
            onSelectBooking={onSelectBooking}
            calendarTimezone={gridConfig.timeZone}
          />
        ))}
      </div>
    </div>
  );

  return (
    <DndContext
      sensors={sensors}
      collisionDetection={pointerWithin}
      onDragStart={onDragStart}
      onDragEnd={onDragEnd}
      onDragCancel={() => setActiveDrag(null)}
    >
      <motion.div
        variants={calendarShellMotion}
        initial="hidden"
        animate="show"
        className={cn(
          "fi-calendar-shell flex overflow-hidden rounded-xl border shadow-sm ring-1",
          "border-[#1e2937] bg-[#0f172a] shadow-black/30 ring-white/[0.04] md:rounded-2xl",
          shellIsFiOs ? "relative min-h-0 flex-1 flex-col" : "min-h-[min(36rem,78dvh)] flex-col md:min-h-[36rem] lg:min-h-[calc(100dvh-13rem)]"
        )}
      >
        {shellIsFiOs ? (
          <div className="relative flex min-h-0 min-w-0 flex-1 flex-col">
            <div className="flex min-h-0 min-w-0 flex-1 flex-col px-1 sm:px-2">
              <div className="flex min-h-0 w-full min-w-0 flex-1 flex-col">{monthMain}</div>
            </div>

            {fiOsPanelsOpen && fiOsDrawerDismiss ? (
              <button
                type="button"
                className="absolute inset-0 z-[34] bg-black/45 backdrop-blur-[1px] transition hover:bg-black/50"
                aria-label="Close calendar panels"
                onClick={fiOsDrawerDismiss}
              />
            ) : null}

            {sidebar ? (
              <div className="absolute inset-y-0 left-0 z-[36] flex w-[min(20rem,calc(100vw-1rem))] max-w-[92vw] shadow-2xl lg:left-[272px]">
                {sidebar}
              </div>
            ) : null}

            {rightPanel ? (
              <div className="absolute inset-y-0 right-0 z-[36] flex w-[min(18rem,calc(100vw-1rem))] max-w-[min(100%,20rem)] shadow-2xl">
                {rightPanel}
              </div>
            ) : null}
          </div>
        ) : (
          <div className="flex min-h-0 min-w-0 flex-1 flex-row">
            {sidebar}
            {monthMain}
            {rightPanel}
          </div>
        )}
      </motion.div>

      <DragOverlay dropAnimation={{ duration: 200, easing: "cubic-bezier(0.18, 0.67, 0.6, 1)" }}>
        {activeDrag ? (
          <div className="pointer-events-none w-[min(100%,220px)]">
            <AppointmentCard appointment={activeDrag} isDragPreview draggable={false} />
          </div>
        ) : null}
      </DragOverlay>
    </DndContext>
  );
}

export function MonthView(props: MonthViewProps) {
  return (
    <CalendarToastProvider>
      <MonthViewInner {...props} />
    </CalendarToastProvider>
  );
}
