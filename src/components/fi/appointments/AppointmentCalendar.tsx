"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { cn } from "@/lib/utils";
import { updateBookingAction } from "@/lib/actions/fi-booking-actions";
import { BookingStatusBadge } from "@/src/components/fi/bookings/operator/BookingStatusBadge";
import {
  bookingCalendarChipSurface,
  bookingStatusCalendarAccent,
  bookingTypeCalendarLegendLabel,
  calendarDayHeading,
} from "@/src/lib/bookings/calendarLabels";
import type { CalendarViewData } from "@/src/lib/bookings/calendarLoader";
import { buildAppointmentsHref } from "@/src/lib/bookings/appointmentsQuery";
import {
  checkAppointmentAvailability,
  DEFAULT_APPOINTMENT_BUFFER_MINUTES,
} from "@/src/lib/bookings/appointmentAvailability";
import { isBookingCancelled } from "@/src/lib/bookings";
import {
  CALENDAR_DAY_COLUMN_HEIGHT_PX,
  CALENDAR_GRID_PX_PER_HOUR,
  calendarNavigationHelpers,
  layoutBookingUtcDayColumn,
  utcHourSlotIsoRange,
  type CalendarDayLane,
} from "@/src/lib/bookings/calendarView";
import type { CalendarHrefQuery } from "@/src/lib/bookings/calendarQuery";
import { mergeCalendarHrefQuery } from "@/src/lib/bookings/calendarQuery";
import { formatTimeRangeInTimezone } from "@/src/lib/calendar/calendarTimezone";
import type { FiBookingRow } from "@/src/lib/bookings/types";
import type { CrmShellUserPickerOption } from "@/src/lib/crm/types";
import { BOOKING_TYPES } from "@/src/lib/bookings/bookingPolicy";
import { serviceForBookingType } from "@/src/lib/bookings/servicesCatalog";
import type { FiServiceRow } from "@/src/lib/services/fiServiceTypes";
import { useAppointmentSlideOver } from "./AppointmentSlideOver";

const HOURS = Array.from({ length: 24 }, (_, i) => i);

function assigneeLabel(options: CrmShellUserPickerOption[], id: string | null): string {
  if (!id) return "Unassigned";
  const o = options.find((x) => x.id === id);
  return o?.email?.trim() || o?.id.slice(0, 8) || id.slice(0, 8);
}

function DraggableCalendarEvent({
  booking,
  lane,
  layout,
  assignees,
  services,
  canDrag,
  allBookings,
  tenantId,
  onSelect,
  onRescheduled,
  onConflict,
}: {
  booking: FiBookingRow;
  lane: CalendarDayLane;
  layout: { topPx: number; heightPx: number };
  assignees: CrmShellUserPickerOption[];
  services: FiServiceRow[];
  canDrag: boolean;
  allBookings: FiBookingRow[];
  tenantId: string;
  onSelect: () => void;
  onRescheduled: (updated: FiBookingRow) => void;
  onConflict: (msg: string) => void;
}) {
  const [dragTop, setDragTop] = useState<number | null>(null);
  const [dragging, setDragging] = useState(false);
  const startTopRef = useRef(layout.topPx);

  const topPx = dragTop ?? layout.topPx;
  const svc = serviceForBookingType(services, booking.booking_type);
  const chip = bookingCalendarChipSurface(booking.booking_type, svc?.color);
  const statusRing = bookingStatusCalendarAccent(booking.booking_status);
  const range = formatTimeRangeInTimezone(booking.start_at, booking.end_at, lane.timeZone);

  const terminal = isBookingCancelled(booking) || booking.booking_status === "completed";

  function onPointerDown(e: React.PointerEvent) {
    if (!canDrag || terminal) return;
    if (e.button !== 0) return;
    e.preventDefault();
    e.stopPropagation();
    (e.target as HTMLElement).setPointerCapture(e.pointerId);
    setDragging(true);
    startTopRef.current = dragTop ?? layout.topPx;
    const startY = e.clientY;

    function onMove(ev: PointerEvent) {
      const delta = ev.clientY - startY;
      const next = Math.max(
        0,
        Math.min(CALENDAR_DAY_COLUMN_HEIGHT_PX - layout.heightPx, startTopRef.current + delta)
      );
      setDragTop(next);
    }

    async function onUp(ev: PointerEvent) {
      (e.target as HTMLElement).releasePointerCapture(e.pointerId);
      window.removeEventListener("pointermove", onMove);
      window.removeEventListener("pointerup", onUp);
      setDragging(false);
      const delta = ev.clientY - startY;
      const finalTop = Math.max(
        0,
        Math.min(CALENDAR_DAY_COLUMN_HEIGHT_PX - layout.heightPx, startTopRef.current + delta)
      );
      setDragTop(null);
      const minsFromMidnight = (finalTop / CALENDAR_GRID_PX_PER_HOUR) * 60;
      const newStartMs = lane.startMs + minsFromMidnight * 60_000;
      const durationMs = Date.parse(booking.end_at) - Date.parse(booking.start_at);
      const newStartIso = new Date(newStartMs).toISOString();
      const newEndIso = new Date(newStartMs + durationMs).toISOString();

      const staffId = booking.assigned_staff_id?.trim() || null;
      const avail = checkAppointmentAvailability({
        candidateStartIso: newStartIso,
        candidateEndIso: newEndIso,
        candidateStaffId: staffId,
        candidateUserId: staffId ? null : booking.assigned_user_id?.trim() || null,
        existing: allBookings,
        staffIdToUserId: new Map(),
        excludeBookingId: booking.id,
        bufferMinutes: DEFAULT_APPOINTMENT_BUFFER_MINUTES,
      });
      if (!avail.ok) {
        onConflict(avail.message);
        return;
      }

      const snap = booking;
      const optimistic = { ...booking, start_at: newStartIso, end_at: newEndIso };
      onRescheduled(optimistic);
      const r = await updateBookingAction(tenantId, booking.id, {
        leadId: booking.lead_id,
        personId: booking.person_id,
        patientId: booking.patient_id,
        caseId: booking.case_id,
        clinicId: booking.clinic_id,
        assignedUserId: booking.assigned_user_id,
        startAt: newStartIso,
        endAt: newEndIso,
        metadata: booking.metadata ?? {},
      });
      if (!r.ok) {
        onRescheduled(snap);
        onConflict(r.error);
      } else {
        onRescheduled(r.booking);
      }
    }

    window.addEventListener("pointermove", onMove);
    window.addEventListener("pointerup", onUp);
  }

  return (
    <button
      type="button"
      onClick={onSelect}
      onPointerDown={onPointerDown}
      className={cn(
        "absolute left-1 right-1 z-[1] overflow-hidden rounded border px-1.5 py-1 text-left text-xs shadow-sm transition hover:z-[2] hover:brightness-110",
        chip.toneClasses,
        statusRing,
        dragging && "z-[5] ring-2 ring-primary opacity-90",
        canDrag && !terminal && "cursor-grab active:cursor-grabbing"
      )}
      style={{ top: topPx, height: layout.heightPx, ...(chip.chipStyle ?? {}) }}
      title={canDrag && !terminal ? "Drag to reschedule (UTC)" : undefined}
    >
      <div className="truncate font-medium leading-tight">
        {booking.title?.trim() || "Appointment"}
      </div>
      <div className="mt-0.5 flex flex-wrap items-center gap-1">
        <span className="truncate text-[10px] font-medium uppercase tracking-wide opacity-90">
          {svc?.name?.trim() || bookingTypeCalendarLegendLabel(booking.booking_type)}
        </span>
        <BookingStatusBadge status={booking.booking_status} />
      </div>
      <div className="mt-0.5 truncate text-[10px] opacity-90">{range}</div>
      <div className="truncate text-[10px] opacity-90">
        {assigneeLabel(assignees, booking.assigned_user_id)}
      </div>
    </button>
  );
}

export function AppointmentCalendar({ data }: { data: CalendarViewData }) {
  const router = useRouter();
  const slide = useAppointmentSlideOver();
  const [showFilters, setShowFilters] = useState(false);
  const [localBookings, setLocalBookings] = useState(data.bookings);
  const [conflictMsg, setConflictMsg] = useState<string | null>(null);

  useEffect(() => {
    setLocalBookings(data.bookings);
  }, [data.bookings]);

  const { tenantId, query, lanes, assignees, listTruncated, rangeTitle, services } = data;
  const catalog = services ?? [];

  const buckets = useMemo(() => {
    const map: Record<string, FiBookingRow[]> = {};
    for (const lane of lanes) map[lane.dayKey] = [];
    for (const b of localBookings) {
      const s = Date.parse(b.start_at);
      const e = Date.parse(b.end_at);
      if (!Number.isFinite(s) || !Number.isFinite(e)) continue;
      for (const lane of lanes) {
        if (s < lane.endMs && e > lane.startMs) {
          map[lane.dayKey]?.push(b);
        }
      }
    }
    for (const lane of lanes) {
      const arr = map[lane.dayKey];
      if (arr) arr.sort((a, b) => Date.parse(a.start_at) - Date.parse(b.start_at));
    }
    return map;
  }, [localBookings, lanes]);

  const refresh = useCallback(() => router.refresh(), [router]);

  function calendarPeriodHref(patch: CalendarHrefQuery): string {
    const merged = mergeCalendarHrefQuery(query, patch);
    return buildAppointmentsHref(tenantId, {
      tab: "calendar",
      view: merged.view,
      date: merged.date,
      status: merged.status ?? undefined,
      type: merged.type ?? undefined,
      assignedStaffId: merged.staffId ?? undefined,
      assignedUserId: merged.assignedUserId ?? undefined,
      clinicId: merged.clinicId ?? undefined,
      includeCancelled: merged.includeCancelled,
    });
  }

  const prev = calendarPeriodHref(calendarNavigationHelpers.previousPeriod(query));
  const next = calendarPeriodHref(calendarNavigationHelpers.nextPeriod(query));
  const todayHref = buildAppointmentsHref(tenantId, {
    tab: "calendar",
    date: calendarNavigationHelpers.goToToday().date,
    view: query.view,
    assignedStaffId: query.staffId ?? undefined,
    assignedUserId: query.assignedUserId ?? undefined,
    type: query.bookingType ?? undefined,
    status: query.status ?? undefined,
    clinicId: query.clinicId ?? undefined,
    includeCancelled: query.includeCancelled,
  });

  function patchRescheduled(updated: FiBookingRow) {
    setLocalBookings((rows) => rows.map((b) => (b.id === updated.id ? updated : b)));
  }

  function openCreateFromSlot(dayKey: string, hour: number) {
    const slot = utcHourSlotIsoRange(dayKey, hour);
    if (!slot) return;
    slide.openCreateAppointment({
      startIso: slot.startIso,
      endIso: slot.endIso,
      assignedUserId: query.assignedUserId,
      bookingType: query.bookingType ?? "consultation",
    });
  }

  return (
    <div className="space-y-4">
      {listTruncated ? (
        <p className="text-xs text-amber-300">
          Calendar row cap reached — narrow filters or date range.
        </p>
      ) : null}
      {conflictMsg ? (
        <div
          className="rounded border border-amber-400/20 bg-amber-400/10 px-3 py-2 text-xs text-amber-200"
          role="alert"
        >
          {conflictMsg}
          <button type="button" className="ml-2 underline" onClick={() => setConflictMsg(null)}>
            Dismiss
          </button>
        </div>
      ) : null}

      <div className="flex flex-col gap-3 rounded border border-white/[0.08] bg-white/[0.03] p-3 sm:flex-row sm:flex-wrap sm:items-center sm:justify-between">
        <div className="flex flex-wrap items-center gap-2">
          <Link
            href={prev}
            className="rounded border border-slate-700 bg-[#020617] text-slate-100 placeholder:text-slate-500 px-2 py-1 text-sm hover:bg-white/[0.06]"
          >
            Previous
          </Link>
          <Link
            href={todayHref}
            className="rounded border border-slate-700 bg-[#020617] text-slate-100 placeholder:text-slate-500 px-2 py-1 text-sm hover:bg-white/[0.06]"
          >
            Today
          </Link>
          <Link
            href={next}
            className="rounded border border-slate-700 bg-[#020617] text-slate-100 placeholder:text-slate-500 px-2 py-1 text-sm hover:bg-white/[0.06]"
          >
            Next
          </Link>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <Link
            href={buildAppointmentsHref(tenantId, {
              tab: "calendar",
              view: "day",
              date: query.dateAnchor,
            })}
            className={`rounded px-2 py-1 text-sm ${query.view === "day" ? "bg-gray-900 text-white" : "border border-slate-700 bg-[#020617] text-slate-100 placeholder:text-slate-500"}`}
          >
            Day
          </Link>
          <Link
            href={buildAppointmentsHref(tenantId, {
              tab: "calendar",
              view: "week",
              date: query.dateAnchor,
            })}
            className={`rounded px-2 py-1 text-sm ${query.view === "week" ? "bg-gray-900 text-white" : "border border-slate-700 bg-[#020617] text-slate-100 placeholder:text-slate-500"}`}
          >
            Week
          </Link>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <button
            type="button"
            onClick={() => setShowFilters((v) => !v)}
            className={`rounded px-2 py-1 text-sm ${showFilters ? "bg-gray-900 text-white" : "border border-slate-700 bg-[#020617] text-slate-100 placeholder:text-slate-500"}`}
          >
            Filters
          </button>
          <button
            type="button"
            className="rounded bg-gray-900 px-3 py-1 text-sm font-medium text-white hover:bg-gray-800"
            onClick={() => slide.openCreateAppointment({ assignedUserId: query.assignedUserId })}
          >
            New appointment
          </button>
        </div>
        <p className="w-full text-center text-sm text-slate-300 sm:text-right">
          {rangeTitle} · drag to reschedule
        </p>
      </div>

      {showFilters ? (
        <p className="text-xs text-slate-400">
          Use the shared filters panel above the tabs for staff, type, and status.
        </p>
      ) : null}

      <div className="flex flex-wrap gap-2 text-[10px] text-slate-400">
        {BOOKING_TYPES.map((t) => {
          const row = serviceForBookingType(catalog, t);
          const chip = bookingCalendarChipSurface(t, row?.color);
          const label = row?.name?.trim() || bookingTypeCalendarLegendLabel(t);
          return (
            <span
              key={t}
              className={cn("rounded border px-1.5 py-0.5", chip.toneClasses)}
              style={chip.chipStyle}
            >
              {label}
            </span>
          );
        })}
      </div>

      <div className="flex w-full overflow-x-auto rounded border border-white/[0.08] bg-[#0F1629]/80 backdrop-blur-md">
        <div
          className="sticky left-0 z-10 w-12 shrink-0 border-r border-white/[0.08] bg-white/[0.03] text-[10px] text-gray-500"
          style={{ paddingTop: 48 }}
        >
          {HOURS.map((h) => (
            <div
              key={h}
              className="border-t border-white/[0.06] pr-1 text-right"
              style={{ height: CALENDAR_GRID_PX_PER_HOUR }}
            >
              {String(h).padStart(2, "0")}:00
            </div>
          ))}
        </div>
        <div className="flex min-w-[640px] flex-1">
          {lanes.map((lane) => {
            const events = buckets[lane.dayKey] ?? [];
            return (
              <div key={lane.dayKey} className="min-w-0 flex-1 border-l border-white/[0.08]">
                <div className="sticky top-0 z-[3] border-b border-white/[0.08] bg-white/[0.03] px-1 py-2 text-center text-[11px] font-medium">
                  <div>{calendarDayHeading(lane)}</div>
                  <div className="text-[10px] font-normal text-gray-500">UTC</div>
                </div>
                <div className="relative" style={{ height: CALENDAR_DAY_COLUMN_HEIGHT_PX }}>
                  {HOURS.map((h) => (
                    <button
                      key={h}
                      type="button"
                      aria-label={`New appointment ${lane.dayKey} ${h}:00`}
                      className="absolute left-0 right-0 border-t border-white/[0.06] hover:bg-primary/5"
                      style={{
                        top: h * CALENDAR_GRID_PX_PER_HOUR,
                        height: CALENDAR_GRID_PX_PER_HOUR,
                      }}
                      onClick={() => openCreateFromSlot(lane.dayKey, h)}
                    />
                  ))}
                  {events.map((b) => {
                    const layout = layoutBookingUtcDayColumn(b, lane);
                    if (!layout) return null;
                    return (
                      <DraggableCalendarEvent
                        key={b.id}
                        booking={b}
                        lane={lane}
                        layout={layout}
                        assignees={assignees}
                        services={catalog}
                        canDrag
                        allBookings={localBookings}
                        tenantId={tenantId}
                        onSelect={() => slide.openAppointment(b.id)}
                        onRescheduled={patchRescheduled}
                        onConflict={(msg) => {
                          setConflictMsg(msg);
                          refresh();
                        }}
                      />
                    );
                  })}
                </div>
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}
