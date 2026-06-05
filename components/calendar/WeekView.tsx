"use client";

import {
  DndContext,
  DragOverlay,
  PointerSensor,
  pointerWithin,
  useSensor,
  useSensors,
  type DragEndEvent,
  type DragStartEvent,
  type Modifier,
} from "@dnd-kit/core";
import { useCallback, useMemo, useState, type ReactNode } from "react";

import { AppointmentCard, type AppointmentCardData } from "@/components/calendar/AppointmentCard";
import { CalendarToastProvider, useCalendarToast } from "@/components/calendar/CalendarToast";
import { parseWaitlistDragId } from "@/components/calendar/SidebarAgenda";
import {
  CALENDAR_COLUMN_MIN_WIDTH_PX,
  CALENDAR_GRID_BG,
  CALENDAR_HEADER_HEIGHT_PX,
  CALENDAR_PX_PER_HOUR,
  ProviderColumn,
  calendarGridBodyHeightPx,
  calendarPxPerMinute,
  parseProviderColumnDropId,
} from "@/components/calendar/ProviderColumn";
import {
  CALENDAR_SNAP_MINUTES,
  dropMinutesFromDragEvent,
  minutesUtcFromEpoch,
} from "@/lib/calendar/dndMath";
import { calendarDayHeading } from "@/src/lib/bookings/calendarLabels";
import { parseUtcCalendarDateString } from "@/src/lib/bookings/calendarQuery";
import type { CalendarDayLane } from "@/src/lib/bookings/calendarView";
import type { FiBookingRow } from "@/src/lib/bookings/types";
import { resourceColumnIdForBooking, type BusinessGridConfig } from "@/src/lib/calendar/operationalCalendarLayout";
import type {
  OperationalCalendarBookingDisplay,
  OperationalCalendarResourceColumn,
} from "@/src/lib/calendar/operationalCalendarTypes";

const TIME_GUTTER_WIDTH_PX = 56;

export type WeekViewRescheduleMeta = {
  assignedUserId?: string | null;
  clinicId?: string | null;
  /** Clear waitlist flag when scheduling from the sidebar waitlist. */
  clearWaitlist?: boolean;
};

function usesProviderColumns(view: string): boolean {
  return view === "day";
}

export type WeekViewProps = {
  /** Left agenda sidebar — must render inside this DndContext (e.g. SidebarAgenda). */
  sidebar?: ReactNode;
  /** Right insights panel — rendered inside DndContext sibling to grid. */
  rightPanel?: ReactNode;
  view: "day" | "3day" | "week";
  lanes: CalendarDayLane[];
  buckets: Record<string, FiBookingRow[]>;
  gridConfig: BusinessGridConfig;
  bookingDisplay: Record<string, OperationalCalendarBookingDisplay>;
  resourceColumns: OperationalCalendarResourceColumn[];
  canMutateBookings: boolean;
  bookings: FiBookingRow[];
  /** Highlight a provider column by id (day view). */
  highlightedColumnId?: string | null;
  onSelectBooking: (b: FiBookingRow) => void;
  onRescheduleBooking: (
    booking: FiBookingRow,
    startIso: string,
    endIso: string,
    meta?: WeekViewRescheduleMeta
  ) => Promise<{ ok: boolean; error?: string }>;
};

type CalendarColumn = {
  id: string;
  label: string;
  subtitle: string | null;
  dayKey: string;
  photoUrl?: string | null;
};

function snapToQuarterHourModifier(): Modifier {
  const slotPx = calendarPxPerMinute() * CALENDAR_SNAP_MINUTES;
  return ({ transform }) => ({
    ...transform,
    y: Math.round(transform.y / slotPx) * slotPx,
  });
}

function utcMidnightMs(dayKey: string): number | null {
  const ymd = parseUtcCalendarDateString(dayKey);
  if (!ymd) return null;
  const y = Number(ymd.slice(0, 4));
  const mo = Number(ymd.slice(5, 7)) - 1;
  const d = Number(ymd.slice(8, 10));
  return Date.UTC(y, mo, d, 0, 0, 0, 0);
}

function isoFromDayMinutes(dayKey: string, minutesUtc: number): string | null {
  const mid = utcMidnightMs(dayKey);
  if (mid == null) return null;
  return new Date(mid + minutesUtc * 60_000).toISOString();
}

function assigneeFromColumn(column: CalendarColumn): WeekViewRescheduleMeta {
  if (column.id.startsWith("u:")) return { assignedUserId: column.id.slice(2), clinicId: null };
  if (column.id.startsWith("c:")) return { assignedUserId: null, clinicId: column.id.slice(2) };
  return { assignedUserId: null, clinicId: null };
}

function TimeGutter({ gridConfig, bodyHeightPx }: { gridConfig: BusinessGridConfig; bodyHeightPx: number }) {
  const hours: number[] = [];
  for (let h = gridConfig.dayStartHourUtc; h < gridConfig.dayEndHourUtc; h++) hours.push(h);

  return (
    <div
      className="sticky left-0 z-20 shrink-0 border-r border-slate-200/80 bg-[#f8fafc]"
      style={{ width: TIME_GUTTER_WIDTH_PX }}
    >
      <div style={{ height: CALENDAR_HEADER_HEIGHT_PX }} className="border-b border-slate-200/80" aria-hidden />
      <div className="relative" style={{ height: bodyHeightPx }}>
        {hours.map((h) => (
          <div
            key={h}
            className="absolute left-0 right-0 flex items-start justify-end pr-2 pt-1"
            style={{
              top: (h - gridConfig.dayStartHourUtc) * CALENDAR_PX_PER_HOUR,
              height: CALENDAR_PX_PER_HOUR,
            }}
          >
            <span className="text-[11px] font-medium tabular-nums tracking-tight text-slate-500">
              {new Date(Date.UTC(2000, 0, 1, h, 0, 0)).toLocaleTimeString(undefined, {
                hour: "numeric",
                minute: "2-digit",
                timeZone: "UTC",
              })}
            </span>
          </div>
        ))}
      </div>
    </div>
  );
}

function WeekViewInner({
  sidebar,
  rightPanel,
  view,
  lanes,
  buckets,
  gridConfig,
  bookingDisplay,
  resourceColumns,
  canMutateBookings,
  bookings,
  highlightedColumnId,
  onSelectBooking,
  onRescheduleBooking,
}: WeekViewProps) {
  const bodyHeightPx = calendarGridBodyHeightPx(gridConfig);
  const [activeDrag, setActiveDrag] = useState<AppointmentCardData | null>(null);
  const { success, error: toastError } = useCalendarToast();

  const sensors = useSensors(
    useSensor(PointerSensor, {
      activationConstraint: { distance: 6 },
    })
  );

  const modifiers = useMemo(() => [snapToQuarterHourModifier()], []);

  const columnsForView = useMemo((): CalendarColumn[] => {
    if (usesProviderColumns(view) && lanes[0]) {
      const dayKey = lanes[0].dayKey;
      return resourceColumns.map((col) => ({
        id: col.id,
        label: col.label,
        subtitle: col.subtitle,
        dayKey,
        photoUrl: null,
      }));
    }
    return lanes.map((lane) => ({
      id: lane.dayKey,
      label: calendarDayHeading(lane),
      subtitle: "UTC",
      dayKey: lane.dayKey,
      photoUrl: null,
    }));
  }, [view, lanes, resourceColumns]);

  const primaryLane = lanes[0];

  const rescheduleWithToast = useCallback(
    async (
      booking: FiBookingRow,
      startIso: string,
      endIso: string,
      meta?: WeekViewRescheduleMeta,
      successMessage = "Appointment updated"
    ) => {
      const result = await onRescheduleBooking(booking, startIso, endIso, meta);
      if (result.ok) {
        success(successMessage);
      } else {
        toastError(result.error ?? "Could not update appointment");
      }
      return result;
    },
    [onRescheduleBooking, success, toastError]
  );

  const onDragStart = useCallback((event: DragStartEvent) => {
    const data = event.active.data.current;
    if (data?.appointment) {
      setActiveDrag(data.appointment as AppointmentCardData);
      return;
    }
    if (data?.type === "waitlist" && data.appointment) {
      setActiveDrag(data.appointment as AppointmentCardData);
    }
  }, []);

  const onDragEnd = useCallback(
    (event: DragEndEvent) => {
      setActiveDrag(null);
      if (!canMutateBookings) return;

      const { active, over } = event;
      if (!over) return;

      const drop = parseProviderColumnDropId(String(over.id));
      if (!drop) return;

      const waitlistBookingId = parseWaitlistDragId(String(active.id));
      const booking = bookings.find((b) => b.id === (waitlistBookingId ?? String(active.id)));
      if (!booking) return;

      const lane = lanes.find((l) => l.dayKey === drop.dayKey);
      if (!lane) return;

      let newStartMin: number;
      let durationMs: number;

      if (waitlistBookingId) {
        const waitData = active.data.current as { item?: { durationMin?: number } } | undefined;
        const durMin = Math.max(CALENDAR_SNAP_MINUTES, waitData?.item?.durationMin ?? 30);
        durationMs = durMin * 60_000;
        const fallbackStart = gridConfig.dayStartHourUtc * 60 + 60;
        newStartMin = dropMinutesFromDragEvent(event, gridConfig, fallbackStart);
      } else {
        const origStartMs = Date.parse(booking.start_at);
        const origEndMs = Date.parse(booking.end_at);
        if (!Number.isFinite(origStartMs) || !Number.isFinite(origEndMs)) return;

        durationMs = Math.max(CALENDAR_SNAP_MINUTES * 60_000, origEndMs - origStartMs);
        const origStartMin = minutesUtcFromEpoch(origStartMs);
        newStartMin = dropMinutesFromDragEvent(event, gridConfig, origStartMin);
      }

      const newEndMin = newStartMin + durationMs / 60_000;
      const startIso = isoFromDayMinutes(drop.dayKey, newStartMin);
      const endIso = isoFromDayMinutes(drop.dayKey, newEndMin);
      if (!startIso || !endIso) return;

      const targetColumn = columnsForView.find((c) => c.id === drop.columnId && c.dayKey === drop.dayKey);
      const meta: WeekViewRescheduleMeta | undefined =
        usesProviderColumns(view) && targetColumn
          ? { ...assigneeFromColumn(targetColumn), clearWaitlist: Boolean(waitlistBookingId) }
          : waitlistBookingId
            ? { clearWaitlist: true }
            : undefined;

      const message = waitlistBookingId ? "Scheduled from waitlist" : "Appointment moved";
      void rescheduleWithToast(booking, startIso, endIso, meta, message);
    },
    [bookings, canMutateBookings, columnsForView, gridConfig, lanes, rescheduleWithToast, view]
  );

  const onResizeAppointment = useCallback(
    (booking: FiBookingRow, endIso: string) => {
      void rescheduleWithToast(booking, booking.start_at, endIso, undefined, "Duration updated");
    },
    [rescheduleWithToast]
  );

  const onDragCancel = useCallback(() => setActiveDrag(null), []);

  if (usesProviderColumns(view) && !primaryLane) {
    return (
      <div
        className="rounded-2xl border border-dashed border-slate-200 px-4 py-12 text-center text-sm text-slate-500"
        style={{ backgroundColor: CALENDAR_GRID_BG }}
      >
        No day selected.
      </div>
    );
  }

  return (
    <DndContext
      sensors={sensors}
      collisionDetection={pointerWithin}
      modifiers={modifiers}
      onDragStart={onDragStart}
      onDragEnd={onDragEnd}
      onDragCancel={onDragCancel}
    >
      <div className="flex min-h-[32rem] overflow-hidden rounded-2xl border border-slate-200/90 bg-white shadow-sm ring-1 ring-slate-900/[0.04] lg:min-h-[calc(100dvh-13rem)]">
        {sidebar}
        <div className="flex min-w-0 flex-1 overflow-x-auto overscroll-x-contain">
          <TimeGutter gridConfig={gridConfig} bodyHeightPx={bodyHeightPx} />

          <div className="flex min-w-0 flex-1">
            {columnsForView.map((col) => {
              const lane = usesProviderColumns(view) ? primaryLane! : lanes.find((l) => l.dayKey === col.dayKey);
              if (!lane) return null;

              const dayBookings = buckets[lane.dayKey] ?? [];
              const colBookings =
                usesProviderColumns(view)
                  ? dayBookings.filter((b) => resourceColumnIdForBooking(b) === col.id)
                  : dayBookings;

              return (
                <ProviderColumn
                  key={`${col.dayKey}-${col.id}`}
                  id={col.id}
                  dayKey={lane.dayKey}
                  name={col.label}
                  role={col.subtitle}
                  photoUrl={col.photoUrl}
                  appointments={colBookings}
                  lane={lane}
                  gridConfig={gridConfig}
                  bookingDisplay={bookingDisplay}
                  bodyHeightPx={bodyHeightPx}
                  highlighted={usesProviderColumns(view) && highlightedColumnId === col.id}
                  droppable={canMutateBookings}
                  draggable={canMutateBookings}
                  resizable={canMutateBookings}
                  onSelectAppointment={onSelectBooking}
                  onResizeAppointment={onResizeAppointment}
                />
              );
            })}
          </div>
        </div>
        {rightPanel}
      </div>

      <DragOverlay dropAnimation={{ duration: 200, easing: "cubic-bezier(0.18, 0.67, 0.6, 1)" }}>
        {activeDrag ? (
          <div
            className="pointer-events-none w-[var(--col-min)] max-w-[220px]"
            style={{ "--col-min": `${CALENDAR_COLUMN_MIN_WIDTH_PX}px` } as React.CSSProperties}
          >
            <AppointmentCard appointment={activeDrag} isDragPreview draggable={false} />
          </div>
        ) : null}
      </DragOverlay>
    </DndContext>
  );
}

export function WeekView(props: WeekViewProps) {
  return (
    <CalendarToastProvider>
      <WeekViewInner {...props} />
    </CalendarToastProvider>
  );
}
