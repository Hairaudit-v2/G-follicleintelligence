"use client";

import { useDroppable } from "@dnd-kit/core";
import { useEffect, useMemo, useState } from "react";

import { AppointmentCardFromBooking } from "@/components/calendar/AppointmentCard";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { cn } from "@/lib/utils";
import type { CalendarDayLane } from "@/src/lib/bookings/calendarView";
import type { FiBookingRow } from "@/src/lib/bookings/types";
import type { BusinessGridConfig } from "@/src/lib/calendar/operationalCalendarLayout";
import type { OperationalCalendarBookingDisplay } from "@/src/lib/calendar/operationalCalendarTypes";

// ---------------------------------------------------------------------------
// Shared calendar grid tokens (used by WeekView + ProviderColumn)
// ---------------------------------------------------------------------------

export const CALENDAR_GRID_BG = "#f8fafc";
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

export function calendarGridBodyHeightPx(cfg: BusinessGridConfig): number {
  return Math.max(1, cfg.dayEndHourUtc - cfg.dayStartHourUtc) * CALENDAR_PX_PER_HOUR;
}

function minutesUtcFromEpoch(ms: number): number {
  const d = new Date(ms);
  return d.getUTCHours() * 60 + d.getUTCMinutes();
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
  const s = Date.parse(booking.start_at);
  const e = Date.parse(booking.end_at);
  if (!Number.isFinite(s) || !Number.isFinite(e)) return null;

  const clampS = Math.max(s, lane.startMs);
  const clampE = Math.min(e, lane.endMs);
  if (clampE <= clampS) return null;

  const gridStartMin = cfg.dayStartHourUtc * 60;
  const gridEndMin = cfg.dayEndHourUtc * 60;
  const startMin = minutesUtcFromEpoch(clampS);
  const endMin = minutesUtcFromEpoch(clampE);

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
    const s = Date.parse(booking.start_at);
    const e = Date.parse(booking.end_at);
    if (!Number.isFinite(s) || !Number.isFinite(e)) continue;
    const clampS = Math.max(s, lane.startMs);
    const clampE = Math.min(e, lane.endMs);
    if (clampE <= clampS) continue;

    const startMin = minutesUtcFromEpoch(clampS);
    const endMin = minutesUtcFromEpoch(clampE);
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

function TimeSlotGrid({ gridConfig, bodyHeightPx }: { gridConfig: BusinessGridConfig; bodyHeightPx: number }) {
  const slotH = CALENDAR_PX_PER_HOUR * (CALENDAR_GRID_LINE_MINUTES / 60);
  const count = ((gridConfig.dayEndHourUtc - gridConfig.dayStartHourUtc) * 60) / CALENDAR_GRID_LINE_MINUTES;

  return (
    <div className="pointer-events-none absolute inset-0" aria-hidden>
      {Array.from({ length: count }, (_, i) => (
        <div
          key={i}
          className={cn(
            "absolute left-0 right-0 border-t",
            i % 2 === 0 ? "border-slate-200/70" : "border-slate-100/90"
          )}
          style={{ top: i * slotH, height: slotH }}
        />
      ))}
      <div className="absolute inset-x-0 border-t border-slate-200/70" style={{ top: bodyHeightPx - 1 }} />
    </div>
  );
}

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
      const today = new Date().toISOString().slice(0, 10);
      if (dayKey !== today) {
        setNowTop(null);
        return;
      }
      const nowMin = minutesUtcFromEpoch(Date.now());
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
  }, [dayKey, gridConfig.dayEndHourUtc, gridConfig.dayStartHourUtc]);

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
}: {
  name: string;
  role?: string | null;
  photoUrl?: string | null;
  highlighted?: boolean;
}) {
  return (
    <div
      className={cn(
        "sticky top-0 z-10 flex items-center gap-2.5 border-b px-3 backdrop-blur-sm transition-colors",
        highlighted
          ? "border-sky-200/80 bg-sky-50/90 ring-1 ring-inset ring-sky-300/50"
          : "border-slate-200/80 bg-white/95"
      )}
      style={{ height: CALENDAR_HEADER_HEIGHT_PX }}
    >
      <Avatar className="h-8 w-8 shrink-0 ring-1 ring-slate-200/80">
        {photoUrl ? <AvatarImage src={photoUrl} alt={name} /> : null}
        <AvatarFallback className="bg-slate-100 text-[10px] font-semibold text-slate-700">
          {providerInitials(name)}
        </AvatarFallback>
      </Avatar>
      <div className="min-w-0">
        <p className="truncate text-sm font-semibold tracking-tight text-slate-900">{name}</p>
        {role ? <p className="truncate text-[11px] font-medium text-slate-500">{role}</p> : null}
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
  /** UTC day key (`YYYY-MM-DD`) for drop targeting and now-line. */
  dayKey: string;
  name: string;
  role?: string | null;
  photoUrl?: string | null;
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
  onSelectAppointment?: (booking: FiBookingRow) => void;
  onResizeAppointment?: (booking: FiBookingRow, endIso: string) => void;
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
  appointments,
  lane,
  gridConfig,
  bookingDisplay = {},
  highlighted = false,
  droppable = false,
  draggable = false,
  resizable = false,
  onSelectAppointment,
  onResizeAppointment,
  bodyHeightPx: bodyHeightPxProp,
  minWidthPx = CALENDAR_COLUMN_MIN_WIDTH_PX,
  className,
}: ProviderColumnProps) {
  const bodyHeightPx = bodyHeightPxProp ?? calendarGridBodyHeightPx(gridConfig);

  const overlapLayouts = useMemo(
    () => computeProviderColumnOverlapLayouts(appointments, lane, gridConfig),
    [appointments, lane, gridConfig]
  );

  const { setNodeRef, isOver } = useDroppable({
    id: providerColumnDropId(dayKey, id),
    disabled: !droppable,
    data: { dayKey, columnId: id, providerName: name },
  });

  return (
    <div
      className={cn(
        "flex min-w-[var(--col-min)] flex-1 flex-col border-l border-slate-200/70 first:border-l-0 transition-colors",
        highlighted && "bg-sky-50/30 ring-1 ring-inset ring-sky-200/60",
        className
      )}
      style={{ "--col-min": `${minWidthPx}px` } as React.CSSProperties}
    >
      <ProviderColumnHeader name={name} role={role} photoUrl={photoUrl} highlighted={highlighted || isOver} />

      <div
        ref={setNodeRef}
        className={cn(
          "relative flex-1 transition-colors",
          isOver && "bg-sky-50/70 ring-1 ring-inset ring-sky-300/45"
        )}
        style={{ minHeight: bodyHeightPx, backgroundColor: CALENDAR_GRID_BG }}
      >
        <TimeSlotGrid gridConfig={gridConfig} bodyHeightPx={bodyHeightPx} />
        <CurrentTimeLine dayKey={dayKey} gridConfig={gridConfig} bodyHeightPx={bodyHeightPx} />

        <div className="relative" style={{ height: bodyHeightPx }}>
          {appointments.map((booking) => {
            const layout = overlapLayouts.get(booking.id);
            if (!layout) return null;
            const d = bookingDisplay[booking.id];
            return (
              <AppointmentCardFromBooking
                key={booking.id}
                booking={booking}
                display={{
                  anchorLabel: d?.anchorLabel,
                  durationMin: d?.durationMin,
                  providerName: name,
                  roomName: booking.location,
                }}
                layout={layout}
                draggable={draggable}
                resizable={resizable}
                onResizeEnd={
                  onResizeAppointment ? (endIso) => onResizeAppointment(booking, endIso) : undefined
                }
                onClick={onSelectAppointment ? () => onSelectAppointment(booking) : undefined}
              />
            );
          })}
        </div>
      </div>
    </div>
  );
}
