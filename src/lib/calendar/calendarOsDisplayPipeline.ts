/**
 * CalendarOS display pipeline — filter bypass and dev trace helpers (pure, testable).
 */

import type { CalendarDayLane } from "@/src/lib/bookings/calendarView";
import type { FiBookingRow } from "@/src/lib/bookings/types";
import type { OperationalCalendarResourceColumn } from "@/src/lib/calendar/operationalCalendarTypes";
import {
  isCalendarOsEventRow,
  type FiCalendarEventOverlapRow,
} from "@/src/lib/calendar/calendarOsEventsCore";
import {
  resourceColumnIdForBooking,
  resolveDisplayResourceColumnId,
} from "@/src/lib/calendar/operationalCalendarLayout";

export type CalendarOsDisplayPipelineEventTrace = {
  eventId: string;
  externalEventId: string | null;
  calendarId: string | null;
  assignedStaffId: string | null;
  resourceColumnId: string;
  displayColumnId: string;
  inMergedBookings: boolean;
  inDayBucket: boolean;
  dayKeys: string[];
  /** True when legacy booking URL filters would have dropped this CalendarOS row. */
  removedByBookingFilters: boolean;
  isCalendarOsEventRow: boolean;
  mappedFromRaw: boolean;
};

export type CalendarOsDisplayPipelineTrace = {
  rawCalendarOsEventCount: number;
  mappedCalendarOsEventCount: number;
  displayedCalendarOsEventCount: number;
  mergedBookingCount: number;
  resourceColumnIds: string[];
  events: CalendarOsDisplayPipelineEventTrace[];
};

function dayKeysForBooking(booking: FiBookingRow, lanes: CalendarDayLane[]): string[] {
  const startMs = Date.parse(booking.start_at);
  if (!Number.isFinite(startMs)) return [];
  return lanes.filter((lane) => startMs >= lane.startMs && startMs < lane.endMs).map((lane) => lane.dayKey);
}

/** Build per-event trace for dev logging through loader → merge → bucket → column placement. */
export function buildCalendarOsDisplayPipelineTrace(input: {
  rawRows: FiCalendarEventOverlapRow[];
  mappedBookings: FiBookingRow[];
  displayedCalendarOs: FiBookingRow[];
  bookingFilterExcludedIds: ReadonlySet<string>;
  mergedBookings: FiBookingRow[];
  buckets: Record<string, FiBookingRow[]>;
  resourceColumns: OperationalCalendarResourceColumn[];
  lanes: CalendarDayLane[];
  staffIdByUserId?: Map<string, string>;
}): CalendarOsDisplayPipelineTrace {
  const resourceColumnIds = input.resourceColumns.map((c) => c.id);
  const columnIdSet = new Set(resourceColumnIds);
  const mergedIds = new Set(input.mergedBookings.map((b) => b.id));
  const displayedIds = new Set(input.displayedCalendarOs.map((b) => b.id));
  const mappedById = new Map(input.mappedBookings.map((b) => [b.id, b]));
  const rawIds = new Set(input.rawRows.map((r) => r.id));

  const events: CalendarOsDisplayPipelineEventTrace[] = [];

  for (const raw of input.rawRows) {
    const mapped = mappedById.get(raw.id);
    const booking = mapped ?? input.mergedBookings.find((b) => b.id === raw.id);
    const assignedStaffId = booking?.assigned_staff_id?.trim() || null;
    const resourceColumnId = booking
      ? resourceColumnIdForBooking(booking, { staffIdByUserId: input.staffIdByUserId })
      : "unassigned";
    const displayColumnId = booking
      ? resolveDisplayResourceColumnId(booking, columnIdSet, { staffIdByUserId: input.staffIdByUserId })
      : "unassigned";
    const dayKeys = booking ? dayKeysForBooking(booking, input.lanes) : [];
    const inDayBucket =
      booking != null && dayKeys.some((dayKey) => (input.buckets[dayKey] ?? []).some((b) => b.id === booking.id));

    events.push({
      eventId: raw.id,
      externalEventId: raw.external_event_id?.trim() || null,
      calendarId: raw.calendar_id?.trim() || null,
      assignedStaffId,
      resourceColumnId,
      displayColumnId,
      inMergedBookings: mergedIds.has(raw.id),
      inDayBucket,
      dayKeys,
      removedByBookingFilters: mapped != null && input.bookingFilterExcludedIds.has(raw.id),
      isCalendarOsEventRow: booking != null ? isCalendarOsEventRow(booking) : false,
      mappedFromRaw: rawIds.has(raw.id) && mapped != null,
    });
  }

  for (const mapped of input.mappedBookings) {
    if (rawIds.has(mapped.id)) continue;
    const resourceColumnId = resourceColumnIdForBooking(mapped, { staffIdByUserId: input.staffIdByUserId });
    const displayColumnId = resolveDisplayResourceColumnId(mapped, columnIdSet, {
      staffIdByUserId: input.staffIdByUserId,
    });
    const dayKeys = dayKeysForBooking(mapped, input.lanes);
    const inDayBucket = dayKeys.some((dayKey) =>
      (input.buckets[dayKey] ?? []).some((b) => b.id === mapped.id)
    );

    events.push({
      eventId: mapped.id,
      externalEventId: (mapped.metadata?.external_event_id as string | undefined)?.trim() || null,
      calendarId: (mapped.metadata?.calendar_id as string | undefined)?.trim() || null,
      assignedStaffId: mapped.assigned_staff_id?.trim() || null,
      resourceColumnId,
      displayColumnId,
      inMergedBookings: mergedIds.has(mapped.id),
      inDayBucket,
      dayKeys,
      removedByBookingFilters: input.bookingFilterExcludedIds.has(mapped.id),
      isCalendarOsEventRow: isCalendarOsEventRow(mapped),
      mappedFromRaw: false,
    });
  }

  return {
    rawCalendarOsEventCount: input.rawRows.length,
    mappedCalendarOsEventCount: input.mappedBookings.length,
    displayedCalendarOsEventCount: displayedIds.size,
    mergedBookingCount: input.mergedBookings.length,
    resourceColumnIds,
    events,
  };
}
