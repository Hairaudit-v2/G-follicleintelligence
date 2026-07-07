"use client";

import {
  DndContext,
  DragOverlay,
  PointerSensor,
  useSensor,
  useSensors,
  type DragEndEvent,
  type DragStartEvent,
} from "@dnd-kit/core";
import { useCallback, useMemo, useState, type ReactNode } from "react";

import { CalendarOsBookingCard } from "@/src/components/calendar-os/CalendarOsBookingCard";
import { useCalendarToastOptional } from "@/components/calendar/CalendarToast";
import type { CalendarRescheduleMeta, CalendarRescheduleResult } from "@/hooks/useCalendarAppointments";
import type { CalendarDayLane } from "@/src/lib/bookings/calendarView";
import type { FiBookingRow } from "@/src/lib/bookings/types";
import type { BusinessGridConfig } from "@/src/lib/calendar/operationalCalendarLayout";
import {
  buildLocalRescheduleMetadataPatch,
  externalRescheduleRequiresFiOnlyConfirmation,
  isBookingDragMutable,
  parseCalendarOsDayDropId,
  parseCalendarOsWeekDropId,
  planDayViewDragReschedule,
  planWeekCellDragReschedule,
} from "@/src/lib/calendar-os/calendarOsBookingInteractionCore";
import type { CalendarOsBookingCardModel } from "@/src/lib/calendar-os/calendarBookingCardModel";
import { assigneeMetaFromResourceColumnId } from "@/src/lib/calendar/operationalCalendarColumns";
import {
  calendarOsDensityTokens,
  type CalendarOsDisplayDensity,
} from "@/src/lib/calendar-os/calendarDisplayDensity";

function rescheduleErrorMessage(result: CalendarRescheduleResult): string {
  return result.error?.trim() || "Could not move the appointment.";
}

export type CalendarOsDragLayerProps = {
  children: ReactNode;
  bookings: FiBookingRow[];
  cardModels: Record<string, CalendarOsBookingCardModel>;
  lanes: CalendarDayLane[];
  gridConfig: BusinessGridConfig;
  density: CalendarOsDisplayDensity;
  view: "day" | "3day" | "week";
  canMutateBookings: boolean;
  staffIdByUserId: Map<string, string>;
  pendingBookingIds?: Set<string>;
  onRescheduleBooking?: (
    booking: FiBookingRow,
    startIso: string,
    endIso: string,
    meta?: CalendarRescheduleMeta
  ) => Promise<CalendarRescheduleResult>;
};

export function CalendarOsDragLayer({
  children,
  bookings,
  cardModels,
  lanes,
  gridConfig,
  density,
  view,
  canMutateBookings,
  staffIdByUserId,
  onRescheduleBooking,
}: CalendarOsDragLayerProps) {
  const toast = useCalendarToastOptional();
  const tokens = calendarOsDensityTokens(density);
  const pxPerMin = tokens.dayPxPerHour / 60;
  const [activeBookingId, setActiveBookingId] = useState<string | null>(null);

  const sensors = useSensors(
    useSensor(PointerSensor, {
      activationConstraint: { distance: 6 },
    })
  );

  const bookingById = useMemo(() => new Map(bookings.map((b) => [b.id, b])), [bookings]);
  const laneByDayKey = useMemo(() => new Map(lanes.map((l) => [l.dayKey, l])), [lanes]);
  const activeModel = activeBookingId ? cardModels[activeBookingId] : null;

  const onDragStart = useCallback((event: DragStartEvent) => {
    setActiveBookingId(String(event.active.id));
  }, []);

  const onDragEnd = useCallback(
    async (event: DragEndEvent) => {
      setActiveBookingId(null);
      if (!canMutateBookings || !onRescheduleBooking) return;

      const { active, over } = event;
      if (!over) return;

      const booking = bookingById.get(String(active.id));
      if (!booking || !isBookingDragMutable(booking)) return;

      if (
        externalRescheduleRequiresFiOnlyConfirmation(booking) &&
        typeof window !== "undefined" &&
        !window.confirm(
          "This will reschedule the FI OS booking only. Update Timely separately unless source write-back is enabled."
        )
      ) {
        return;
      }

      const dayDrop = parseCalendarOsDayDropId(String(over.id));
      const weekDrop = parseCalendarOsWeekDropId(String(over.id));

      let plan: ReturnType<typeof planDayViewDragReschedule> | null = null;
      let columnId: string | null = null;

      if (dayDrop && view === "day") {
        const lane = laneByDayKey.get(dayDrop.dayKey);
        if (!lane) return;
        plan = planDayViewDragReschedule({
          booking,
          lane,
          drop: dayDrop,
          event,
          gridConfig,
          pxPerMinute: pxPerMin,
        });
        columnId = dayDrop.columnId;
      } else if (weekDrop && (view === "week" || view === "3day")) {
        plan = planWeekCellDragReschedule({
          booking,
          drop: weekDrop,
          lane: laneByDayKey.get(weekDrop.dayKey),
          gridConfig,
        });
        columnId = weekDrop.resourceId;
      }

      if (!plan || !columnId) return;

      const assigneeMeta = assigneeMetaFromResourceColumnId(columnId, staffIdByUserId);
      const metadataPatch = buildLocalRescheduleMetadataPatch(
        booking.metadata,
        booking,
        booking.start_at,
        booking.end_at
      );

      const result = await onRescheduleBooking(booking, plan.startIso, plan.endIso, {
        ...assigneeMeta,
        ...(Object.keys(metadataPatch).length > 0 ? { metadata: metadataPatch } : {}),
      });

      if (result.ok) {
        toast?.success(
          externalRescheduleRequiresFiOnlyConfirmation(booking)
            ? "Updated in FI OS — update Timely separately"
            : "Appointment moved"
        );
      } else {
        toast?.error(rescheduleErrorMessage(result));
      }
    },
    [
      bookingById,
      canMutateBookings,
      gridConfig,
      laneByDayKey,
      onRescheduleBooking,
      pxPerMin,
      staffIdByUserId,
      toast,
      view,
    ]
  );

  if (!canMutateBookings || !onRescheduleBooking) {
    return <>{children}</>;
  }

  return (
    <DndContext sensors={sensors} onDragStart={onDragStart} onDragEnd={onDragEnd}>
      {children}
      <DragOverlay dropAnimation={null}>
        {activeModel ? (
          <div className="w-48 opacity-90 shadow-lg">
            <CalendarOsBookingCard model={activeModel} compact ultraCompact draggable />
          </div>
        ) : null}
      </DragOverlay>
    </DndContext>
  );
}
