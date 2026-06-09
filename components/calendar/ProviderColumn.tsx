"use client";

import { useDroppable } from "@dnd-kit/core";
import { AnimatePresence } from "framer-motion";
import { useEffect, useMemo, useState, type MouseEvent } from "react";

import { AppointmentCardFromBooking } from "@/components/calendar/AppointmentCard";
import { BusinessTimeSlotGrid } from "@/components/calendar/BusinessTimeSlotGrid";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { snapCalendarMinutes } from "@/lib/calendar/dndMath";
import { calendarGridBodyHeightPx as timeSlotsGridHeightPx } from "@/lib/calendar/time-slots";
import type { CalendarViewportRange } from "@/lib/calendar/virtualizeAppointments";
import {
  filterVisibleAppointmentIds,
  shouldVirtualizeAppointments,
} from "@/lib/calendar/virtualizeAppointments";
import { cn } from "@/lib/utils";
import {
  calendarDateStringFromInstant,
  clinicLocalSlotToUtcIso,
  logFiCalendarTimezoneDebug,
  minutesFromLaneStart as minutesFromLaneStartTz,
  parseIsoUtcMs,
  toDatetimeLocalValueInTimezone,
  zonedMidnightUtcMs,
} from "@/src/lib/calendar/calendarTimezone";
import type { CalendarDayLane } from "@/src/lib/bookings/calendarView";
import type { FiBookingRow } from "@/src/lib/bookings/types";
import type { BusinessGridConfig } from "@/src/lib/calendar/operationalCalendarLayout";
import type { OperationalCalendarBookingDisplay } from "@/src/lib/calendar/operationalCalendarTypes";

// ---------------------------------------------------------------------------
// Shared calendar grid tokens (used by WeekView + ProviderColumn)
// ---------------------------------------------------------------------------

export const CALENDAR_GRID_BG = "#0f172a";
export const CALENDAR_PX_PER_HOUR = 56;
export const CALENDAR_GRID_LINE_MINUTES = 30;
export const CALENDAR_HEADER_HEIGHT_PX = 56;
export const CALENDAR_COLUMN_MIN_WIDTH_PX = 196;

export type ProviderColumnOverlapLayout = {
  topPx: number;
  heightPx: number;
  leftPct: number;
  widthPct: number;
  zIndex: number;
};

type TimedBooking = {
  booking: FiBookingRow;
  startMin: number;
  endMin: number;
};

// ---------------------------------------------------------------------------
// Layout helpers
// ---------------------------------------------------------------------------

export function calendarPxPerMinute(): number {
  return CALENDAR_PX_PER_HOUR / 60;
}

export function calendarGridBodyHeightPx(): number {
  return timeSlotsGridHeightPx(CALENDAR_PX_PER_HOUR);
}

export function providerColumnDropId(dayKey: string, columnId: string): string {
  return `drop:${dayKey}:${columnId}`;
}

export function parseProviderColumnDropId(id: string): { dayKey: string; columnId: string } | null {
  if (!id.startsWith("drop:")) return null;
  const rest = id.slice(5);
  const sep = rest.indexOf(":");
  if (sep <= 0) return null;
  return { dayKey: rest.slice(0, sep), columnId: rest.slice(sep + 1) };
}

export function layoutBookingInCalendarPx(
  booking: FiBookingRow,
  lane: CalendarDayLane,
  cfg: BusinessGridConfig
): { topPx: number; heightPx: number } | null {
  const s = parseIsoUtcMs(booking.start_at);
  const e = parseIsoUtcMs(booking.end_at);
  if (s == null || e == null) return null;

  const clampS = Math.max(s, lane.startMs);
  const clampE = Math.min(e, lane.endMs);
  if (clampE <= clampS) return null;

  const gridStartMin = cfg.dayStartHourUtc * 60;
  const gridEndMin = cfg.dayEndHourUtc * 60;
  const startMin = minutesFromLaneStartTz(lane.startMs, clampS);
  const endMin = minutesFromLaneStartTz(lane.startMs, clampE);

  const visStart = Math.max(startMin, gridStartMin);
  const visEnd = Math.min(endMin, gridEndMin);
  if (visEnd <= visStart) return null;

  const ppm = calendarPxPerMinute();
  const topPx = (visStart - gridStartMin) * ppm;
  const heightPx = Math.max((visEnd - visStart) * ppm, 44);
  return { topPx, heightPx };
}

function timedBookingsForColumn(
  bookings: FiBookingRow[],
  lane: CalendarDayLane,
  cfg: BusinessGridConfig
): TimedBooking[] {
  const gridStart = cfg.dayStartHourUtc * 60;
  const gridEnd = cfg.dayEndHourUtc * 60;
  const out: TimedBooking[] = [];

  for (const booking of bookings) {
    const s = parseIsoUtcMs(booking.start_at);
    const e = parseIsoUtcMs(booking.end_at);
    if (s == null || e == null) continue;
    const clampS = Math.max(s, lane.startMs);
    const clampE = Math.min(e, lane.endMs);
    if (clampE <= clampS) continue;

    const startMin = minutesFromLaneStartTz(lane.startMs, clampS);
    const endMin = minutesFromLaneStartTz(lane.startMs, clampE);
    const visStart = Math.max(startMin, gridStart);
    const visEnd = Math.min(endMin, gridEnd);
    if (visEnd <= visStart) continue;

    out.push({ booking, startMin: visStart, endMin: visEnd });
  }

  return out;
}

export function computeProviderColumnOverlapLayouts(
  appointments: FiBookingRow[],
  lane: CalendarDayLane,
  cfg: BusinessGridConfig
): Map<string, ProviderColumnOverlapLayout> {
  const items = timedBookingsForColumn(appointments, lane, cfg);
  const out = new Map<string, ProviderColumnOverlapLayout>();
  if (items.length === 0) return out;

  const sorted = [...items].sort((a, b) => a.startMin - b.startMin || b.endMin - a.endMin);
  const colEnds: number[] = [];
  const colById = new Map<string, number>();

  for (const item of sorted) {
    let col = colEnds.findIndex((end) => end <= item.startMin);
    if (col === -1) {
      col = colEnds.length;
      colEnds.push(item.endMin);
    } else {
      colEnds[col] = item.endMin;
    }
    colById.set(item.booking.id, col);
  }

  for (const item of sorted) {
    const overlapping = sorted.filter(
      (o) => o.booking.id !== item.booking.id && o.startMin < item.endMin && o.endMin > item.startMin
    );
    const group = [item, ...overlapping];
    const totalCols = Math.max(1, ...group.map((g) => (colById.get(g.booking.id) ?? 0) + 1));
    const col = colById.get(item.booking.id) ?? 0;
    const base = layoutBookingInCalendarPx(item.booking, lane, cfg);
    if (!base) continue;

    const widthPct = 100 / totalCols;
    out.set(item.booking.id, {
      topPx: base.topPx,
      heightPx: base.heightPx,
      leftPct: col * widthPct,
      widthPct,
      zIndex: 2 + col,
    });
  }

  return out;
}

function providerInitials(name: string): string {
  const parts = name.trim().split(/\s+/).filter(Boolean);
  if (parts.length === 0) return "?";
  if (parts.length === 1) return parts[0].slice(0, 2).toUpperCase();
  return `${parts[0][0] ?? ""}${parts[parts.length - 1][0] ?? ""}`.toUpperCase();
}

// ---------------------------------------------------------------------------
// Internal grid primitives
// ---------------------------------------------------------------------------

function CurrentTimeLine({
  dayKey,
  gridConfig,
  bodyHeightPx,
}: {
  dayKey: string;
  gridConfig: BusinessGridConfig;
  bodyHeightPx: number;
}) {
  const [nowTop, setNowTop] = useState<number | null>(null);

  useEffect(() => {
    function tick() {
      const today = calendarDateStringFromInstant(new Date(), gridConfig.timeZone);
      if (dayKey !== today) {
        setNowTop(null);
        return;
      }
      const dayStart = zonedMidnightUtcMs(dayKey, gridConfig.timeZone);
      if (dayStart == null) {
        setNowTop(null);
        return;
      }
      const nowMin = minutesFromLaneStartTz(dayStart, Date.now());
      const gridStart = gridConfig.dayStartHourUtc * 60;
      const gridEnd = gridConfig.dayEndHourUtc * 60;
      if (nowMin < gridStart || nowMin > gridEnd) {
        setNowTop(null);
        return;
      }
      setNowTop((nowMin - gridStart) * calendarPxPerMinute());
    }
    tick();
    const id = window.setInterval(tick, 60_000);
    return () => window.clearInterval(id);
  }, [dayKey, gridConfig.dayEndHourUtc, gridConfig.dayStartHourUtc, gridConfig.timeZone]);

  if (nowTop == null || nowTop < 0 || nowTop > bodyHeightPx) return null;

  return (
    <div className="pointer-events-none absolute inset-x-0 z-30" style={{ top: nowTop }} aria-hidden>
      <div className="relative flex items-center">
        <span className="absolute -left-1 h-2.5 w-2.5 rounded-full bg-red-500 shadow-sm ring-2 ring-white" />
        <div className="h-[2px] w-full rounded-full bg-red-500/90 shadow-[0_0_6px_rgb(239_68_68/0.45)]" />
      </div>
    </div>
  );
}

export function ProviderColumnHeader({
  name,
  role,
  photoUrl,
  highlighted,
  readinessWarning,
  ownerColumn,
}: {
  name: string;
  role?: string | null;
  photoUrl?: string | null;
  highlighted?: boolean;
  readinessWarning?: string | null;
  ownerColumn?: boolean;
}) {
  return (
    <div
      className={cn(
        "sticky top-0 z-10 flex items-center gap-2.5 border-b border-[#1e2937] px-3 backdrop-blur-sm transition-colors",
        highlighted
          ? "bg-sky-950/40 ring-1 ring-inset ring-sky-400/30"
          : "bg-[#0f172a]/95"
      )}
      style={{ height: CALENDAR_HEADER_HEIGHT_PX }}
    >
      <Avatar className="h-8 w-8 shrink-0 ring-1 ring-[#1e2937]">
        {photoUrl ? <AvatarImage src={photoUrl} alt={name} /> : null}
        <AvatarFallback className="bg-slate-800 text-[10px] font-semibold text-slate-300">
          {providerInitials(name)}
        </AvatarFallback>
      </Avatar>
      <div className="min-w-0 flex-1">
        <p className="truncate text-sm font-semibold tracking-tight text-slate-100">{name}</p>
        <div className="flex min-w-0 flex-wrap items-center gap-1">
          {role ? <p className="truncate text-[11px] font-medium text-slate-400">{role}</p> : null}
          {ownerColumn ? (
            <span className="shrink-0 rounded bg-slate-700/80 px-1.5 py-0.5 text-[9px] font-semibold uppercase tracking-wide text-slate-300">
              Owner
            </span>
          ) : null}
          {readinessWarning ? (
            <span
              className="shrink-0 rounded bg-amber-950/70 px-1.5 py-0.5 text-[9px] font-medium text-amber-200 ring-1 ring-amber-500/35"
              title={readinessWarning}
            >
              Blocked
            </span>
          ) : null}
        </div>
      </div>
    </div>
  );
}

// ---------------------------------------------------------------------------
// ProviderColumn
// ---------------------------------------------------------------------------

export type ProviderColumnProps = {
  /** Unique column id — used for dnd-kit drop zone. */
  id: string;
  /** Clinic-local `YYYY-MM-DD` for drop targeting and now-line. */
  dayKey: string;
  name: string;
  role?: string | null;
  photoUrl?: string | null;
  readinessWarning?: string | null;
  ownerColumn?: boolean;
  appointments: FiBookingRow[];
  lane: CalendarDayLane;
  gridConfig: BusinessGridConfig;
  bookingDisplay?: Record<string, OperationalCalendarBookingDisplay>;
  /** Emphasise the active provider column. */
  highlighted?: boolean;
  /** Enable @dnd-kit drop zone on the time grid. */
  droppable?: boolean;
  /** Allow dragging appointment cards within the parent DndContext. */
  draggable?: boolean;
  /** Allow vertical resize on appointment cards. */
  resizable?: boolean;
  /** Full-width stacked column (mobile / tablet swipe). */
  stacked?: boolean;
  /** Larger drag targets for touch devices. */
  touchFriendly?: boolean;
  onSelectAppointment?: (booking: FiBookingRow) => void;
  onResizeAppointment?: (booking: FiBookingRow, endIso: string) => void;
  /** Shared vertical scroll viewport for virtualization. */
  viewportRange?: CalendarViewportRange;
  /** Keep dragged card mounted while virtualizing. */
  pinnedAppointmentId?: string | null;
  /** Booking ids awaiting PATCH after optimistic reschedule. */
  pendingAppointmentIds?: ReadonlySet<string> | null;
  /** Emphasise a booking after quick-create save. */
  highlightedBookingId?: string | null;
  /** Click empty grid area to book (e.g. quick call-in modal). */
  onEmptySlotClick?: (info: { dayKey: string; columnId: string; localStart: string }) => void;
  /** Right-click empty grid — quick actions menu (e.g. templates + block). */
  onEmptySlotContextMenu?: (info: { dayKey: string; columnId: string; localStart: string; clientX: number; clientY: number }) => void;
  bodyHeightPx?: number;
  minWidthPx?: number;
  className?: string;
};

export function ProviderColumn({
  id,
  dayKey,
  name,
  role,
  photoUrl,
  readinessWarning,
  ownerColumn,
  appointments,
  lane,
  gridConfig,
  bookingDisplay = {},
  highlighted = false,
  droppable = false,
  draggable = false,
  resizable = false,
  stacked = false,
  touchFriendly = false,
  onSelectAppointment,
  onResizeAppointment,
  viewportRange,
  pinnedAppointmentId,
  pendingAppointmentIds,
  highlightedBookingId,
  onEmptySlotClick,
  onEmptySlotContextMenu,
  bodyHeightPx: bodyHeightPxProp,
  minWidthPx = CALENDAR_COLUMN_MIN_WIDTH_PX,
  className,
}: ProviderColumnProps) {
  const bodyHeightPx = bodyHeightPxProp ?? calendarGridBodyHeightPx();

  const overlapLayouts = useMemo(
    () => computeProviderColumnOverlapLayouts(appointments, lane, gridConfig),
    [appointments, lane, gridConfig]
  );

  const virtualize = shouldVirtualizeAppointments(appointments.length);
  const visibleIds = useMemo(() => {
    if (!virtualize || !viewportRange) {
      return new Set(appointments.map((a) => a.id));
    }
    return filterVisibleAppointmentIds(
      overlapLayouts,
      viewportRange,
      pinnedAppointmentId ? [pinnedAppointmentId] : undefined
    );
  }, [appointments, overlapLayouts, pinnedAppointmentId, viewportRange, virtualize]);

  const { setNodeRef, isOver } = useDroppable({
    id: providerColumnDropId(dayKey, id),
    disabled: !droppable,
    data: { dayKey, columnId: id, providerName: name },
  });

  function slotFromClientY(clientY: number, target: HTMLButtonElement) {
    const rect = target.getBoundingClientRect();
    const y = clientY - rect.top;
    const ppm = calendarPxPerMinute();
    const rawMin = gridConfig.dayStartHourUtc * 60 + y / ppm;
    const snapped = snapCalendarMinutes(rawMin, gridConfig);
    const iso = clinicLocalSlotToUtcIso(dayKey, snapped, gridConfig.timeZone);
    if (!iso) return null;
    const localStart = toDatetimeLocalValueInTimezone(iso, gridConfig.timeZone);
    logFiCalendarTimezoneDebug("empty-slot-click", {
      dayKey,
      snappedMinutesFromLocalMidnight: snapped,
      clinicTimezone: gridConfig.timeZone,
      slotUtcIso: iso,
      datetimeLocalValue: localStart,
    });
    return { localStart };
  }

  const handleEmptySlotClick = (e: MouseEvent<HTMLButtonElement>) => {
    if (!onEmptySlotClick) return;
    if (e.button !== 0) return;
    const slot = slotFromClientY(e.clientY, e.currentTarget);
    if (!slot) return;
    onEmptySlotClick({ dayKey, columnId: id, localStart: slot.localStart });
  };

  const handleEmptySlotContextMenu = (e: MouseEvent<HTMLButtonElement>) => {
    if (!onEmptySlotContextMenu) return;
    e.preventDefault();
    const slot = slotFromClientY(e.clientY, e.currentTarget);
    if (!slot) return;
    onEmptySlotContextMenu({ dayKey, columnId: id, localStart: slot.localStart, clientX: e.clientX, clientY: e.clientY });
  };

  return (
    <div
      className={cn(
        "flex flex-col border-[#1e2937]/80 transition-colors",
        stacked
          ? "min-w-full w-full flex-none border-b border-l-0 last:border-b-0"
          : "min-w-[var(--col-min)] flex-1 border-l first:border-l-0",
        highlighted && "bg-sky-950/20 ring-1 ring-inset ring-sky-400/25",
        className
      )}
      style={{ "--col-min": stacked ? "100%" : `${minWidthPx}px` } as React.CSSProperties}
    >
      <ProviderColumnHeader
        name={name}
        role={role}
        photoUrl={photoUrl}
        highlighted={highlighted || isOver}
        readinessWarning={readinessWarning}
        ownerColumn={ownerColumn}
      />

      <div
        ref={setNodeRef}
        className={cn(
          "relative flex-1 transition-colors",
          isOver && "bg-sky-950/30 ring-1 ring-inset ring-sky-400/30"
        )}
        style={{ minHeight: bodyHeightPx, backgroundColor: CALENDAR_GRID_BG }}
      >
        <BusinessTimeSlotGrid
          bodyHeightPx={bodyHeightPx}
          gridHours={{ dayStartHourUtc: gridConfig.dayStartHourUtc, dayEndHourUtc: gridConfig.dayEndHourUtc }}
        />
        <CurrentTimeLine dayKey={dayKey} gridConfig={gridConfig} bodyHeightPx={bodyHeightPx} />

        {onEmptySlotClick || onEmptySlotContextMenu ? (
          <button
            type="button"
            tabIndex={-1}
            aria-label={`Book appointment in ${name} column at selected time`}
            className="absolute inset-0 z-[1] cursor-cell bg-transparent"
            style={{ height: bodyHeightPx }}
            onClick={handleEmptySlotClick}
            onContextMenu={handleEmptySlotContextMenu}
          />
        ) : null}

        <div className="relative z-[2]" style={{ height: bodyHeightPx }}>
          <AnimatePresence initial={false}>
            {appointments.map((booking) => {
                const layout = overlapLayouts.get(booking.id);
                if (!layout || !visibleIds.has(booking.id)) return null;
                const d = bookingDisplay[booking.id];
                const isPendingSave = Boolean(pendingAppointmentIds?.has(booking.id));
                return (
                  <AppointmentCardFromBooking
                    key={booking.id}
                    booking={booking}
                    display={{
                      anchorLabel: d?.anchorLabel,
                      durationMin: d?.durationMin,
                      providerName: name,
                      roomName: d?.roomLabel ?? booking.location,
                      procedureCatalogName: d?.procedureCatalogName,
                      procedureCatalogHex: d?.procedureCatalogHex,
                      suggestedPrice: d?.suggestedPrice,
                    }}
                    layout={layout}
                    draggable={draggable}
                    resizable={resizable}
                    touchFriendly={touchFriendly}
                    animateEntry
                    isPendingSave={isPendingSave}
                    isHighlighted={highlightedBookingId === booking.id}
                    calendarTimezone={gridConfig.timeZone}
                    onResizeEnd={
                      onResizeAppointment ? (endIso) => onResizeAppointment(booking, endIso) : undefined
                    }
                    onClick={onSelectAppointment ? () => onSelectAppointment(booking) : undefined}
                  />
                );
              })}
          </AnimatePresence>
        </div>
      </div>
    </div>
  );
}
