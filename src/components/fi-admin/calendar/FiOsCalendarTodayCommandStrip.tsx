"use client";

import { ChevronDown } from "lucide-react";
import { useMemo, useState } from "react";

import { CalendarTransitionLink } from "@/components/calendar/CalendarTransitionLink";
import { cn } from "@/lib/utils";
import {
  buildCalendarHref,
  mergeCalendarHrefQuery,
  type CalendarRoute,
  type ParsedCalendarQuery,
} from "@/src/lib/bookings/calendarQuery";
import { calendarDateStringFromInstant } from "@/src/lib/calendar/calendarTimezone";
import type { CalendarDayLane } from "@/src/lib/bookings/calendarView";
import type { FiBookingRow } from "@/src/lib/bookings/types";
import { bookingsOverlappingDayKey, computeFiOsTodayStripCounts } from "@/src/lib/calendar/fiOsCalendarTodayStrip";
import { calendarBookingsHydrationFingerprint } from "@/src/lib/calendar/calendarHydrationFingerprint";

function chipClass(active: boolean): string {
  return cn(
    "inline-flex shrink-0 items-center gap-1 rounded-md border px-1.5 py-0.5 text-[11px] font-medium tabular-nums transition",
    active
      ? "border-cyan-400/45 bg-cyan-500/15 text-cyan-50"
      : "border-white/[0.08] bg-white/[0.03] text-slate-300 hover:border-cyan-500/25 hover:text-white"
  );
}

export function FiOsCalendarTodayCommandStrip({
  tenantId,
  query,
  bookings,
  lanes,
  route = "fi-admin",
}: {
  tenantId: string;
  query: ParsedCalendarQuery;
  bookings: FiBookingRow[];
  lanes: CalendarDayLane[];
  route?: CalendarRoute;
}) {
  const [mobileOpen, setMobileOpen] = useState(false);
  const hrefOpts = { route };
  const tz = query.calendarTimezone;
  const todayYmd = calendarDateStringFromInstant(new Date(), tz);

  const bookingsStripKey = useMemo(() => calendarBookingsHydrationFingerprint(bookings), [bookings]);
  const dayRows = useMemo(
    () => bookingsOverlappingDayKey(bookings, lanes, query.dateAnchor),
    // bookingsStripKey captures visible booking payload; avoids recomputing overlaps when RSC re-sends the same rows with a new array identity.
    [bookingsStripKey, lanes, query.dateAnchor]
  );
  const counts = useMemo(() => computeFiOsTodayStripCounts(dayRows), [dayRows]);

  const noStaffFilter = !query.staffId?.trim() && !query.staffRoleBucket && !query.assignedUserId?.trim();
  const noTypeStatusWaitUn =
    !query.bookingType?.trim() && !query.status?.trim() && !query.waitingOnly && !query.unassignedOnly;
  const todayOverviewActive =
    query.view === "day" &&
    query.dateAnchor.trim() === todayYmd &&
    noTypeStatusWaitUn &&
    noStaffFilter;

  function typeHref(t: string, active: boolean): string {
    return buildCalendarHref(tenantId, mergeCalendarHrefQuery(query, { type: active ? null : t }), hrefOpts);
  }

  function statusHref(s: string, active: boolean): string {
    return buildCalendarHref(
      tenantId,
      mergeCalendarHrefQuery(query, { status: active ? null : s, waiting: false }),
      hrefOpts
    );
  }

  function waitingHref(active: boolean): string {
    return buildCalendarHref(
      tenantId,
      mergeCalendarHrefQuery(query, {
        waiting: active ? false : true,
        status: null,
      }),
      hrefOpts
    );
  }

  function unassignedHref(active: boolean): string {
    return buildCalendarHref(
      tenantId,
      mergeCalendarHrefQuery(query, {
        unassigned: active ? false : true,
        staffId: null,
        role: null,
        assignedUserId: null,
      }),
      hrefOpts
    );
  }

  const todayOverviewHref = buildCalendarHref(
    tenantId,
    mergeCalendarHrefQuery(query, {
      view: "day",
      date: todayYmd,
      type: null,
      status: null,
      staffId: null,
      role: null,
      waiting: false,
      unassigned: false,
      assignedUserId: null,
    }),
    hrefOpts
  );

  const cConsult = query.bookingType?.trim() === "consultation";
  const cPrp = query.bookingType?.trim() === "prp";
  const cSurg = query.bookingType?.trim() === "surgery";
  const cArrived = query.status?.trim() === "arrived";
  const cCompleted = query.status?.trim() === "completed";
  const cWaiting = query.waitingOnly;
  const cUnassigned = query.unassignedOnly;

  const chipRow = (
    <div className="flex max-w-full items-center gap-2 overflow-x-auto whitespace-nowrap [scrollbar-width:thin]">
      <CalendarTransitionLink
        href={todayOverviewHref}
        className={chipClass(todayOverviewActive)}
        title="Day view for clinic today · clear type, status, staff, and strip filters"
      >
        <span className="text-slate-400">Appointments today</span>
        <span className="text-slate-100">{counts.all}</span>
      </CalendarTransitionLink>
      <CalendarTransitionLink href={typeHref("consultation", cConsult)} className={chipClass(cConsult)} title="Toggle consultation filter">
        <span className="text-slate-400">Consultations</span>
        <span className="text-slate-100">{counts.consultation}</span>
      </CalendarTransitionLink>
      <CalendarTransitionLink href={typeHref("prp", cPrp)} className={chipClass(cPrp)} title="Toggle PRP filter">
        <span className="text-slate-400">PRP</span>
        <span className="text-slate-100">{counts.prp}</span>
      </CalendarTransitionLink>
      <CalendarTransitionLink href={typeHref("surgery", cSurg)} className={chipClass(cSurg)} title="Toggle surgery filter">
        <span className="text-slate-400">Surgeries</span>
        <span className="text-slate-100">{counts.surgery}</span>
      </CalendarTransitionLink>
      {route === "fi-admin" ? (
        <CalendarTransitionLink
          href={`/fi-admin/${tenantId}/surgery-readiness`}
          className={chipClass(false)}
          title="Surgery readiness board — next 14 days"
        >
          <span className="text-slate-400">Readiness</span>
        </CalendarTransitionLink>
      ) : null}
      <CalendarTransitionLink href={statusHref("arrived", cArrived)} className={chipClass(cArrived)} title="Toggle arrived status">
        <span className="text-slate-400">Arrived</span>
        <span className="text-slate-100">{counts.arrived}</span>
      </CalendarTransitionLink>
      <CalendarTransitionLink href={waitingHref(cWaiting)} className={chipClass(cWaiting)} title="Scheduled or confirmed (waiting)">
        <span className="text-slate-400">Waiting</span>
        <span className="text-slate-100">{counts.waiting}</span>
      </CalendarTransitionLink>
      <CalendarTransitionLink href={statusHref("completed", cCompleted)} className={chipClass(cCompleted)} title="Toggle completed status">
        <span className="text-slate-400">Completed</span>
        <span className="text-slate-100">{counts.completed}</span>
      </CalendarTransitionLink>
      <CalendarTransitionLink href={unassignedHref(cUnassigned)} className={chipClass(cUnassigned)} title="No staff or user assignee">
        <span className="text-slate-400">Unassigned</span>
        <span className="text-slate-100">{counts.unassigned}</span>
      </CalendarTransitionLink>
    </div>
  );

  return (
    <div className="border-b border-white/[0.06] bg-[#050c16]/90 backdrop-blur-md">
      <div className="md:hidden">
        <button
          type="button"
          className="flex w-full items-center justify-between gap-2 px-3 py-2 text-left text-xs text-slate-300"
          onClick={() => setMobileOpen((v) => !v)}
          aria-expanded={mobileOpen}
        >
          <span className="font-medium text-slate-200">Today · {counts.all} appointments</span>
          <ChevronDown className={cn("h-4 w-4 shrink-0 text-slate-500 transition", mobileOpen && "rotate-180")} aria-hidden />
        </button>
        {mobileOpen ? <div className="border-t border-white/[0.05] px-3 pb-2 pt-1">{chipRow}</div> : null}
      </div>
      <div className="hidden min-h-[2.25rem] px-3 py-1.5 md:block">{chipRow}</div>
    </div>
  );
}
