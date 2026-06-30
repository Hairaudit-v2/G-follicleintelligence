"use client";

import Link from "next/link";
import { ChevronLeft, ChevronRight, Filter } from "lucide-react";

import { buildCalendarHref, mergeCalendarHrefQuery, type ParsedCalendarQuery } from "@/src/lib/bookings/calendarQuery";
import { calendarNavigationHelpers } from "@/src/lib/bookings/calendarView";
import { cn } from "@/lib/utils";

export function OperationalCalendarToolbar({
  tenantId,
  query,
  rangeTitle,
  showFilters,
  onToggleFilters,
}: {
  tenantId: string;
  query: ParsedCalendarQuery;
  rangeTitle: string;
  showFilters: boolean;
  onToggleFilters: () => void;
}) {
  const prev = buildCalendarHref(tenantId, calendarNavigationHelpers.previousPeriod(query));
  const next = buildCalendarHref(tenantId, calendarNavigationHelpers.nextPeriod(query));
  const today = buildCalendarHref(tenantId, mergeCalendarHrefQuery(query, calendarNavigationHelpers.goToToday()));

  const dayHref = buildCalendarHref(tenantId, mergeCalendarHrefQuery(query, { view: "day" }));
  const weekHref = buildCalendarHref(tenantId, mergeCalendarHrefQuery(query, { view: "week" }));

  return (
    <div className="flex flex-col gap-3 rounded-xl border border-white/[0.08] bg-white/[0.03] p-3 dark:border-slate-800 dark:bg-slate-900/40 sm:flex-row sm:flex-wrap sm:items-center sm:justify-between">
      <div className="flex flex-wrap items-center gap-2">
        <Link
          href={prev}
          className="inline-flex items-center gap-1 rounded-lg border border-white/[0.08] bg-[#0F1629]/80 backdrop-blur-md px-2.5 py-1.5 text-sm font-medium text-slate-200 shadow-lg shadow-black/40 hover:bg-white/[0.03] dark:border-slate-700 dark:bg-slate-950 dark:text-slate-100 dark:hover:bg-slate-900"
        >
          <ChevronLeft className="h-4 w-4" aria-hidden />
          Prev
        </Link>
        <Link
          href={today}
          className="rounded-lg border border-white/[0.08] bg-[#0F1629]/80 backdrop-blur-md px-2.5 py-1.5 text-sm font-medium text-slate-200 shadow-lg shadow-black/40 hover:bg-white/[0.03] dark:border-slate-700 dark:bg-slate-950 dark:text-slate-100 dark:hover:bg-slate-900"
        >
          Today
        </Link>
        <Link
          href={next}
          className="inline-flex items-center gap-1 rounded-lg border border-white/[0.08] bg-[#0F1629]/80 backdrop-blur-md px-2.5 py-1.5 text-sm font-medium text-slate-200 shadow-lg shadow-black/40 hover:bg-white/[0.03] dark:border-slate-700 dark:bg-slate-950 dark:text-slate-100 dark:hover:bg-slate-900"
        >
          Next
          <ChevronRight className="h-4 w-4" aria-hidden />
        </Link>
      </div>

      <div className="flex flex-wrap items-center gap-2">
        <span className="text-xs font-semibold uppercase tracking-wide text-slate-500 dark:text-slate-400">View</span>
        <Link
          href={weekHref}
          className={cn(
            "rounded-lg px-2.5 py-1.5 text-sm font-medium",
            query.view === "week"
              ? "bg-sky-700 text-white shadow-sm dark:bg-sky-600"
              : "border border-white/[0.08] bg-[#0F1629]/80 backdrop-blur-md text-slate-200 hover:bg-white/[0.03] dark:border-slate-700 dark:bg-slate-950 dark:text-slate-100 dark:hover:bg-slate-900"
          )}
        >
          Week
        </Link>
        <Link
          href={dayHref}
          className={cn(
            "rounded-lg px-2.5 py-1.5 text-sm font-medium",
            query.view === "day"
              ? "bg-sky-700 text-white shadow-sm dark:bg-sky-600"
              : "border border-white/[0.08] bg-[#0F1629]/80 backdrop-blur-md text-slate-200 hover:bg-white/[0.03] dark:border-slate-700 dark:bg-slate-950 dark:text-slate-100 dark:hover:bg-slate-900"
          )}
        >
          Day
        </Link>
      </div>

      <div className="flex flex-wrap items-center gap-2">
        <button
          type="button"
          onClick={onToggleFilters}
          className={cn(
            "inline-flex items-center gap-1.5 rounded-lg px-2.5 py-1.5 text-sm font-medium",
            showFilters
              ? "bg-slate-900 text-white dark:bg-white/[0.06] dark:text-slate-100"
              : "border border-white/[0.08] bg-[#0F1629]/80 backdrop-blur-md text-slate-200 hover:bg-white/[0.03] dark:border-slate-700 dark:bg-slate-950 dark:text-slate-100 dark:hover:bg-slate-900"
          )}
        >
          <Filter className="h-4 w-4" aria-hidden />
          Filters
        </button>
      </div>

      <p className="w-full text-center text-sm font-medium text-slate-200 dark:text-slate-100 sm:w-auto sm:text-right">{rangeTitle}</p>
    </div>
  );
}
