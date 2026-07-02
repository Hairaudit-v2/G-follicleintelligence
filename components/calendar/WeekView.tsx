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
import type { Variants } from "framer-motion";
import { motion, useReducedMotion } from "framer-motion";
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
import { pushCalendarHref } from "@/lib/calendar/calendarRouterTransition";
import { parseWaitlistDragId } from "@/components/calendar/SidebarAgenda";
import {
  CALENDAR_COLUMN_MIN_WIDTH_PX,
  CALENDAR_HEADER_HEIGHT_PX,
  ProviderColumn,
  calendarPxPerMinute,
  parseProviderColumnDropId,
} from "@/components/calendar/ProviderColumn";
import { BusinessTimeGutter } from "@/components/calendar/BusinessTimeSlotGrid";
import { calendarGridBodyHeightForBusinessHours } from "@/lib/calendar/time-slots";
import {
  CALENDAR_SNAP_MINUTES,
  dropMinutesFromDragEvent,
  minutesFromLaneStart,
} from "@/lib/calendar/dndMath";
import {
  calendarDateStringFromInstant,
  clinicLocalSlotToUtcIso,
  displayCalendarTimezoneSubtitle,
  parseIsoUtcMs,
} from "@/src/lib/calendar/calendarTimezone";
import { rescheduleErrorMessage } from "@/lib/calendar/rescheduleFeedback";
import { cn } from "@/lib/utils";
import type { CalendarRescheduleResult } from "@/hooks/useCalendarAppointments";
import { calendarDayHeading } from "@/src/lib/bookings/calendarLabels";
import {
  buildCalendarHref,
  mergeCalendarHrefQuery,
  type ParsedCalendarQuery,
} from "@/src/lib/bookings/calendarQuery";
import { calendarNavigationHelpers } from "@/src/lib/bookings/calendarView";
import type { CalendarDayLane } from "@/src/lib/bookings/calendarView";
import type { FiBookingRow } from "@/src/lib/bookings/types";
import {
  resolveDisplayResourceColumnId,
  type BusinessGridConfig,
} from "@/src/lib/calendar/operationalCalendarLayout";
import { assigneeMetaFromResourceColumnId } from "@/src/lib/calendar/operationalCalendarColumns";
import type {
  OperationalCalendarBookingDisplay,
  OperationalCalendarResourceColumn,
} from "@/src/lib/calendar/operationalCalendarTypes";

export type WeekViewRescheduleMeta = {
  assignedUserId?: string | null;
  /** `fi_staff.id` — when set (including `null`), drives staff + linked user on the server. */
  assignedStaffId?: string | null;
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
  /** Day-view column assignment mode from URL `resourceView`. */
  resourceView?: ParsedCalendarQuery["resourceView"];
  /** Maps linked `fi_users.id` → `fi_staff.id` for column placement and drag assignee. */
  staffIdByUserId?: Map<string, string>;
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
  ) => Promise<CalendarRescheduleResult>;
  /** Booking ids with in-flight PATCH after optimistic reschedule. */
  pendingAppointmentIds?: ReadonlySet<string>;
  /** Brief emphasis on a booking after quick-create save. */
  highlightedBookingId?: string | null;
  /** Enables keyboard navigation (N, T, arrows, 1–3). */
  shortcuts?: {
    tenantId: string;
    query: ParsedCalendarQuery;
    addAppointmentHref: string;
  };
  /** Click an empty time cell to open quick booking (parent supplies modal). */
  onEmptySlotClick?: (info: { dayKey: string; columnId: string; localStart: string }) => void;
  /** Right-click empty cell — context menu (parent supplies drawer presets). */
  onEmptySlotContextMenu?: (info: {
    dayKey: string;
    columnId: string;
    localStart: string;
    clientX: number;
    clientY: number;
  }) => void;
  /** FI OS: agenda + insights render as overlays; grid uses full workspace width (no centered max-width rail). */
  calendarShellMode?: "default" | "fiOs";
  /** FI OS: closes agenda + insights backdrop (both panels). */
  fiOsDrawerDismiss?: () => void;
};

type CalendarColumn = {
  id: string;
  label: string;
  subtitle: string | null;
  dayKey: string;
  photoUrl?: string | null;
  readinessWarning?: string | null;
  columnKind?: OperationalCalendarResourceColumn["kind"];
  /** Set for week/3-day × resource matrix cells — stable unique key for React / swipe slides. */
  matrixKey?: string;
};

function snapToQuarterHourModifier(): Modifier {
  const slotPx = calendarPxPerMinute() * CALENDAR_SNAP_MINUTES;
  return ({ transform }) => ({
    ...transform,
    y: Math.round(transform.y / slotPx) * slotPx,
  });
}

function assigneeFromColumn(
  column: CalendarColumn,
  staffIdByUserId: Map<string, string>
): WeekViewRescheduleMeta {
  return assigneeMetaFromResourceColumnId(column.id, staffIdByUserId);
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
  resourceView = "staff",
  staffIdByUserId = new Map(),
  canMutateBookings,
  bookings,
  highlightedColumnId,
  onSelectBooking,
  onRescheduleBooking,
  pendingAppointmentIds,
  highlightedBookingId,
  shortcuts,
  onEmptySlotClick,
  onEmptySlotContextMenu,
  calendarShellMode = "default",
  fiOsDrawerDismiss,
}: WeekViewProps) {
  const router = useRouter();
  const shellIsFiOs = calendarShellMode === "fiOs";
  const bodyHeightPx = useMemo(
    () =>
      calendarGridBodyHeightForBusinessHours({
        dayStartHourUtc: gridConfig.dayStartHourUtc,
        dayEndHourUtc: gridConfig.dayEndHourUtc,
      }),
    [gridConfig.dayEndHourUtc, gridConfig.dayStartHourUtc]
  );
  const [activeDrag, setActiveDrag] = useState<AppointmentCardData | null>(null);
  const [activeDragId, setActiveDragId] = useState<string | null>(null);
  const [activeColumnIndex, setActiveColumnIndex] = useState(0);
  const [showShortcutHints, setShowShortcutHints] = useState(false);
  const swipeTrackRef = useRef<HTMLDivElement>(null);
  const gridScrollRef = useRef<HTMLDivElement>(null);
  const viewportRange = useScrollViewport(gridScrollRef);
  const layoutMode = useCalendarLayoutMode();
  const swipeLayout = isSwipeCalendarLayout(layoutMode);
  const prefersReducedMotion = useReducedMotion();
  /** FI OS + prefers-reduced-motion: skip shell mount animation (instant grid). */
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
    const weekLike = view === "week" || view === "3day";
    const matrixCells =
      weekLike && lanes.length > 0 && resourceColumns.length > 1
        ? lanes.length * resourceColumns.length
        : 0;
    const useWeekResourceMatrix =
      weekLike &&
      !swipeLayout &&
      matrixCells > 0 &&
      matrixCells <= 24 &&
      lanes.length > 0 &&
      resourceColumns.length > 1;

    if (usesProviderColumns(view) && lanes[0]) {
      const dayKey = lanes[0].dayKey;
      return resourceColumns.map((col) => ({
        id: col.id,
        label: col.label,
        subtitle: col.subtitle,
        dayKey,
        photoUrl: null,
        readinessWarning: col.readinessWarning ?? null,
        columnKind: col.kind,
      }));
    }

    if (useWeekResourceMatrix) {
      const out: CalendarColumn[] = [];
      for (const lane of lanes) {
        for (const rc of resourceColumns) {
          out.push({
            id: rc.id,
            matrixKey: `${lane.dayKey}|${rc.id}`,
            label: `${calendarDayHeading(lane, gridConfig.timeZone)} · ${rc.label}`,
            subtitle: rc.subtitle,
            dayKey: lane.dayKey,
            photoUrl: null,
            readinessWarning: rc.readinessWarning ?? null,
            columnKind: rc.kind,
          });
        }
      }
      return out;
    }

    return lanes.map((lane) => ({
      id: lane.dayKey,
      label: calendarDayHeading(lane, gridConfig.timeZone),
      subtitle: displayCalendarTimezoneSubtitle(gridConfig.timeZone),
      dayKey: lane.dayKey,
      photoUrl: null,
    }));
  }, [view, lanes, resourceColumns, gridConfig.timeZone, swipeLayout]);

  const filterColBookingsByResource = useMemo(
    () =>
      usesProviderColumns(view) ||
      (columnsForView.length > 0 && Boolean(columnsForView[0]?.matrixKey)),
    [view, columnsForView]
  );

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
    const lane = primaryLane;
    if (!el || !lane) return;
    const todayInTz = calendarDateStringFromInstant(new Date(), gridConfig.timeZone);
    if (lane.dayKey !== todayInTz) return;

    const nowMin = minutesFromLaneStart(lane.startMs, Date.now());
    const gridStart = gridConfig.dayStartHourUtc * 60;
    const gridEnd = gridConfig.dayEndHourUtc * 60;
    if (nowMin < gridStart || nowMin > gridEnd) return;

    const top = (nowMin - gridStart) * calendarPxPerMinute();
    const target = Math.max(0, top - el.clientHeight * 0.28);
    el.scrollTo({ top: target, behavior: "auto" });
  }, [gridConfig.dayEndHourUtc, gridConfig.dayStartHourUtc, gridConfig.timeZone, primaryLane]);

  const navigateCalendar = useCallback(
    (patch: Parameters<typeof mergeCalendarHrefQuery>[1]) => {
      if (!shortcuts) return;
      pushCalendarHref(
        router,
        buildCalendarHref(shortcuts.tenantId, mergeCalendarHrefQuery(shortcuts.query, patch))
      );
    },
    [router, shortcuts]
  );

  const keyboardActions = useMemo(
    () => ({
      onNewAppointment: shortcuts?.addAppointmentHref
        ? () => pushCalendarHref(router, shortcuts.addAppointmentHref)
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
        toastError(rescheduleErrorMessage(result));
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
        const origStartMs = parseIsoUtcMs(booking.start_at);
        const origEndMs = parseIsoUtcMs(booking.end_at);
        if (origStartMs == null || origEndMs == null) return;

        durationMs = Math.max(CALENDAR_SNAP_MINUTES * 60_000, origEndMs - origStartMs);
        const origStartMin = minutesFromLaneStart(lane.startMs, origStartMs);
        newStartMin = dropMinutesFromDragEvent(event, gridConfig, origStartMin);
      }

      const newEndMin = newStartMin + durationMs / 60_000;
      const startIso = clinicLocalSlotToUtcIso(drop.dayKey, newStartMin, gridConfig.timeZone);
      const endIso = clinicLocalSlotToUtcIso(drop.dayKey, newEndMin, gridConfig.timeZone);
      if (!startIso || !endIso) return;

      const targetColumn = columnsForView.find(
        (c) => c.id === drop.columnId && c.dayKey === drop.dayKey
      );
      const meta: WeekViewRescheduleMeta | undefined =
        filterColBookingsByResource && targetColumn
          ? {
              ...assigneeFromColumn(targetColumn, staffIdByUserId),
              clearWaitlist: Boolean(waitlistBookingId),
            }
          : waitlistBookingId
            ? { clearWaitlist: true }
            : undefined;

      const message = waitlistBookingId ? "Scheduled from waitlist" : "Appointment moved";
      void rescheduleWithToast(booking, startIso, endIso, meta, message);
    },
    [
      bookings,
      canMutateBookings,
      columnsForView,
      filterColBookingsByResource,
      gridConfig,
      lanes,
      rescheduleWithToast,
      staffIdByUserId,
    ]
  );

  const onResizeAppointment = useCallback(
    (booking: FiBookingRow, endIso: string) => {
      void rescheduleWithToast(booking, booking.start_at, endIso, undefined, "Duration updated");
    },
    [rescheduleWithToast]
  );

  /** Desktop multi-column grids (day staff, week/3-day lanes, etc.) — not mobile swipe or single column. */
  const showInterColumnDividers = !swipeLayout && columnsForView.length > 1;

  const renderProviderColumn = useCallback(
    (col: CalendarColumn) => {
      const lane = usesProviderColumns(view)
        ? primaryLane!
        : lanes.find((l) => l.dayKey === col.dayKey);
      if (!lane) return null;

      const dayBookings = buckets[lane.dayKey] ?? [];
      const colBookings = filterColBookingsByResource
        ? dayBookings.filter(
            (b) =>
              resolveDisplayResourceColumnId(
                b,
                resourceColumns.map((c) => c.id),
                {
                  resourceView,
                  staffIdByUserId,
                }
              ) === col.id
          )
        : dayBookings;

      return (
        <ProviderColumn
          id={col.id}
          dayKey={lane.dayKey}
          name={col.label}
          role={col.subtitle}
          photoUrl={col.photoUrl}
          readinessWarning={col.readinessWarning}
          ownerColumn={col.columnKind === "fi_user"}
          appointments={colBookings}
          lane={lane}
          gridConfig={gridConfig}
          bookingDisplay={bookingDisplay}
          bodyHeightPx={bodyHeightPx}
          highlighted={filterColBookingsByResource && highlightedColumnId === col.id}
          droppable={canMutateBookings}
          draggable={canMutateBookings}
          resizable={canMutateBookings && layoutMode === "desktop"}
          stacked={swipeLayout}
          touchFriendly={layoutMode !== "desktop"}
          viewportRange={viewportRange}
          pinnedAppointmentId={activeDragId}
          pendingAppointmentIds={pendingAppointmentIds}
          highlightedBookingId={highlightedBookingId}
          fillAvailableWidth={!swipeLayout}
          interColumnDivider={showInterColumnDividers}
          onSelectAppointment={onSelectBooking}
          onResizeAppointment={onResizeAppointment}
          onEmptySlotClick={onEmptySlotClick}
          onEmptySlotContextMenu={onEmptySlotContextMenu}
        />
      );
    },
    [
      activeDragId,
      bodyHeightPx,
      bookingDisplay,
      buckets,
      canMutateBookings,
      filterColBookingsByResource,
      showInterColumnDividers,
      gridConfig,
      highlightedBookingId,
      highlightedColumnId,
      lanes,
      layoutMode,
      onEmptySlotClick,
      onEmptySlotContextMenu,
      onResizeAppointment,
      onSelectBooking,
      pendingAppointmentIds,
      primaryLane,
      resourceColumns,
      resourceView,
      staffIdByUserId,
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
        className="rounded-2xl border border-dashed border-white/[0.08] px-4 py-12"
        style={{ backgroundColor: "var(--fi-cal-ws-grid-bg, #0f172a)" }}
      >
        <CalendarEmptyState
          preset="day"
          title="No day selected"
          description="Pick a date to load the schedule."
        />
      </div>
    );
  }

  if (columnsForView.length === 0) {
    return (
      <div
        className="rounded-2xl border border-dashed border-white/[0.08] px-4 py-12"
        style={{ backgroundColor: "var(--fi-cal-ws-grid-bg, #0f172a)" }}
      >
        <CalendarEmptyState
          preset="day"
          title="No columns to display"
          description="Adjust staff or location filters to see provider columns."
        />
      </div>
    );
  }

  const gridColumn = (
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
        className="flex min-h-0 min-w-0 flex-1 overflow-auto overscroll-contain"
      >
        <div className="flex min-h-0 min-w-0 w-full flex-1" style={{ height: bodyHeightPx }}>
          <BusinessTimeGutter
            bodyHeightPx={bodyHeightPx}
            headerHeightPx={CALENDAR_HEADER_HEIGHT_PX}
            gridHours={{
              dayStartHourUtc: gridConfig.dayStartHourUtc,
              dayEndHourUtc: gridConfig.dayEndHourUtc,
            }}
          />

          {swipeLayout ? (
            <div
              ref={swipeTrackRef}
              className="fi-calendar-swipe-track flex min-w-0 flex-1 overflow-x-auto overscroll-x-contain [-ms-overflow-style:none] [scrollbar-width:none] [&::-webkit-scrollbar]:hidden"
            >
              {columnsForView.map((col, i) => (
                <motion.div
                  key={`${col.matrixKey ?? `${col.dayKey}-${col.id}`}-slide`}
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
            <div
              className="grid min-h-0 min-w-0 flex-1"
              style={{
                gridTemplateColumns: `repeat(${columnsForView.length}, minmax(0, 1fr))`,
              }}
            >
              {columnsForView.map((col) => (
                <div
                  key={`${col.matrixKey ?? `${col.dayKey}-${col.id}`}-cell`}
                  className="min-h-0 min-w-0"
                >
                  {renderProviderColumn(col)}
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );

  const fiOsPanelsOpen = shellIsFiOs && Boolean(sidebar || rightPanel);

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
        variants={calendarShellMotion}
        initial="hidden"
        animate="show"
        className={cn(
          "fi-calendar-shell flex overflow-hidden rounded-xl border shadow-sm ring-1 md:rounded-2xl",
          "border-[color:var(--fi-cal-ws-shell-border,#1e2937)] bg-[var(--fi-cal-ws-shell-bg,#0f172a)] shadow-black/30 ring-[color:var(--fi-cal-ws-shell-ring,rgba(255,255,255,0.04))]",
          shellIsFiOs
            ? "relative min-h-0 flex-1 flex-col"
            : "min-h-[min(32rem,72dvh)] flex-col md:min-h-[32rem] lg:min-h-[calc(100dvh-13rem)]"
        )}
      >
        {shellIsFiOs ? (
          <div className="relative flex min-h-0 min-w-0 flex-1 flex-col">
            <div className="flex min-h-0 min-w-0 flex-1 flex-col px-1 sm:px-2">
              <div className="flex min-h-0 w-full min-w-0 flex-1 flex-col">{gridColumn}</div>
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
            {gridColumn}
            {rightPanel}
          </div>
        )}
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
