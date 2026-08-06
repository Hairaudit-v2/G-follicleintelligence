"use client";

import { useCallback, useEffect, useMemo, useState, type ReactNode } from "react";
import { ChevronDown } from "lucide-react";

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
import {
  calendarOsDensityStorageKey,
  normalizeCalendarOsDisplayDensity,
  type CalendarOsDisplayDensity,
} from "@/src/lib/calendar-os/calendarDisplayDensity";
import { CalendarOsDayResourceView } from "@/src/components/calendar-os/CalendarOsDayResourceView";
import { CalendarOsDensityToggle } from "@/src/components/calendar-os/CalendarOsDensityToggle";
import { CalendarOsOperationalPanel } from "@/src/components/calendar-os/CalendarOsOperationalPanel";
import { CalendarOsPresetBar } from "@/src/components/calendar-os/CalendarOsPresetBar";
import { CalendarOsViewControls } from "@/src/components/calendar-os/CalendarOsViewControls";
import { CalendarOsWeekResourceView } from "@/src/components/calendar-os/CalendarOsWeekResourceView";
import {
  fiOsCalDesktopOnly,
  fiOsCalTabletGridMinHeight,
  fiOsCalTabletOnly,
} from "@/src/lib/calendar/fiOsCalendarResponsive";
import { cn } from "@/lib/utils";

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
  const storageKey = calendarOsDensityStorageKey(data.tenantId);
  const [density, setDensity] = useState<CalendarOsDisplayDensity>("comfortable");
  const [tabletPresetsOpen, setTabletPresetsOpen] = useState(false);

  useEffect(() => {
    try {
      const stored = localStorage.getItem(storageKey);
      if (stored) setDensity(normalizeCalendarOsDisplayDensity(stored));
    } catch {
      /* ignore */
    }
  }, [storageKey]);

  const handleDensityChange = useCallback(
    (next: CalendarOsDisplayDensity) => {
      setDensity(next);
      try {
        localStorage.setItem(storageKey, next);
      } catch {
        /* ignore */
      }
    },
    [storageKey]
  );

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
    <div
      className="calendar-os-v2-root relative z-0 flex min-h-0 flex-1 flex-col overflow-hidden bg-[#050a12]"
      data-testid="calendar-os-v2-shell"
    >
      <div className="flex shrink-0 flex-wrap items-center justify-between gap-x-2 gap-y-1 border-b border-white/[0.06] bg-[#060d18]/95 px-2 py-1">
        <div className="flex min-w-0 flex-1 items-center gap-x-2 gap-y-1">
          <div className={fiOsCalDesktopOnly}>
            <CalendarOsPresetBar
              tenantId={data.tenantId}
              query={data.query}
              route={route}
              compact
            />
          </div>
          <div className={cn(fiOsCalTabletOnly, "min-w-0 flex-1")}>
            <button
              type="button"
              className="inline-flex items-center gap-1 rounded border border-white/[0.08] px-2 py-0.5 text-[10px] font-medium text-slate-400"
              aria-expanded={tabletPresetsOpen}
              data-testid="calendar-os-presets-toggle"
              onClick={() => setTabletPresetsOpen((v) => !v)}
            >
              Presets
              <ChevronDown
                className={cn("h-2.5 w-2.5 transition", tabletPresetsOpen && "rotate-180")}
                aria-hidden
              />
            </button>
            {tabletPresetsOpen ? (
              <div className="mt-1">
                <CalendarOsPresetBar
                  tenantId={data.tenantId}
                  query={data.query}
                  route={route}
                  compact
                />
              </div>
            ) : null}
          </div>
          <span
            className={cn("hidden h-3 w-px bg-white/[0.08] xl:block", fiOsCalDesktopOnly)}
            aria-hidden
          />
          <CalendarOsViewControls
            tenantId={data.tenantId}
            query={data.query}
            route={route}
            inline
          />
        </div>
        <CalendarOsDensityToggle density={density} onDensityChange={handleDensityChange} />
      </div>

      <CalendarOsOperationalPanel summary={panelSummary} density={density} />

      <div className={cn("flex min-h-0 min-w-0 flex-1", fiOsCalTabletGridMinHeight)}>
        {sidebar ? (
          <div className="hidden w-48 shrink-0 border-r border-white/[0.05] lg:block">
            {sidebar}
          </div>
        ) : null}

        <div className="flex min-h-0 min-w-0 flex-1 flex-col overflow-hidden">
          {isDayLayout && dayLane ? (
            <CalendarOsDayResourceView
              query={data.query}
              lane={dayLane}
              bookings={bookings}
              bookingDisplay={bookingDisplay}
              resourceColumns={data.resourceColumns}
              staffDirectory={data.staffDirectory}
              availabilityBlocksByStaffId={data.availabilityBlocksByStaffId}
              rooms={data.rooms}
              staffIdByUserId={staffIdByUserId}
              gridConfig={data.gridConfig}
              calendarTimezone={data.calendarTimezone}
              density={density}
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
              gridConfig={data.gridConfig}
              density={density}
              onSelectBooking={onSelectBooking}
              highlightedBookingId={highlightedBookingId}
              onEmptySlotClick={onEmptySlotClick}
            />
          )}
        </div>

        {rightPanel ? (
          <div className="hidden w-64 shrink-0 border-l border-white/[0.05] xl:block">
            {rightPanel}
          </div>
        ) : null}
      </div>
    </div>
  );
}

export type { BusinessGridConfig };
