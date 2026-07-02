"use client";

import { useEffect, useMemo, useState } from "react";

import { calendarDayHeading } from "@/src/lib/bookings/calendarLabels";
import type { CalendarDayLane } from "@/src/lib/bookings/calendarView";
import type { FiBookingRow } from "@/src/lib/bookings/types";
import {
  buildCalendarOsBookingCardModels,
} from "@/src/lib/calendar-os/calendarBookingCardModel";
import {
  buildCalendarOsResourceRows,
  deriveWorkforceBlocksForStaffRow,
  mapBookingsToDayResourcePlacements,
} from "@/src/lib/calendar-os/calendarResourceModel";
import type {
  OperationalCalendarBookingDisplay,
  OperationalCalendarResourceColumn,
} from "@/src/lib/calendar/operationalCalendarTypes";
import type { ParsedCalendarQuery } from "@/src/lib/bookings/calendarQuery";
import type { ClinicalStaffPickerOption } from "@/src/lib/staff/clinicalStaffPicker";
import type { FiClinicRoomRow } from "@/src/lib/rooms/roomTypes";
import type { BusinessGridConfig } from "@/src/lib/calendar/operationalCalendarLayout";
import {
  businessGridBodyHeightPx,
  OPERATIONAL_CAL_PX_PER_HOUR,
} from "@/src/lib/calendar/operationalCalendarLayout";
import { formatWallClockMinutesFromMidnight } from "@/lib/calendar/time-slots";
import { CalendarOsBookingCard } from "@/src/components/calendar-os/CalendarOsBookingCard";
import { cn } from "@/lib/utils";

const RESOURCE_COL_MIN = 160;
const TIME_GUTTER_W = 52;

const BLOCK_TONE: Record<string, string> = {
  rdo: "bg-slate-600/30 border-slate-500/30 text-slate-400",
  leave: "bg-rose-500/15 border-rose-500/25 text-rose-200",
  lunch: "bg-amber-500/10 border-amber-500/20 text-amber-200/80",
  unavailable: "bg-slate-700/40 border-slate-600/30 text-slate-400",
  working_hours: "bg-emerald-500/5 border-emerald-500/15 text-emerald-200/70",
};

export type CalendarOsDayResourceViewProps = {
  query: ParsedCalendarQuery;
  lane: CalendarDayLane;
  bookings: FiBookingRow[];
  bookingDisplay: Record<string, OperationalCalendarBookingDisplay>;
  resourceColumns: OperationalCalendarResourceColumn[];
  staffDirectory: ClinicalStaffPickerOption[];
  rooms: FiClinicRoomRow[];
  staffIdByUserId: Map<string, string>;
  gridConfig: BusinessGridConfig;
  calendarTimezone: string;
  onSelectBooking?: (booking: FiBookingRow) => void;
  highlightedBookingId?: string | null;
  onEmptySlotClick?: (info: { dayKey: string; columnId: string; localStart: string }) => void;
};

export function CalendarOsDayResourceView({
  query,
  lane,
  bookings,
  bookingDisplay,
  resourceColumns,
  staffDirectory,
  rooms,
  staffIdByUserId,
  gridConfig,
  calendarTimezone,
  onSelectBooking,
  highlightedBookingId,
  onEmptySlotClick,
}: CalendarOsDayResourceViewProps) {
  const [nowTopPx, setNowTopPx] = useState<number | null>(null);

  const resourceRows = useMemo(
    () => buildCalendarOsResourceRows({ query, resourceColumns, staffDirectory, rooms }),
    [query, resourceColumns, staffDirectory, rooms]
  );

  const cardModels = useMemo(
    () => buildCalendarOsBookingCardModels(bookings, bookingDisplay, calendarTimezone),
    [bookings, bookingDisplay, calendarTimezone]
  );

  const placements = useMemo(
    () =>
      mapBookingsToDayResourcePlacements({
        query,
        lanes: [lane],
        bookings,
        resourceColumns,
        staffDirectory,
        rooms,
        staffIdByUserId,
        gridConfig,
        lane,
      }),
    [
      query,
      lane,
      bookings,
      resourceColumns,
      staffDirectory,
      rooms,
      staffIdByUserId,
      gridConfig,
    ]
  );

  const placementsByResource = useMemo(() => {
    const map = new Map<string, typeof placements>();
    for (const p of placements) {
      const list = map.get(p.resourceId) ?? [];
      list.push(p);
      map.set(p.resourceId, list);
    }
    return map;
  }, [placements]);

  const staffById = useMemo(
    () => new Map(staffDirectory.map((s) => [String(s.id), s])),
    [staffDirectory]
  );

  const workforceBlocks = useMemo(() => {
    const blocks = [];
    for (const row of resourceRows) {
      if (!row.staffId) continue;
      const staff = staffById.get(row.staffId);
      if (!staff) continue;
      blocks.push(
        ...deriveWorkforceBlocksForStaffRow({
          staff,
          dayKey: lane.dayKey,
          gridConfig,
          lane,
        })
      );
    }
    return blocks;
  }, [resourceRows, staffById, lane, gridConfig]);

  const bookingById = useMemo(() => new Map(bookings.map((b) => [b.id, b])), [bookings]);

  const bodyH = businessGridBodyHeightPx(gridConfig);
  const hours: number[] = [];
  for (let h = gridConfig.dayStartHourUtc; h < gridConfig.dayEndHourUtc; h++) hours.push(h);

  useEffect(() => {
    function updateNow() {
      const now = Date.now();
      if (now < lane.startMs || now >= lane.endMs) {
        setNowTopPx(null);
        return;
      }
      const relMin = (now - lane.startMs) / 60_000;
      const gridStart = gridConfig.dayStartHourUtc * 60;
      const gridEnd = gridConfig.dayEndHourUtc * 60;
      if (relMin < gridStart || relMin > gridEnd) {
        setNowTopPx(null);
        return;
      }
      const pxPerMin = OPERATIONAL_CAL_PX_PER_HOUR / 60;
      setNowTopPx((relMin - gridStart) * pxPerMin);
    }
    updateNow();
    const t = window.setInterval(updateNow, 60_000);
    return () => window.clearInterval(t);
  }, [lane.startMs, lane.endMs, gridConfig.dayStartHourUtc, gridConfig.dayEndHourUtc]);

  return (
    <div className="flex min-h-0 flex-1 flex-col overflow-hidden">
      <div className="border-b border-white/[0.06] px-3 py-1.5 text-xs text-slate-400">
        {calendarDayHeading(lane, calendarTimezone)}
      </div>
      <div className="min-h-0 flex-1 overflow-auto">
        <div className="min-w-max">
          <div
            className="sticky top-0 z-[4] grid border-b border-white/[0.08] bg-[#0a1220]"
            style={{
              gridTemplateColumns: `${TIME_GUTTER_W}px repeat(${resourceRows.length}, minmax(${RESOURCE_COL_MIN}px, 1fr))`,
            }}
          >
            <div className="border-r border-white/[0.08]" />
            {resourceRows.map((row) => (
              <div
                key={row.id}
                className="border-r border-white/[0.06] px-2 py-2 last:border-r-0"
              >
                <p className="truncate text-xs font-medium text-slate-200">{row.label}</p>
                {row.subtitle ? (
                  <p className="truncate text-[10px] text-slate-500">{row.subtitle}</p>
                ) : null}
              </div>
            ))}
          </div>

          <div
            className="grid"
            style={{
              gridTemplateColumns: `${TIME_GUTTER_W}px repeat(${resourceRows.length}, minmax(${RESOURCE_COL_MIN}px, 1fr))`,
            }}
          >
            <div
              className="sticky left-0 z-[3] border-r border-white/[0.08] bg-[#0a1220]"
              style={{ height: bodyH }}
            >
              {hours.map((h) => (
                <div
                  key={h}
                  className="absolute left-0 right-0 border-t border-white/[0.06] pr-1 text-right text-[10px] tabular-nums text-slate-500"
                  style={{
                    top: (h - gridConfig.dayStartHourUtc) * OPERATIONAL_CAL_PX_PER_HOUR,
                    height: OPERATIONAL_CAL_PX_PER_HOUR,
                  }}
                >
                  {formatWallClockMinutesFromMidnight(h * 60)}
                </div>
              ))}
            </div>

            {resourceRows.map((row) => (
              <div
                key={row.id}
                className="relative border-r border-white/[0.05] last:border-r-0"
                style={{ height: bodyH }}
                onClick={(e) => {
                  if (!onEmptySlotClick) return;
                  const rect = e.currentTarget.getBoundingClientRect();
                  const y = e.clientY - rect.top;
                  const pxPerMin = OPERATIONAL_CAL_PX_PER_HOUR / 60;
                  const gridStart = gridConfig.dayStartHourUtc * 60;
                  const minutes = Math.floor(y / pxPerMin) + gridStart;
                  const hh = String(Math.floor(minutes / 60)).padStart(2, "0");
                  const mm = String(minutes % 60).padStart(2, "0");
                  onEmptySlotClick({
                    dayKey: lane.dayKey,
                    columnId: row.id,
                    localStart: `${lane.dayKey}T${hh}:${mm}`,
                  });
                }}
              >
                {hours.map((h) => (
                  <div
                    key={h}
                    className="absolute left-0 right-0 border-t border-white/[0.04]"
                    style={{
                      top: (h - gridConfig.dayStartHourUtc) * OPERATIONAL_CAL_PX_PER_HOUR,
                    }}
                  />
                ))}

                {workforceBlocks
                  .filter((b) => b.resourceId === row.id)
                  .map((block) =>
                    block.topPx != null ? (
                      <div
                        key={block.id}
                        className={cn(
                          "pointer-events-none absolute left-0.5 right-0.5 rounded border px-1 text-[9px]",
                          BLOCK_TONE[block.kind] ?? BLOCK_TONE.unavailable
                        )}
                        style={{
                          top: block.topPx,
                          height: block.heightPx ?? 20,
                        }}
                      >
                        {block.label}
                      </div>
                    ) : (
                      <div
                        key={block.id}
                        className={cn(
                          "pointer-events-none absolute inset-x-0 top-0 bottom-0 flex items-center justify-center border-y text-[10px]",
                          BLOCK_TONE[block.kind] ?? BLOCK_TONE.unavailable
                        )}
                      >
                        {block.label}
                      </div>
                    )
                  )}

                {(placementsByResource.get(row.id) ?? []).map((placement) => {
                  const model = cardModels[placement.bookingId];
                  const booking = bookingById.get(placement.bookingId);
                  if (!model || !booking) return null;
                  return (
                    <div
                      key={placement.bookingId}
                      className="absolute left-0.5 right-0.5 z-[1] overflow-hidden"
                      style={{ top: placement.topPx, height: placement.heightPx }}
                    >
                      <CalendarOsBookingCard
                        model={model}
                        compact
                        highlighted={highlightedBookingId === placement.bookingId}
                        onSelect={() => onSelectBooking?.(booking)}
                      />
                    </div>
                  );
                })}
              </div>
            ))}

            {nowTopPx != null ? (
              <div
                className="pointer-events-none absolute z-[5] h-0.5 bg-cyan-400/90 shadow-[0_0_6px_rgba(34,193,255,0.6)]"
                style={{
                  top: nowTopPx + 56,
                  left: TIME_GUTTER_W,
                  right: 0,
                }}
                aria-hidden
              />
            ) : null}
          </div>
        </div>
      </div>
    </div>
  );
}
