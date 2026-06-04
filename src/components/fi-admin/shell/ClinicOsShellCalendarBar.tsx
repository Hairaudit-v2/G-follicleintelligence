"use client";

import { useMemo, useState } from "react";
import { ChevronDown, ChevronLeft, ChevronRight } from "lucide-react";

import { cn } from "@/lib/utils";

type ViewMode = "Day" | "Week" | "Month";

function formatCalendarBarDate(d: Date): string {
  return new Intl.DateTimeFormat(undefined, {
    weekday: "short",
    month: "short",
    day: "numeric",
    year: "numeric",
  }).format(d);
}

/**
 * UI-only Timely-style context strip for Calendar routes. No calendar data or navigation logic.
 */
export function ClinicOsShellCalendarBar({ clinicLabel }: { clinicLabel: string }) {
  const [viewMode, setViewMode] = useState<ViewMode>("Week");
  const dateLabel = useMemo(() => formatCalendarBarDate(new Date()), []);

  return (
    <div className="border-b border-slate-200/90 bg-slate-50/80">
      <div className="mx-auto flex max-w-[1600px] flex-wrap items-center gap-2 px-3 py-2 sm:gap-3 sm:px-4 lg:px-6">
        <button
          type="button"
          className="inline-flex h-8 max-w-[200px] shrink-0 items-center gap-1 rounded-md border border-slate-200 bg-white px-2.5 text-left text-xs font-medium text-slate-700 shadow-sm sm:max-w-[240px] sm:text-sm"
          aria-disabled={true}
          title="Clinic selector (coming soon)"
        >
          <span className="truncate">{clinicLabel}</span>
          <ChevronDown className="h-3.5 w-3.5 shrink-0 text-slate-400" aria-hidden />
        </button>

        <div className="hidden h-5 w-px bg-slate-200 sm:block" aria-hidden />

        <button
          type="button"
          className="h-8 shrink-0 rounded-md border border-slate-200 bg-white px-2.5 text-xs font-medium text-slate-600 shadow-sm sm:text-sm"
          aria-disabled={true}
          title="Staff filter (coming soon)"
        >
          All staff
        </button>

        <div className="hidden h-5 w-px bg-slate-200 sm:block" aria-hidden />

        <div className="flex min-w-0 flex-1 flex-wrap items-center gap-1.5 sm:flex-initial">
          <button
            type="button"
            className="h-8 shrink-0 rounded-md border border-slate-200 bg-white px-2 text-xs font-medium text-slate-700 shadow-sm sm:text-sm"
            aria-disabled={true}
            title="Date picker (coming soon)"
          >
            Today
          </button>
          <button
            type="button"
            className="inline-flex h-8 w-8 shrink-0 items-center justify-center rounded-md border border-slate-200 bg-white text-slate-600 shadow-sm"
            aria-label="Previous day (coming soon)"
            title="Previous (coming soon)"
          >
            <ChevronLeft className="h-4 w-4" aria-hidden />
          </button>
          <span className="min-w-0 truncate rounded-md border border-transparent px-2 py-1 text-center text-xs font-medium text-slate-800 sm:text-sm">
            {dateLabel}
          </span>
          <button
            type="button"
            className="inline-flex h-8 w-8 shrink-0 items-center justify-center rounded-md border border-slate-200 bg-white text-slate-600 shadow-sm"
            aria-label="Next day (coming soon)"
            title="Next (coming soon)"
          >
            <ChevronRight className="h-4 w-4" aria-hidden />
          </button>
        </div>

        <div className="ml-auto flex shrink-0 rounded-md border border-slate-200 bg-white p-0.5 shadow-sm">
          {(["Day", "Week", "Month"] as const).map((label) => (
            <button
              key={label}
              type="button"
              onClick={() => setViewMode(label)}
              className={cn(
                "rounded px-2 py-1 text-xs font-medium transition sm:px-2.5 sm:text-sm",
                viewMode === label ? "bg-slate-100 text-slate-900 shadow-sm" : "text-slate-500 hover:text-slate-800"
              )}
              title="View mode (preview only)"
            >
              {label}
            </button>
          ))}
        </div>
      </div>
    </div>
  );
}
