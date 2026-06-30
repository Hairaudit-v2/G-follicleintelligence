"use client";

import Link from "next/link";
import {
  buildCalendarHref,
  mergeCalendarHrefQuery,
  type ParsedCalendarQuery,
} from "@/src/lib/bookings/calendarQuery";
import { calendarNavigationHelpers } from "@/src/lib/bookings/calendarView";

export function BookingCalendarToolbar({
  tenantId,
  query,
  rangeTitle,
  showFilters,
  onToggleFilters,
  onQuickCreate,
}: {
  tenantId: string;
  query: ParsedCalendarQuery;
  rangeTitle: string;
  showFilters: boolean;
  onToggleFilters: () => void;
  onQuickCreate: () => void;
}) {
  const prev = buildCalendarHref(tenantId, calendarNavigationHelpers.previousPeriod(query));
  const next = buildCalendarHref(tenantId, calendarNavigationHelpers.nextPeriod(query));
  const today = buildCalendarHref(
    tenantId,
    mergeCalendarHrefQuery(query, calendarNavigationHelpers.goToToday())
  );

  const dayHref = buildCalendarHref(tenantId, mergeCalendarHrefQuery(query, { view: "day" }));
  const weekHref = buildCalendarHref(tenantId, mergeCalendarHrefQuery(query, { view: "week" }));

  return (
    <div className="flex flex-col gap-3 rounded border border-white/[0.08] bg-white/[0.03] p-3 sm:flex-row sm:flex-wrap sm:items-center sm:justify-between">
      <div className="flex flex-wrap items-center gap-2">
        <Link
          href={prev}
          className="rounded border border-slate-700 bg-[#020617] text-slate-100 placeholder:text-slate-500 px-2 py-1 text-sm text-slate-200 hover:bg-white/[0.06]"
        >
          Previous
        </Link>
        <Link
          href={today}
          className="rounded border border-slate-700 bg-[#020617] text-slate-100 placeholder:text-slate-500 px-2 py-1 text-sm text-slate-200 hover:bg-white/[0.06]"
        >
          Today
        </Link>
        <Link
          href={next}
          className="rounded border border-slate-700 bg-[#020617] text-slate-100 placeholder:text-slate-500 px-2 py-1 text-sm text-slate-200 hover:bg-white/[0.06]"
        >
          Next
        </Link>
      </div>

      <div className="flex flex-wrap items-center gap-2">
        <span className="text-sm font-medium text-slate-100">View</span>
        <Link
          href={dayHref}
          className={`rounded px-2 py-1 text-sm ${
            query.view === "day"
              ? "bg-gray-900 text-white"
              : "border border-slate-700 bg-[#020617] text-slate-100 placeholder:text-slate-500 text-slate-200 hover:bg-white/[0.06]"
          }`}
        >
          Day
        </Link>
        <Link
          href={weekHref}
          className={`rounded px-2 py-1 text-sm ${
            query.view === "week"
              ? "bg-gray-900 text-white"
              : "border border-slate-700 bg-[#020617] text-slate-100 placeholder:text-slate-500 text-slate-200 hover:bg-white/[0.06]"
          }`}
        >
          Week
        </Link>
      </div>

      <div className="flex flex-wrap items-center gap-2">
        <button
          type="button"
          onClick={onToggleFilters}
          className={`rounded px-2 py-1 text-sm ${
            showFilters
              ? "bg-gray-900 text-white"
              : "border border-slate-700 bg-[#020617] text-slate-100 placeholder:text-slate-500 text-slate-200 hover:bg-white/[0.06]"
          }`}
        >
          Filters
        </button>
        <button
          type="button"
          onClick={onQuickCreate}
          className="rounded bg-gray-900 px-3 py-1 text-sm font-medium text-white hover:bg-gray-800"
        >
          Create booking
        </button>
      </div>

      <p className="w-full text-center text-sm text-slate-300 sm:w-auto sm:text-right">
        {rangeTitle}
      </p>
    </div>
  );
}
