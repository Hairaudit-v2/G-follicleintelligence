"use client";

import {
  DndContext,
  DragOverlay,
  PointerSensor,
  TouchSensor,
  pointerWithin,
  useSensor,
  useSensors,
  type DragEndEvent,
  type DragStartEvent,
  type Modifier,
} from "@dnd-kit/core";
import { motion } from "framer-motion";
import { useRouter } from "next/navigation";
import { useCallback, useEffect, useMemo, useRef, useState, type ReactNode } from "react";

import { AppointmentCard, type AppointmentCardData } from "@/components/calendar/AppointmentCard";
import { CalendarColumnPager } from "@/components/calendar/CalendarColumnPager";
import { CalendarEmptyState } from "@/components/calendar/CalendarEmptyState";
import { CalendarKeyboardHints } from "@/components/calendar/CalendarKeyboardHints";
import { CalendarToastProvider, useCalendarToast } from "@/components/calendar/CalendarToast";
import { useCalendarKeyboardShortcuts } from "@/hooks/useCalendarKeyboardShortcuts";
import { useCalendarLayoutMode } from "@/hooks/useCalendarLayoutMode";
import { useScrollViewport } from "@/hooks/useScrollViewport";
import { calendarShellVariants } from "@/lib/calendar/calendarMotion";
import {
  calendarPointerSensorOptions,
  calendarTouchSensorOptions,
  isSwipeCalendarLayout,
} from "@/lib/calendar/calendarResponsive";
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
import {
  buildCalendarHref,
  mergeCalendarHrefQuery,
  parseUtcCalendarDateString,
  type ParsedCalendarQuery,
} from "@/src/lib/bookings/calendarQuery";
import { calendarNavigationHelpers } from "@/src/lib/bookings/calendarView";
import type { CalendarDayLane } from "@/src/lib/bookings/calendarView";
import type { FiBookingRow } from "@/src/lib/bookings/types";
import { resourceColumnIdForBooking, type BusinessGridConfig } from "@/src/lib/calendar/operationalCalendarLayout";
import type {
  OperationalCalendarBookingDisplay,
  OperationalCalendarResourceColumn,
} from "@/src/lib/calendar/operationalCalendarTypes";

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
  /** Enables keyboard navigation (N, T, arrows, 1–3). */
  shortcuts?: {
    tenantId: string;
    query: ParsedCalendarQuery;
    addAppointmentHref: string;
  };
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
    <div className="sticky left-0 z-20 w-[var(--fi-calendar-gutter,3.5rem)] shrink-0 self-start border-r border-slate-200/80 bg-[#f8fafc]">
      <div
        style={{ height: CALENDAR_HEADER_HEIGHT_PX }}
        className="sticky top-0 z-20 border-b border-slate-200/80 bg-[#f8fafc]"
        aria-hidden
      />
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
  shortcuts,
}: WeekViewProps) {
  const router = useRouter();
  const bodyHeightPx = calendarGridBodyHeightPx(gridConfig);
  const [activeDrag, setActiveDrag] = useState<AppointmentCardData | null>(null);
  const [activeDragId, setActiveDragId] = useState<string | null>(null);
  const [activeColumnIndex, setActiveColumnIndex] = useState(0);
  const [showShortcutHints, setShowShortcutHints] = useState(false);
  const swipeTrackRef = useRef<HTMLDivElement>(null);
  const gridScrollRef = useRef<HTMLDivElement>(null);
  const viewportRange = useScrollViewport(gridScrollRef);
  const layoutMode = useCalendarLayoutMode();
  const swipeLayout = isSwipeCalendarLayout(layoutMode);
  const { success, error: toastError } = useCalendarToast();

  const scrollGridBy = useCallback((deltaPx: number) => {
    gridScrollRef.current?.scrollBy({ top: deltaPx, behavior: "smooth" });
  }, []);

  const gridScrollStepPx = useMemo(() => calendarPxPerMinute() * CALENDAR_SNAP_MINUTES, []);

  const sensors = useSensors(
    useSensor(PointerSensor, calendarPointerSensorOptions(layoutMode)),
    useSensor(TouchSensor, calendarTouchSensorOptions())
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

  useEffect(() => {
    setActiveColumnIndex(0);
  }, [view, lanes.length, resourceColumns.length]);

  const scrollToColumn = useCallback(
    (index: number) => {
      const el = swipeTrackRef.current;
      if (!el) return;
      const clamped = Math.max(0, Math.min(index, columnsForView.length - 1));
      el.scrollTo({ left: clamped * el.clientWidth, behavior: "smooth" });
      setActiveColumnIndex(clamped);
    },
    [columnsForView.length]
  );

  useEffect(() => {
    const el = swipeTrackRef.current;
    if (!el || !swipeLayout) return;

    const onScroll = () => {
      const width = el.clientWidth;
      if (width <= 0) return;
      const idx = Math.round(el.scrollLeft / width);
      setActiveColumnIndex((prev) => (prev === idx ? prev : idx));
    };

    el.addEventListener("scroll", onScroll, { passive: true });
    return () => el.removeEventListener("scroll", onScroll);
  }, [swipeLayout, columnsForView.length]);

  useEffect(() => {
    if (!swipeLayout || !highlightedColumnId) return;
    const idx = columnsForView.findIndex((c) => c.id === highlightedColumnId);
    if (idx >= 0) scrollToColumn(idx);
  }, [columnsForView, highlightedColumnId, scrollToColumn, swipeLayout]);

  useEffect(() => {
    const el = gridScrollRef.current;
    const todayKey = new Date().toISOString().slice(0, 10);
    const laneKey = primaryLane?.dayKey;
    if (!el || laneKey !== todayKey) return;

    const nowMin = minutesUtcFromEpoch(Date.now());
    const gridStart = gridConfig.dayStartHourUtc * 60;
    const gridEnd = gridConfig.dayEndHourUtc * 60;
    if (nowMin < gridStart || nowMin > gridEnd) return;

    const top = (nowMin - gridStart) * calendarPxPerMinute();
    const target = Math.max(0, top - el.clientHeight * 0.28);
    el.scrollTo({ top: target, behavior: "auto" });
  }, [gridConfig.dayEndHourUtc, gridConfig.dayStartHourUtc, primaryLane?.dayKey]);

  const navigateCalendar = useCallback(
    (patch: Parameters<typeof mergeCalendarHrefQuery>[1]) => {
      if (!shortcuts) return;
      router.push(buildCalendarHref(shortcuts.tenantId, mergeCalendarHrefQuery(shortcuts.query, patch)));
    },
    [router, shortcuts]
  );

  const keyboardActions = useMemo(
    () => ({
      onNewAppointment: shortcuts?.addAppointmentHref
        ? () => router.push(shortcuts.addAppointmentHref)
        : undefined,
      onToday: shortcuts
        ? () => navigateCalendar(calendarNavigationHelpers.goToToday())
        : undefined,
      onPreviousPeriod: shortcuts
        ? () => navigateCalendar(calendarNavigationHelpers.previousPeriod(shortcuts.query))
        : undefined,
      onNextPeriod: shortcuts
        ? () => navigateCalendar(calendarNavigationHelpers.nextPeriod(shortcuts.query))
        : undefined,
      onViewChange: shortcuts
        ? (viewMode: "day" | "3day" | "week" | "month") => navigateCalendar({ view: viewMode })
        : undefined,
      onColumnPrevious: () => scrollToColumn(activeColumnIndex - 1),
      onColumnNext: () => scrollToColumn(activeColumnIndex + 1),
      onScrollGridUp: () => scrollGridBy(-gridScrollStepPx),
      onScrollGridDown: () => scrollGridBy(gridScrollStepPx),
      onToggleShortcutsHelp: () => setShowShortcutHints((v) => !v),
    }),
    [
      activeColumnIndex,
      gridScrollStepPx,
      navigateCalendar,
      router,
      scrollGridBy,
      scrollToColumn,
      shortcuts,
    ]
  );

  useCalendarKeyboardShortcuts(keyboardActions, Boolean(shortcuts));

  useEffect(() => {
    const toggle = () => setShowShortcutHints((v) => !v);
    window.addEventListener("fi-calendar-toggle-shortcuts", toggle);
    return () => window.removeEventListener("fi-calendar-toggle-shortcuts", toggle);
  }, []);

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
    setActiveDragId(String(event.active.id));
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
      setActiveDragId(null);
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

  const renderProviderColumn = useCallback(
    (col: CalendarColumn) => {
      const lane = usesProviderColumns(view) ? primaryLane! : lanes.find((l) => l.dayKey === col.dayKey);
      if (!lane) return null;

      const dayBookings = buckets[lane.dayKey] ?? [];
      const colBookings = usesProviderColumns(view)
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
          resizable={canMutateBookings && layoutMode === "desktop"}
          stacked={swipeLayout}
          touchFriendly={layoutMode !== "desktop"}
          viewportRange={viewportRange}
          pinnedAppointmentId={activeDragId}
          onSelectAppointment={onSelectBooking}
          onResizeAppointment={onResizeAppointment}
        />
      );
    },
    [
      activeDragId,
      bodyHeightPx,
      bookingDisplay,
      buckets,
      canMutateBookings,
      gridConfig,
      highlightedColumnId,
      lanes,
      layoutMode,
      onResizeAppointment,
      onSelectBooking,
      primaryLane,
      swipeLayout,
      view,
      viewportRange,
    ]
  );

  const onDragCancel = useCallback(() => {
    setActiveDrag(null);
    setActiveDragId(null);
  }, []);

  const columnLabels = columnsForView.map((c) => c.label);
  const columnSubtitles = columnsForView.map((c) => c.subtitle);

  if (usesProviderColumns(view) && !primaryLane) {
    return (
      <div
        className="rounded-2xl border border-dashed border-slate-200 px-4 py-12"
        style={{ backgroundColor: CALENDAR_GRID_BG }}
      >
        <CalendarEmptyState preset="day" title="No day selected" description="Pick a date to load the schedule." />
      </div>
    );
  }

  if (columnsForView.length === 0) {
    return (
      <div
        className="rounded-2xl border border-dashed border-slate-200 px-4 py-12"
        style={{ backgroundColor: CALENDAR_GRID_BG }}
      >
        <CalendarEmptyState
          preset="day"
          title="No columns to display"
          description="Adjust staff or location filters to see provider columns."
        />
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
      <motion.div
        variants={calendarShellVariants}
        initial="hidden"
        animate="show"
        className="fi-calendar-shell flex min-h-[min(32rem,72dvh)] flex-col overflow-hidden rounded-xl border border-[#1e2937] bg-[#0f172a] shadow-sm shadow-black/30 ring-1 ring-white/[0.04] md:min-h-[32rem] md:rounded-2xl lg:min-h-[calc(100dvh-13rem)]"
      >
        {sidebar}

        <div className="flex min-h-0 min-w-0 flex-1 flex-col">
          {swipeLayout ? (
            <CalendarColumnPager
              labels={columnLabels}
              subtitles={columnSubtitles}
              activeIndex={activeColumnIndex}
              onSelect={scrollToColumn}
            />
          ) : null}

          <div
            ref={gridScrollRef}
            className="flex min-h-0 min-w-0 flex-1 overflow-y-auto overscroll-y-contain"
          >
            <div className="flex min-h-min min-w-0 flex-1" style={{ height: bodyHeightPx }}>
              <TimeGutter gridConfig={gridConfig} bodyHeightPx={bodyHeightPx} />

              {swipeLayout ? (
                <div
                  ref={swipeTrackRef}
                  className="fi-calendar-swipe-track flex min-w-0 flex-1 overflow-x-auto overscroll-x-contain [-ms-overflow-style:none] [scrollbar-width:none] [&::-webkit-scrollbar]:hidden"
                >
                  {columnsForView.map((col, i) => (
                    <motion.div
                      key={`${col.dayKey}-${col.id}-slide`}
                      custom={i}
                      initial={{ opacity: 0, x: 8 }}
                      animate={{ opacity: 1, x: 0 }}
                      transition={{ duration: 0.16, delay: Math.min(i * 0.04, 0.12) }}
                      className="fi-calendar-swipe-slide min-w-full max-w-full flex-shrink-0"
                    >
                      {renderProviderColumn(col)}
                    </motion.div>
                  ))}
                </div>
              ) : (
                <div className="flex min-w-0 flex-1 overflow-x-auto overscroll-x-contain">
                  {columnsForView.map((col, i) => (
                    <motion.div
                      key={`${col.dayKey}-${col.id}-wrap`}
                      custom={i}
                      initial={{ opacity: 0, x: 6 }}
                      animate={{ opacity: 1, x: 0 }}
                      transition={{ duration: 0.16, delay: Math.min(i * 0.03, 0.1) }}
                      className="flex min-w-0 flex-1"
                    >
                      {renderProviderColumn(col)}
                    </motion.div>
                  ))}
                </div>
              )}
            </div>
          </div>
        </div>

        {rightPanel}
      </motion.div>

      <CalendarKeyboardHints open={showShortcutHints} onClose={() => setShowShortcutHints(false)} />

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
