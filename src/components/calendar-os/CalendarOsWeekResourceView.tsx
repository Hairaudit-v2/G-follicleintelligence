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
  buildCalendarOsResourceRows,
  groupCalendarOsResourceRowsByRole,
  mapBookingsToWeekResourceCells,
  type CalendarOsResourceRow,
} from "@/src/lib/calendar-os/calendarResourceModel";
import type {
  OperationalCalendarBookingDisplay,
  OperationalCalendarResourceColumn,
} from "@/src/lib/calendar/operationalCalendarTypes";
import type { ParsedCalendarQuery } from "@/src/lib/bookings/calendarQuery";
import type { ClinicalStaffPickerOption } from "@/src/lib/staff/clinicalStaffPicker";
import type { FiClinicRoomRow } from "@/src/lib/rooms/roomTypes";
import { CalendarOsBookingCard } from "@/src/components/calendar-os/CalendarOsBookingCard";

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
  onSelectBooking?: (booking: FiBookingRow) => void;
  highlightedBookingId?: string | null;
};

function ResourceRowLabel({ row }: { row: CalendarOsResourceRow }) {
  return (
    <div className="sticky left-0 z-[2] flex min-h-[52px] flex-col justify-center border-r border-white/[0.08] bg-[#0a1220] px-2 py-1.5">
      <p className="truncate text-xs font-medium text-slate-200">{row.label}</p>
      {row.subtitle ? (
        <p className="truncate text-[10px] text-slate-500">{row.subtitle}</p>
      ) : null}
      {row.readinessWarning ? (
        <p className="truncate text-[9px] text-amber-300">{row.readinessWarning}</p>
      ) : null}
    </div>
  );
}

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
  onSelectBooking,
  highlightedBookingId,
}: CalendarOsWeekResourceViewProps) {
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

  const grouped = useMemo(() => groupCalendarOsResourceRowsByRole(resourceRows), [resourceRows]);

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

  const cellLookup = useMemo(() => {
    const map = new Map<string, string[]>();
    for (const cell of cells) {
      map.set(`${cell.resourceId}|${cell.dayKey}`, cell.bookingIds);
    }
    return map;
  }, [cells]);

  const bookingById = useMemo(() => new Map(bookings.map((b) => [b.id, b])), [bookings]);

  return (
    <div className="flex min-h-0 flex-1 flex-col overflow-hidden">
      <div className="min-h-0 flex-1 overflow-auto">
        <div className="min-w-max">
          <div
            className="grid border-b border-white/[0.08] bg-[#0a1220]"
            style={{ gridTemplateColumns: `180px repeat(${lanes.length}, minmax(140px, 1fr))` }}
          >
            <div className="sticky left-0 z-[3] border-r border-white/[0.08] px-2 py-2 text-[10px] font-semibold uppercase tracking-wider text-slate-500">
              Resource
            </div>
            {lanes.map((lane) => (
              <div
                key={lane.dayKey}
                className="border-r border-white/[0.06] px-2 py-2 text-center text-xs font-medium text-slate-300 last:border-r-0"
              >
                {calendarDayHeading(lane, calendarTimezone)}
              </div>
            ))}
          </div>

          {grouped.map((group) => (
            <div key={group.group}>
              <div
                className="grid bg-white/[0.02]"
                style={{ gridTemplateColumns: `180px repeat(${lanes.length}, minmax(140px, 1fr))` }}
              >
                <div className="sticky left-0 z-[2] col-span-full border-b border-white/[0.06] px-2 py-1 text-[10px] font-semibold uppercase tracking-wider text-cyan-400/80">
                  {group.label}
                </div>
              </div>
              {group.rows.map((row) => (
                <div
                  key={row.id}
                  className="grid border-b border-white/[0.05]"
                  style={{
                    gridTemplateColumns: `180px repeat(${lanes.length}, minmax(140px, 1fr))`,
                  }}
                >
                  <ResourceRowLabel row={row} />
                  {lanes.map((lane) => {
                    const ids = cellLookup.get(`${row.id}|${lane.dayKey}`) ?? [];
                    return (
                      <div
                        key={`${row.id}-${lane.dayKey}`}
                        className="min-h-[52px] space-y-1 border-r border-white/[0.05] p-1 last:border-r-0"
                      >
                        {ids.map((id) => {
                          const model = cardModels[id];
                          const booking = bookingById.get(id);
                          if (!model || !booking) return null;
                          return (
                            <CalendarOsBookingCard
                              key={id}
                              model={model}
                              compact
                              highlighted={highlightedBookingId === id}
                              onSelect={() => onSelectBooking?.(booking)}
                            />
                          );
                        })}
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
