"use client";

import { useEffect, useMemo, useRef, useState } from "react";

import { calendarDayHeading } from "@/src/lib/bookings/calendarLabels";
import type { CalendarDayLane } from "@/src/lib/bookings/calendarView";
import type { FiBookingRow } from "@/src/lib/bookings/types";
import { buildCalendarOsBookingCardModels } from "@/src/lib/calendar-os/calendarBookingCardModel";
import {
  attachUtilisationToResourceRows,
  buildCalendarOsResourceRows,
  deriveWorkforceBlocksForStaffRow,
  mapBookingsToDayResourcePlacements,
  mapBookingsToWeekResourceCells,
} from "@/src/lib/calendar-os/calendarResourceModel";
import type {
  OperationalCalendarBookingDisplay,
  OperationalCalendarResourceColumn,
} from "@/src/lib/calendar/operationalCalendarTypes";
import type { ParsedCalendarQuery } from "@/src/lib/bookings/calendarQuery";
import type { ClinicalStaffPickerOption } from "@/src/lib/staff/clinicalStaffPicker";
import type { FiClinicRoomRow } from "@/src/lib/rooms/roomTypes";
import type { BusinessGridConfig } from "@/src/lib/calendar/operationalCalendarLayout";
import { formatWallClockMinutesFromMidnight } from "@/lib/calendar/time-slots";
import {
  calendarOsDayBodyHeightPx,
  calendarOsDayGridTemplate,
  calendarOsDensityTokens,
  type CalendarOsDisplayDensity,
} from "@/src/lib/calendar-os/calendarDisplayDensity";
import { CalendarOsBookingCard } from "@/src/components/calendar-os/CalendarOsBookingCard";
import { CalendarOsEmptyContext } from "@/src/components/calendar-os/CalendarOsEmptyContext";
import { CalendarOsResourceLaneLabel } from "@/src/components/calendar-os/CalendarOsResourceLaneLabel";
import { cn } from "@/lib/utils";

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
  density?: CalendarOsDisplayDensity;
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
  density = "comfortable",
  onSelectBooking,
  highlightedBookingId,
  onEmptySlotClick,
}: CalendarOsDayResourceViewProps) {
  const tokens = calendarOsDensityTokens(density);
  const headerRef = useRef<HTMLDivElement>(null);
  const [headerHeight, setHeaderHeight] = useState(48);
  const [nowTopPx, setNowTopPx] = useState<number | null>(null);

  const resourceRowsBase = useMemo(
    () => buildCalendarOsResourceRows({ query, resourceColumns, staffDirectory, rooms }),
    [query, resourceColumns, staffDirectory, rooms]
  );

  const weekCells = useMemo(
    () =>
      mapBookingsToWeekResourceCells({
        query,
        lanes: [lane],
        bookings,
        resourceColumns,
        staffDirectory,
        rooms,
        staffIdByUserId,
        gridConfig,
      }),
    [query, lane, bookings, resourceColumns, staffDirectory, rooms, staffIdByUserId, gridConfig]
  );

  const resourceRows = useMemo(
    () => attachUtilisationToResourceRows(resourceRowsBase, weekCells, bookings, lane.dayKey),
    [resourceRowsBase, weekCells, bookings, lane.dayKey]
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

  const gridHours = gridConfig.dayEndHourUtc - gridConfig.dayStartHourUtc;
  const pxPerHour = tokens.dayPxPerHour;
  const bodyH = calendarOsDayBodyHeightPx(density, gridHours);
  const pxPerMin = pxPerHour / 60;
  const gridTemplate = calendarOsDayGridTemplate(density, resourceRows.length);

  const hours: number[] = [];
  for (let h = gridConfig.dayStartHourUtc; h < gridConfig.dayEndHourUtc; h++) hours.push(h);

  useEffect(() => {
    const el = headerRef.current;
    if (!el) return;
    const ro = new ResizeObserver(() => setHeaderHeight(el.offsetHeight));
    ro.observe(el);
    setHeaderHeight(el.offsetHeight);
    return () => ro.disconnect();
  }, [resourceRows.length]);

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
      setNowTopPx((relMin - gridStart) * pxPerMin);
    }
    updateNow();
    const t = window.setInterval(updateNow, 30_000);
    return () => window.clearInterval(t);
  }, [lane.startMs, lane.endMs, gridConfig.dayStartHourUtc, gridConfig.dayEndHourUtc, pxPerMin]);

  return (
    <div className="flex min-h-0 flex-1 flex-col overflow-hidden">
      <div className="border-b border-white/[0.06] px-3 py-1 text-xs text-slate-400">
        {calendarDayHeading(lane, calendarTimezone)}
      </div>
      <div className="min-h-0 flex-1 overflow-auto overscroll-x-contain">
        <div className="relative min-w-max">
          <div
            ref={headerRef}
            className="sticky top-0 z-[4] grid border-b border-white/[0.08] bg-[#0a1220] shadow-[0_4px_12px_rgba(0,0,0,0.35)]"
            style={{ gridTemplateColumns: gridTemplate }}
          >
            <div
              className="sticky left-0 z-[5] border-r border-white/[0.08] bg-[#0a1220]"
              aria-hidden
            />
            {resourceRows.map((row) => (
              <div
                key={row.id}
                className={cn(
                  "border-r border-white/[0.06] last:border-r-0",
                  row.kind === "unassigned" && "bg-amber-950/20"
                )}
              >
                <CalendarOsResourceLaneLabel row={row} density={density} horizontal sticky={false} />
              </div>
            ))}
          </div>

          <div className="relative grid" style={{ gridTemplateColumns: gridTemplate }}>
            <div
              className="sticky left-0 z-[3] border-r border-white/[0.08] bg-[#0a1220]"
              style={{ height: bodyH }}
            >
              {hours.map((h) => (
                <div
                  key={h}
                  className="absolute left-0 right-0 border-t border-white/[0.06] pr-1 text-right tabular-nums text-slate-500"
                  style={{
                    top: (h - gridConfig.dayStartHourUtc) * pxPerHour,
                    height: pxPerHour,
                    fontSize: density === "command" ? 9 : 10,
                  }}
                >
                  {formatWallClockMinutesFromMidnight(h * 60)}
                </div>
              ))}
            </div>

            {resourceRows.map((row) => {
              const rowPlacements = placementsByResource.get(row.id) ?? [];
              return (
                <div
                  key={row.id}
                  className={cn(
                    "relative border-r border-white/[0.05] last:border-r-0",
                    row.kind === "unassigned" && "bg-amber-950/10"
                  )}
                  style={{ height: bodyH }}
                  onClick={(e) => {
                    if (!onEmptySlotClick) return;
                    const rect = e.currentTarget.getBoundingClientRect();
                    const y = e.clientY - rect.top;
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
                        top: (h - gridConfig.dayStartHourUtc) * pxPerHour,
                      }}
                    />
                  ))}

                  {rowPlacements.length === 0 ? (
                    <CalendarOsEmptyContext
                      context={{
                        totalBookings: 0,
                        availableStaffCount: 0,
                        openRoomsCount: 0,
                        unassignedCount: 0,
                        followUpCount: 0,
                        availableStaffNames: [],
                        openRoomNames: [],
                        suggestedActions: [],
                      }}
                      variant="day-column"
                    />
                  ) : null}

                  {workforceBlocks
                    .filter((b) => b.resourceId === row.id)
                    .map((block) => {
                      const scale = pxPerHour / 44;
                      const topPx = block.topPx != null ? block.topPx * scale : undefined;
                      const heightPx = block.heightPx != null ? block.heightPx * scale : 20;
                      return block.topPx != null ? (
                        <div
                          key={block.id}
                          className={cn(
                            "pointer-events-none absolute left-0.5 right-0.5 rounded border px-1 text-[9px]",
                            BLOCK_TONE[block.kind] ?? BLOCK_TONE.unavailable
                          )}
                          style={{
                            top: topPx,
                            height: heightPx,
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
                      );
                    })}

                  {rowPlacements.map((placement) => {
                    const model = cardModels[placement.bookingId];
                    const booking = bookingById.get(placement.bookingId);
                    if (!model || !booking) return null;
                    const topPx = (placement.topPx / 44) * pxPerHour;
                    const heightPx = Math.max((placement.heightPx / 44) * pxPerHour, 18);
                    return (
                      <div
                        key={placement.bookingId}
                        className="absolute left-0.5 right-0.5 z-[1] overflow-hidden"
                        style={{ top: topPx, height: heightPx }}
                      >
                        <CalendarOsBookingCard
                          model={model}
                          compact
                          ultraCompact={tokens.bookingUltraCompact}
                          showHoverDetail={tokens.showHoverDetail}
                          highlighted={highlightedBookingId === placement.bookingId}
                          onSelect={() => onSelectBooking?.(booking)}
                        />
                      </div>
                    );
                  })}
                </div>
              );
            })}

            {nowTopPx != null ? (
              <>
                <div
                  className="pointer-events-none absolute z-[6] w-2 -translate-x-1/2 rounded-full bg-cyan-400 shadow-[0_0_8px_rgba(34,211,238,0.8)]"
                  style={{
                    top: headerHeight + nowTopPx - 4,
                    left: tokens.dayTimeGutterWidth / 2,
                    height: 8,
                  }}
                  aria-hidden
                />
                <div
                  className="pointer-events-none absolute z-[5] h-px bg-gradient-to-r from-cyan-400/90 via-cyan-400/60 to-transparent shadow-[0_0_6px_rgba(34,193,255,0.5)]"
                  style={{
                    top: headerHeight + nowTopPx,
                    left: tokens.dayTimeGutterWidth,
                    right: 0,
                  }}
                  aria-hidden
                />
              </>
            ) : null}
          </div>
        </div>
      </div>
    </div>
  );
}
