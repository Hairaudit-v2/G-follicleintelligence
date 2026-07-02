"use client";

import { useMemo } from "react";

import { calendarDayHeading } from "@/src/lib/bookings/calendarLabels";
import type { CalendarDayLane } from "@/src/lib/bookings/calendarView";
import type { FiBookingRow } from "@/src/lib/bookings/types";
import {
  buildCalendarOsBookingCardModels,
  type CalendarOsBookingCardModel,
} from "@/src/lib/calendar-os/calendarBookingCardModel";
import {
  attachUtilisationToResourceRows,
  buildCalendarOsResourceRows,
  groupCalendarOsResourceRowsByRole,
  mapBookingsToWeekResourceCells,
} from "@/src/lib/calendar-os/calendarResourceModel";
import type {
  OperationalCalendarBookingDisplay,
  OperationalCalendarResourceColumn,
} from "@/src/lib/calendar/operationalCalendarTypes";
import type { ParsedCalendarQuery } from "@/src/lib/bookings/calendarQuery";
import type { ClinicalStaffPickerOption } from "@/src/lib/staff/clinicalStaffPicker";
import type { FiClinicRoomRow } from "@/src/lib/rooms/roomTypes";
import {
  calendarOsDensityTokens,
  calendarOsWeekGridTemplate,
  type CalendarOsDisplayDensity,
} from "@/src/lib/calendar-os/calendarDisplayDensity";
import { buildCalendarOsSparseContext } from "@/src/lib/calendar-os/calendarSparseContext";
import { CalendarOsBookingCard } from "@/src/components/calendar-os/CalendarOsBookingCard";
import { CalendarOsEmptyContext } from "@/src/components/calendar-os/CalendarOsEmptyContext";
import { CalendarOsResourceLaneLabel } from "@/src/components/calendar-os/CalendarOsResourceLaneLabel";
import { cn } from "@/lib/utils";

export type CalendarOsWeekResourceViewProps = {
  query: ParsedCalendarQuery;
  lanes: CalendarDayLane[];
  bookings: FiBookingRow[];
  bookingDisplay: Record<string, OperationalCalendarBookingDisplay>;
  resourceColumns: OperationalCalendarResourceColumn[];
  staffDirectory: ClinicalStaffPickerOption[];
  rooms: FiClinicRoomRow[];
  staffIdByUserId: Map<string, string>;
  calendarTimezone: string;
  density?: CalendarOsDisplayDensity;
  onSelectBooking?: (booking: FiBookingRow) => void;
  highlightedBookingId?: string | null;
};

export function CalendarOsWeekResourceView({
  query,
  lanes,
  bookings,
  bookingDisplay,
  resourceColumns,
  staffDirectory,
  rooms,
  staffIdByUserId,
  calendarTimezone,
  density = "comfortable",
  onSelectBooking,
  highlightedBookingId,
}: CalendarOsWeekResourceViewProps) {
  const tokens = calendarOsDensityTokens(density);
  const gridTemplate = calendarOsWeekGridTemplate(density, lanes.length);

  const cardModels = useMemo(
    () => buildCalendarOsBookingCardModels(bookings, bookingDisplay, calendarTimezone),
    [bookings, bookingDisplay, calendarTimezone]
  );

  const resourceRows = useMemo(
    () =>
      buildCalendarOsResourceRows({
        query,
        resourceColumns,
        staffDirectory,
        rooms,
      }),
    [query, resourceColumns, staffDirectory, rooms]
  );

  const cells = useMemo(
    () =>
      mapBookingsToWeekResourceCells({
        query,
        lanes,
        bookings,
        resourceColumns,
        staffDirectory,
        rooms,
        staffIdByUserId,
        gridConfig: {
          dayStartHourUtc: 6,
          dayEndHourUtc: 19,
          slotMinutes: 15,
          timeZone: calendarTimezone,
        },
      }),
    [
      query,
      lanes,
      bookings,
      resourceColumns,
      staffDirectory,
      rooms,
      staffIdByUserId,
      calendarTimezone,
    ]
  );

  const rowsWithUtil = useMemo(
    () => attachUtilisationToResourceRows(resourceRows, cells, bookings),
    [resourceRows, cells, bookings]
  );

  const grouped = useMemo(
    () => groupCalendarOsResourceRowsByRole(rowsWithUtil),
    [rowsWithUtil]
  );

  const cellLookup = useMemo(() => {
    const map = new Map<string, string[]>();
    for (const cell of cells) {
      map.set(`${cell.resourceId}|${cell.dayKey}`, cell.bookingIds);
    }
    return map;
  }, [cells]);

  const bookingById = useMemo(() => new Map(bookings.map((b) => [b.id, b])), [bookings]);

  const sparseContext = useMemo(
    () =>
      buildCalendarOsSparseContext({
        bookings,
        staffDirectory,
        rooms,
        dayKeys: lanes.map((l) => l.dayKey),
      }),
    [bookings, staffDirectory, rooms, lanes]
  );

  const showSparseBanner = sparseContext.totalBookings <= 3;

  return (
    <div className="flex min-h-0 flex-1 flex-col overflow-hidden">
      {showSparseBanner ? <CalendarOsEmptyContext context={sparseContext} variant="week-banner" /> : null}

      <div className="min-h-0 flex-1 overflow-auto overscroll-x-contain">
        <div className="min-w-max">
          <div
            className="sticky top-0 z-[4] grid border-b border-white/[0.08] bg-[#0a1220]"
            style={{ gridTemplateColumns: gridTemplate }}
          >
            <div className="sticky left-0 z-[5] border-r border-white/[0.08] px-2 py-1.5 text-[10px] font-semibold uppercase tracking-wider text-slate-500">
              Resource
            </div>
            {lanes.map((lane) => (
              <div
                key={lane.dayKey}
                className="border-r border-white/[0.06] px-1.5 py-1.5 text-center last:border-r-0"
              >
                <p className="text-[10px] font-semibold uppercase tracking-wide text-slate-500">
                  {calendarDayHeading(lane, calendarTimezone).split(" ")[0]}
                </p>
                <p className="text-xs font-medium text-slate-300">
                  {calendarDayHeading(lane, calendarTimezone).split(" ").slice(1).join(" ")}
                </p>
              </div>
            ))}
          </div>

          {grouped.map((group) => (
            <div key={group.group}>
              <div className="grid bg-white/[0.02]" style={{ gridTemplateColumns: gridTemplate }}>
                <div
                  className={cn(
                    "sticky left-0 z-[3] col-span-full flex items-center gap-2 border-b border-white/[0.06] px-2 text-[10px] font-semibold uppercase tracking-wider text-cyan-400/80",
                    tokens.weekGroupHeaderPy
                  )}
                >
                  <span className="h-px flex-1 bg-cyan-500/15" aria-hidden />
                  {group.label}
                  <span className="text-[9px] font-normal normal-case text-slate-500">
                    {group.rows.length}
                  </span>
                  <span className="h-px flex-1 bg-cyan-500/15" aria-hidden />
                </div>
              </div>
              {group.rows.map((row) => (
                <div
                  key={row.id}
                  className="grid border-b border-white/[0.05]"
                  style={{ gridTemplateColumns: gridTemplate }}
                >
                  <CalendarOsResourceLaneLabel row={row} density={density} />
                  {lanes.map((lane) => {
                    const ids = cellLookup.get(`${row.id}|${lane.dayKey}`) ?? [];
                    return (
                      <div
                        key={`${row.id}-${lane.dayKey}`}
                        className="space-y-0.5 border-r border-white/[0.05] p-0.5 last:border-r-0"
                        style={{ minHeight: tokens.weekRowMinHeight }}
                      >
                        {ids.length === 0 ? (
                          <CalendarOsEmptyContext
                            context={sparseContext}
                            variant="week-cell"
                            suppressWeekCellMarker={!showSparseBanner}
                          />
                        ) : (
                          ids.map((id) => {
                            const model = cardModels[id];
                            const booking = bookingById.get(id);
                            if (!model || !booking) return null;
                            return (
                              <CalendarOsBookingCard
                                key={id}
                                model={model}
                                compact
                                ultraCompact={tokens.bookingUltraCompact}
                                showHoverDetail={tokens.showHoverDetail}
                                highlighted={highlightedBookingId === id}
                                onSelect={() => onSelectBooking?.(booking)}
                              />
                            );
                          })
                        )}
                      </div>
                    );
                  })}
                </div>
              ))}
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

export type { CalendarOsBookingCardModel };
