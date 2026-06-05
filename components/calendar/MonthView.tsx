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
import { motion } from "framer-motion";
import { ChevronLeft, ChevronRight } from "lucide-react";
import { useRouter } from "next/navigation";
import { useCallback, useMemo, useState, type ReactNode } from "react";

import {
  AppointmentCard,
  appointmentCardDataFromBooking,
  type AppointmentCardData,
} from "@/components/calendar/AppointmentCard";
import { CalendarToastProvider, useCalendarToast } from "@/components/calendar/CalendarToast";
import { parseWaitlistDragId } from "@/components/calendar/SidebarAgenda";
import { fiCrmCalendarGridClassNames } from "@/lib/design-system";
import {
  calendarPointerSensorOptions,
  calendarTouchSensorOptions,
} from "@/lib/calendar/calendarResponsive";
import { calendarShellVariants, staggerContainerVariants } from "@/lib/calendar/calendarMotion";
import { getAppointmentStyle } from "@/lib/calendar/getAppointmentStyle";
import { cn } from "@/lib/utils";
import {
  addUtcMonthsToCalendarDate,
  buildCalendarHref,
  mergeCalendarHrefQuery,
  parseUtcCalendarDateString,
  utcCalendarDateStringFromDate,
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

// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------

export const MONTH_DAY_DROP_PREFIX = "month:";

export const MONTH_WEEKDAY_LABELS = ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"] as const;

export const MONTH_GRID_WEEKS = 6;

export const MONTH_MAX_VISIBLE_APPOINTMENTS = 3;

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
  /** Any UTC `YYYY-MM-DD` within the visible month. */
  monthAnchor: string;
  bookings: FiBookingRow[];
  bookingDisplay: Record<string, OperationalCalendarBookingDisplay>;
  resourceColumns: OperationalCalendarResourceColumn[];
  gridConfig: BusinessGridConfig;
  canMutateBookings: boolean;
  onSelectBooking: (b: FiBookingRow) => void;
  onRescheduleBooking: (
    booking: FiBookingRow,
    startIso: string,
    endIso: string,
    meta?: MonthViewRescheduleMeta
  ) => Promise<{ ok: boolean; error?: string }>;
  /** When set with `query`, day clicks and month nav use the calendar router. */
  tenantId?: string;
  query?: ParsedCalendarQuery;
  onNavigateDay?: (dayKey: string) => void;
  onNavigateMonth?: (dateAnchor: string) => void;
  calendarRoute?: CalendarRoute;
};

// ---------------------------------------------------------------------------
// Grid helpers
// ---------------------------------------------------------------------------

function utcMidnightMsFromYmd(ymd: string): number {
  const y = Number(ymd.slice(0, 4));
  const mo = Number(ymd.slice(5, 7)) - 1;
  const d = Number(ymd.slice(8, 10));
  return Date.UTC(y, mo, d, 0, 0, 0, 0);
}

export function monthDayDropId(dayKey: string): string {
  return `${MONTH_DAY_DROP_PREFIX}${dayKey}`;
}

export function parseMonthDayDropId(id: string): string | null {
  if (!id.startsWith(MONTH_DAY_DROP_PREFIX)) return null;
  const dayKey = id.slice(MONTH_DAY_DROP_PREFIX.length).trim();
  return parseUtcCalendarDateString(dayKey) ? dayKey : null;
}

/** Six-week Monday-start grid covering the month containing `monthAnchor`. */
export function buildMonthGridCells(monthAnchor: string, now: Date = new Date()): MonthGridCell[] {
  const todayKey = utcCalendarDateStringFromDate(now);
  const anchor = parseUtcCalendarDateString(monthAnchor) ?? utcCalendarDateStringFromDate(now);
  const anchorMs = utcMidnightMsFromYmd(anchor);
  const monthIndex = new Date(anchorMs).getUTCMonth();
  const year = new Date(anchorMs).getUTCFullYear();
  const lanes = buildCalendarMonth(monthAnchor);

  return lanes.map((lane) => {
    const cellDate = new Date(lane.startMs);
    const utcDow = cellDate.getUTCDay();
    return {
      dayKey: lane.dayKey,
      dayOfMonth: cellDate.getUTCDate(),
      inCurrentMonth: cellDate.getUTCMonth() === monthIndex && cellDate.getUTCFullYear() === year,
      isToday: lane.dayKey === todayKey,
      isWeekend: utcDow === 0 || utcDow === 6,
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

  for (const booking of bookings) {
    const s = Date.parse(booking.start_at);
    const e = Date.parse(booking.end_at);
    if (!Number.isFinite(s) || !Number.isFinite(e)) continue;

    for (const cell of cells) {
      if (s < cell.endMs && e > cell.startMs) {
        map.get(cell.dayKey)?.push(booking);
      }
    }
  }

  for (const cell of cells) {
    const arr = map.get(cell.dayKey);
    if (arr) {
      arr.sort((a, b) => Date.parse(a.start_at) - Date.parse(b.start_at));
    }
  }

  return map;
}

export function formatMonthTitle(monthAnchor: string): string {
  const anchor = parseUtcCalendarDateString(monthAnchor) ?? monthAnchor;
  const ms = utcMidnightMsFromYmd(anchor);
  return new Date(ms).toLocaleDateString("en-GB", {
    month: "long",
    year: "numeric",
    timeZone: "UTC",
  });
}

function isoFromDayMinutes(dayKey: string, minutesUtc: number): string | null {
  const ymd = parseUtcCalendarDateString(dayKey);
  if (!ymd) return null;
  const mid = utcMidnightMsFromYmd(ymd);
  return new Date(mid + minutesUtc * 60_000).toISOString();
}

function defaultWaitlistDropMinutes(cfg: BusinessGridConfig): number {
  return cfg.dayStartHourUtc * 60 + 60;
}

function formatPillTime(iso: string, timezone?: string | null): string {
  return new Date(iso).toLocaleTimeString(undefined, {
    hour: "numeric",
    minute: "2-digit",
    timeZone: timezone?.trim() || "UTC",
  });
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
  resourceColumns: OperationalCalendarResourceColumn[]
): ProviderDaySummary[] {
  const counts = new Map<string, number>();

  for (const booking of dayBookings) {
    const colId = resourceColumnIdForBooking(booking);
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

function MonthAppointmentPill({
  booking,
  label,
  draggable,
  onSelect,
}: {
  booking: FiBookingRow;
  label: string;
  draggable: boolean;
  onSelect: () => void;
}) {
  const meta = booking.metadata ?? {};
  const isVirtual = Boolean(meta.is_virtual ?? meta.virtual ?? meta.zoom);
  const appointmentStyle = getAppointmentStyle({
    procedureType: booking.booking_type,
    status: booking.booking_status,
    isVirtual,
  });
  const Icon = appointmentStyle.icon;
  const time = formatPillTime(booking.start_at, booking.timezone);

  const { attributes, listeners, setNodeRef, transform, isDragging } = useDraggable({
    id: booking.id,
    disabled: !draggable,
    data: {
      type: "appointment",
      appointment: appointmentCardDataFromBooking(booking, { anchorLabel: label }),
    },
  });

  return (
    <button
      ref={setNodeRef}
      type="button"
      {...(draggable ? { ...listeners, ...attributes } : {})}
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
        isDragging && "z-10 scale-[1.02] opacity-80 shadow-lg ring-2 ring-sky-400/30"
      )}
    >
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
}

function MonthDayCell({
  cell,
  dayBookings,
  bookingDisplay,
  resourceColumns,
  droppable,
  draggableAppointments,
  onDayClick,
  onSelectBooking,
}: {
  cell: MonthGridCell;
  dayBookings: FiBookingRow[];
  bookingDisplay: Record<string, OperationalCalendarBookingDisplay>;
  resourceColumns: OperationalCalendarResourceColumn[];
  droppable: boolean;
  draggableAppointments: boolean;
  onDayClick: (dayKey: string) => void;
  onSelectBooking: (b: FiBookingRow) => void;
}) {
  const { setNodeRef, isOver } = useDroppable({
    id: monthDayDropId(cell.dayKey),
    disabled: !droppable,
    data: { dayKey: cell.dayKey },
  });

  const visible = dayBookings.slice(0, MONTH_MAX_VISIBLE_APPOINTMENTS);
  const overflow = dayBookings.length - visible.length;
  const providerSummary = summarizeProvidersForDay(dayBookings, resourceColumns);
  const visibleProviders = providerSummary.slice(0, 4);
  const overflowProviders = providerSummary.length - visibleProviders.length;
  const isQuietDay = cell.inCurrentMonth && dayBookings.length === 0;

  return (
    <motion.div
      ref={setNodeRef}
      variants={{
        hidden: { opacity: 0, y: 4 },
        show: { opacity: 1, y: 0, transition: { duration: 0.14 } },
      }}
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
        onClick={() => onDayClick(cell.dayKey)}
        className="mb-1.5 flex w-full items-start justify-between gap-1 text-left focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-sky-400/40"
        aria-label={`Open day view for ${cell.dayKey}`}
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
            onClick={() => onDayClick(cell.dayKey)}
            className="mt-auto w-full rounded-md border border-dashed border-[#1e2937]/80 px-1.5 py-1 text-[10px] font-medium text-slate-600 opacity-0 transition group-hover/cell:opacity-100 hover:border-slate-600 hover:bg-slate-900/50 hover:text-slate-300"
          >
            Open · click to schedule
          </button>
        ) : null}
      </div>
    </motion.div>
  );
}

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
  gridConfig,
  canMutateBookings,
  onSelectBooking,
  onRescheduleBooking,
  tenantId,
  query,
  onNavigateDay,
  onNavigateMonth,
  calendarRoute = "fi-admin",
}: MonthViewProps) {
  const router = useRouter();
  const { success, error: toastError } = useCalendarToast();
  const [activeDrag, setActiveDrag] = useState<AppointmentCardData | null>(null);

  const sensors = useSensors(
    useSensor(PointerSensor, calendarPointerSensorOptions("desktop")),
    useSensor(TouchSensor, calendarTouchSensorOptions())
  );

  const cells = useMemo(() => buildMonthGridCells(monthAnchor), [monthAnchor]);
  const buckets = useMemo(() => bucketBookingsForMonthCells(bookings, cells), [bookings, cells]);
  const monthTitle = useMemo(() => formatMonthTitle(monthAnchor), [monthAnchor]);

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
      const nextAnchor = addUtcMonthsToCalendarDate(monthAnchor, delta);
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
    [calendarRoute, monthAnchor, onNavigateMonth, query, router, tenantId]
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

      const dayKey = parseMonthDayDropId(String(over.id));
      if (!dayKey) return;

      const waitlistBookingId = parseWaitlistDragId(String(active.id));
      const bookingId = waitlistBookingId ?? String(active.id);
      const booking = bookings.find((b) => b.id === bookingId);
      if (!booking) return;

      const waitData = active.data.current as { item?: { durationMin?: number } } | undefined;
      const durationMin = waitlistBookingId
        ? Math.max(30, waitData?.item?.durationMin ?? 30)
        : Math.max(
            15,
            Math.round((Date.parse(booking.end_at) - Date.parse(booking.start_at)) / 60_000) || 30
          );

      let startMin = defaultWaitlistDropMinutes(gridConfig);
      if (!waitlistBookingId) {
        const origMs = Date.parse(booking.start_at);
        if (Number.isFinite(origMs)) {
          const d = new Date(origMs);
          startMin = d.getUTCHours() * 60 + d.getUTCMinutes();
        }
      }
      const startIso = isoFromDayMinutes(dayKey, startMin);
      const endIso = isoFromDayMinutes(dayKey, startMin + durationMin);
      if (!startIso || !endIso) return;

      const meta: MonthViewRescheduleMeta | undefined = waitlistBookingId ? { clearWaitlist: true } : undefined;
      const result = await onRescheduleBooking(booking, startIso, endIso, meta);

      if (result.ok) {
        success(waitlistBookingId ? "Scheduled from waitlist" : "Appointment moved");
      } else {
        toastError(result.error ?? "Could not update appointment");
      }
    },
    [bookings, canMutateBookings, gridConfig, onRescheduleBooking, success, toastError]
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
        variants={calendarShellVariants}
        initial="hidden"
        animate="show"
        className={cn(
          "fi-calendar-shell flex min-h-[min(36rem,78dvh)] flex-col overflow-hidden rounded-xl border shadow-sm ring-1",
          "border-[#1e2937] bg-[#0f172a] shadow-black/30 ring-white/[0.04]",
          "md:min-h-[36rem] md:rounded-2xl lg:min-h-[calc(100dvh-13rem)]"
        )}
      >
        <div className="flex min-h-0 min-w-0 flex-1">
          {sidebar}

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

            <motion.div
              variants={staggerContainerVariants}
              initial="hidden"
              animate="show"
              className="grid min-h-0 flex-1 auto-rows-fr grid-cols-7 overflow-y-auto overscroll-y-contain"
            >
              {cells.map((cell) => (
                <MonthDayCell
                  key={cell.dayKey}
                  cell={cell}
                  dayBookings={buckets.get(cell.dayKey) ?? []}
                  bookingDisplay={bookingDisplay}
                  resourceColumns={resourceColumns}
                  droppable={canMutateBookings}
                  draggableAppointments={canMutateBookings}
                  onDayClick={openDay}
                  onSelectBooking={onSelectBooking}
                />
              ))}
            </motion.div>
          </div>

          {rightPanel}
        </div>
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
