"use client";

import { useMemo, type ReactNode } from "react";

import type { CalendarRoute } from "@/src/lib/bookings/calendarQuery";
import type { CalendarDayLane } from "@/src/lib/bookings/calendarView";
import type { FiBookingRow } from "@/src/lib/bookings/types";
import { buildStaffUserLinkIndex } from "@/src/lib/calendar/operationalCalendarColumns";
import type { BusinessGridConfig } from "@/src/lib/calendar/operationalCalendarLayout";
import type {
  OperationalCalendarBookingDisplay,
  OperationalCalendarPageData,
} from "@/src/lib/calendar/operationalCalendarTypes";
import { buildCalendarOsOperationalPanelSummary } from "@/src/lib/calendar-os/calendarOperationalWarnings";
import { CalendarOsDayResourceView } from "@/src/components/calendar-os/CalendarOsDayResourceView";
import { CalendarOsOperationalPanel } from "@/src/components/calendar-os/CalendarOsOperationalPanel";
import { CalendarOsViewControls } from "@/src/components/calendar-os/CalendarOsViewControls";
import { CalendarOsWeekResourceView } from "@/src/components/calendar-os/CalendarOsWeekResourceView";

export type CalendarOsShellProps = {
  data: OperationalCalendarPageData;
  bookings: FiBookingRow[];
  bookingDisplay: Record<string, OperationalCalendarBookingDisplay>;
  route?: CalendarRoute;
  sidebar?: ReactNode;
  rightPanel?: ReactNode;
  onSelectBooking?: (booking: FiBookingRow) => void;
  highlightedBookingId?: string | null;
  onEmptySlotClick?: (info: { dayKey: string; columnId: string; localStart: string }) => void;
};

export function CalendarOsShell({
  data,
  bookings,
  bookingDisplay,
  route = "fi-admin",
  sidebar,
  rightPanel,
  onSelectBooking,
  highlightedBookingId,
  onEmptySlotClick,
}: CalendarOsShellProps) {
  const { staffIdByUserId } = useMemo(
    () => buildStaffUserLinkIndex(data.staffDirectory),
    [data.staffDirectory]
  );

  const panelSummary = useMemo(
    () =>
      buildCalendarOsOperationalPanelSummary({
        bookings,
        bookingDisplay,
        staffDirectory: data.staffDirectory,
        rooms: data.rooms,
        lanesDayKeys: data.lanes.map((l) => l.dayKey),
      }),
    [bookings, bookingDisplay, data.staffDirectory, data.rooms, data.lanes]
  );

  const isDayLayout = data.query.view === "day" || data.query.view === "3day";
  const dayLane: CalendarDayLane | undefined = data.lanes[0];

  return (
    <div className="flex min-h-0 flex-1 flex-col overflow-hidden bg-[#081020]">
      <div className="flex items-center justify-between gap-2 border-b border-cyan-500/20 bg-cyan-950/20 px-3 py-1.5">
        <span className="text-[11px] font-medium text-cyan-200/90">
          CalendarOS V2 — resource-first operations view
        </span>
        <span className="text-[10px] text-slate-500">Legacy calendar available when V2 is off</span>
      </div>

      <CalendarOsViewControls tenantId={data.tenantId} query={data.query} route={route} />
      <CalendarOsOperationalPanel summary={panelSummary} />

      <div className="flex min-h-0 flex-1">
        {sidebar ? (
          <div className="hidden w-56 shrink-0 border-r border-white/[0.06] lg:block">{sidebar}</div>
        ) : null}

        <div className="flex min-h-0 min-w-0 flex-1 flex-col">
          {isDayLayout && dayLane ? (
            <CalendarOsDayResourceView
              query={data.query}
              lane={dayLane}
              bookings={bookings}
              bookingDisplay={bookingDisplay}
              resourceColumns={data.resourceColumns}
              staffDirectory={data.staffDirectory}
              rooms={data.rooms}
              staffIdByUserId={staffIdByUserId}
              gridConfig={data.gridConfig}
              calendarTimezone={data.calendarTimezone}
              onSelectBooking={onSelectBooking}
              highlightedBookingId={highlightedBookingId}
              onEmptySlotClick={onEmptySlotClick}
            />
          ) : (
            <CalendarOsWeekResourceView
              query={data.query}
              lanes={data.lanes}
              bookings={bookings}
              bookingDisplay={bookingDisplay}
              resourceColumns={data.resourceColumns}
              staffDirectory={data.staffDirectory}
              rooms={data.rooms}
              staffIdByUserId={staffIdByUserId}
              calendarTimezone={data.calendarTimezone}
              onSelectBooking={onSelectBooking}
              highlightedBookingId={highlightedBookingId}
            />
          )}
        </div>

        {rightPanel ? (
          <div className="hidden w-72 shrink-0 border-l border-white/[0.06] xl:block">{rightPanel}</div>
        ) : null}
      </div>
    </div>
  );
}

export type { BusinessGridConfig };
