"use client";

import type { CSSProperties } from "react";

import { calendarDayHeading } from "@/src/lib/bookings/calendarLabels";
import type { CalendarDayLane } from "@/src/lib/bookings/calendarView";
import type { FiBookingRow } from "@/src/lib/bookings/types";
import type {
  OperationalCalendarBookingDisplay,
  OperationalCalendarResourceColumn,
} from "@/src/lib/calendar/operationalCalendarTypes";
import {
  businessGridBodyHeightPx,
  layoutBookingInBusinessDayUtc,
  resolveDisplayResourceColumnId,
  slotCount,
  utcBusinessSlotIsoRange,
  type BusinessGridConfig,
  OPERATIONAL_CAL_PX_PER_HOUR,
} from "@/src/lib/calendar/operationalCalendarLayout";
import { displayCalendarTimezoneSubtitle } from "@/src/lib/calendar/calendarTimezone";
import { formatWallClockMinutesFromMidnight } from "@/lib/calendar/time-slots";
import { BookingCalendarCard } from "./BookingCalendarCard";
import { CalendarResourceColumn } from "./CalendarResourceColumn";

const TIME_GUTTER_STYLE: CSSProperties = { width: "3.25rem" };

function slotHeightPx(cfg: BusinessGridConfig): number {
  return OPERATIONAL_CAL_PX_PER_HOUR * (cfg.slotMinutes / 60);
}

function TimeGutter({ gridConfig }: { gridConfig: BusinessGridConfig }) {
  const hours: number[] = [];
  for (let h = gridConfig.dayStartHourUtc; h < gridConfig.dayEndHourUtc; h++) hours.push(h);
  const bodyH = businessGridBodyHeightPx(gridConfig);
  return (
    <div
      className="sticky left-0 z-[3] shrink-0 border-r border-white/[0.08] bg-white/[0.03] dark:border-slate-800 dark:bg-slate-900"
      style={TIME_GUTTER_STYLE}
    >
      <div className="h-14 border-b border-white/[0.08] dark:border-slate-800" aria-hidden />
      <div className="relative" style={{ height: bodyH }}>
        {hours.map((h) => (
          <div
            key={h}
            className="absolute left-0 right-0 border-t border-white/[0.06] pr-1 text-right text-[10px] font-medium tabular-nums text-slate-500 dark:border-slate-800 dark:text-slate-400"
            style={{
              top: (h - gridConfig.dayStartHourUtc) * OPERATIONAL_CAL_PX_PER_HOUR,
              height: OPERATIONAL_CAL_PX_PER_HOUR,
            }}
          >
            {formatWallClockMinutesFromMidnight(h * 60)}
          </div>
        ))}
      </div>
    </div>
  );
}

function SlotDropLayer({
  dayKey,
  gridConfig,
  disabled,
  onDropBooking,
}: {
  dayKey: string;
  gridConfig: BusinessGridConfig;
  disabled: boolean;
  onDropBooking: (bookingId: string, startIso: string, endIso: string) => void;
}) {
  const n = slotCount(gridConfig);
  const h = slotHeightPx(gridConfig);
  return (
    <div className="pointer-events-none absolute inset-0 flex flex-col">
      {Array.from({ length: n }, (_, slotIndex) => (
        <div
          key={slotIndex}
          className="pointer-events-auto shrink-0 border-b border-white/[0.06] last:border-b-0 dark:border-slate-800/80"
          style={{ height: h }}
          onDragOver={(e) => {
            if (disabled) return;
            e.preventDefault();
            e.dataTransfer.dropEffect = "move";
          }}
          onDrop={(e) => {
            if (disabled) return;
            e.preventDefault();
            const raw =
              e.dataTransfer.getData("text/fi-booking") || e.dataTransfer.getData("text/plain");
            if (!raw?.trim()) return;
            let id: string;
            let durMs: number;
            try {
              const p = JSON.parse(raw) as { id?: string; durMs?: number };
              if (!p.id) return;
              id = p.id;
              durMs = Number(p.durMs) && Number.isFinite(p.durMs) ? Number(p.durMs) : 30 * 60_000;
            } catch {
              return;
            }
            const slot = utcBusinessSlotIsoRange(dayKey, slotIndex, gridConfig);
            if (!slot) return;
            const startMs = Date.parse(slot.startIso);
            const endMs = startMs + durMs;
            onDropBooking(id, slot.startIso, new Date(endMs).toISOString());
          }}
        />
      ))}
    </div>
  );
}

export function CalendarWeekView({
  view,
  lanes,
  buckets,
  gridConfig,
  bookingDisplay,
  resourceColumns,
  canMutateBookings,
  bookings,
  onSelectBooking,
  onRescheduleBooking,
}: {
  view: "day" | "week";
  lanes: CalendarDayLane[];
  buckets: Record<string, FiBookingRow[]>;
  gridConfig: BusinessGridConfig;
  bookingDisplay: Record<string, OperationalCalendarBookingDisplay>;
  resourceColumns: OperationalCalendarResourceColumn[];
  canMutateBookings: boolean;
  bookings: FiBookingRow[];
  onSelectBooking: (b: FiBookingRow) => void;
  onRescheduleBooking: (
    booking: FiBookingRow,
    startIso: string,
    endIso: string
  ) => Promise<{ ok: boolean; error?: string }>;
}) {
  const bodyH = businessGridBodyHeightPx(gridConfig);

  function onDropBooking(bookingId: string, startIso: string, endIso: string) {
    const b = bookings.find((x) => x.id === bookingId);
    if (!b) return;
    void onRescheduleBooking(b, startIso, endIso);
  }

  if (view === "day" && lanes[0]) {
    const lane = lanes[0];
    const dayKey = lane.dayKey;
    return (
      <div className="flex w-full overflow-x-auto rounded-xl border border-white/[0.08] bg-[#0F1629]/80 backdrop-blur-md shadow-lg shadow-black/40 dark:border-slate-800 dark:bg-slate-950">
        <TimeGutter gridConfig={gridConfig} />
        <div className="flex min-w-[720px] flex-1">
          {resourceColumns.map((col) => {
            const colBookings = (buckets[dayKey] ?? []).filter(
              (b) =>
                resolveDisplayResourceColumnId(
                  b,
                  resourceColumns.map((c) => c.id)
                ) === col.id
            );
            return (
              <CalendarResourceColumn
                key={col.id}
                label={col.label}
                subtitle={col.subtitle}
                bodyMinHeightPx={bodyH}
              >
                <SlotDropLayer
                  dayKey={dayKey}
                  gridConfig={gridConfig}
                  disabled={!canMutateBookings}
                  onDropBooking={onDropBooking}
                />
                <div className="relative z-[1]" style={{ height: bodyH }}>
                  {colBookings.map((b) => {
                    const layout = layoutBookingInBusinessDayUtc(b, lane, gridConfig);
                    if (!layout) return null;
                    const d = bookingDisplay[b.id] ?? {
                      anchorLabel: "Booking",
                      scalesSummary: null,
                      durationMin: 30,
                      reminderHint: null,
                    };
                    return (
                      <BookingCalendarCard
                        key={b.id}
                        booking={b}
                        display={d}
                        layout={layout}
                        draggable={canMutateBookings}
                        calendarTimezone={gridConfig.timeZone}
                        onClick={() => onSelectBooking(b)}
                        onDragStart={(e) => {
                          const startMs = Date.parse(b.start_at);
                          const endMs = Date.parse(b.end_at);
                          const durMs =
                            Number.isFinite(startMs) && Number.isFinite(endMs)
                              ? Math.max(60_000, endMs - startMs)
                              : 30 * 60_000;
                          const payload = JSON.stringify({ id: b.id, durMs });
                          e.dataTransfer.setData("text/fi-booking", payload);
                          e.dataTransfer.setData("text/plain", payload);
                          e.dataTransfer.effectAllowed = "move";
                        }}
                      />
                    );
                  })}
                </div>
              </CalendarResourceColumn>
            );
          })}
        </div>
      </div>
    );
  }

  return (
    <div className="flex w-full overflow-x-auto rounded-xl border border-white/[0.08] bg-[#0F1629]/80 backdrop-blur-md shadow-lg shadow-black/40 dark:border-slate-800 dark:bg-slate-950">
      <TimeGutter gridConfig={gridConfig} />
      <div className="flex min-w-[640px] flex-1">
        {lanes.map((lane) => {
          const events = buckets[lane.dayKey] ?? [];
          return (
            <CalendarResourceColumn
              key={lane.dayKey}
              label={calendarDayHeading(lane)}
              subtitle={displayCalendarTimezoneSubtitle(gridConfig.timeZone)}
              bodyMinHeightPx={bodyH}
            >
              <SlotDropLayer
                dayKey={lane.dayKey}
                gridConfig={gridConfig}
                disabled={!canMutateBookings}
                onDropBooking={onDropBooking}
              />
              <div className="relative z-[1]" style={{ height: bodyH }}>
                {events.map((b) => {
                  const layout = layoutBookingInBusinessDayUtc(b, lane, gridConfig);
                  if (!layout) return null;
                  const d = bookingDisplay[b.id] ?? {
                    anchorLabel: "Booking",
                    scalesSummary: null,
                    durationMin: 30,
                    reminderHint: null,
                  };
                  return (
                    <BookingCalendarCard
                      key={`${lane.dayKey}-${b.id}`}
                      booking={b}
                      display={d}
                      layout={layout}
                      draggable={canMutateBookings}
                      calendarTimezone={gridConfig.timeZone}
                      onClick={() => onSelectBooking(b)}
                      onDragStart={(e) => {
                        const startMs = Date.parse(b.start_at);
                        const endMs = Date.parse(b.end_at);
                        const durMs =
                          Number.isFinite(startMs) && Number.isFinite(endMs)
                            ? Math.max(60_000, endMs - startMs)
                            : 30 * 60_000;
                        const payload = JSON.stringify({ id: b.id, durMs });
                        e.dataTransfer.setData("text/fi-booking", payload);
                        e.dataTransfer.setData("text/plain", payload);
                        e.dataTransfer.effectAllowed = "move";
                      }}
                    />
                  );
                })}
              </div>
            </CalendarResourceColumn>
          );
        })}
      </div>
    </div>
  );
}
