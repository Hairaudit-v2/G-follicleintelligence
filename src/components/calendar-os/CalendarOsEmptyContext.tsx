"use client";

import { CalendarPlus, Users } from "lucide-react";

import type { CalendarOsSparseContext } from "@/src/lib/calendar-os/calendarSparseContext";
import { cn } from "@/lib/utils";

export type CalendarOsEmptyContextProps = {
  context: CalendarOsSparseContext;
  variant: "week-cell" | "week-banner" | "day-column";
  className?: string;
};

export function CalendarOsEmptyContext({
  context,
  variant,
  className,
}: CalendarOsEmptyContextProps) {
  if (variant === "week-cell") {
    return (
      <div
        className={cn(
          "flex h-full min-h-[24px] items-center justify-center rounded border border-dashed border-white/[0.04] text-[9px] text-slate-600",
          className
        )}
        aria-hidden
      >
        —
      </div>
    );
  }

  if (variant === "day-column") {
    return (
      <div
        className={cn(
          "pointer-events-none absolute inset-x-1 top-2 rounded border border-dashed border-white/[0.05] bg-white/[0.01] px-2 py-3 text-center",
          className
        )}
      >
        <p className="text-[10px] font-medium text-slate-500">Open</p>
        <p className="mt-0.5 text-[9px] text-slate-600">No bookings</p>
      </div>
    );
  }

  return (
    <div
      className={cn(
        "mx-3 mb-2 rounded-lg border border-white/[0.06] bg-white/[0.02] px-3 py-2.5",
        className
      )}
    >
      <div className="flex flex-wrap items-start justify-between gap-2">
        <div>
          <p className="text-xs font-medium text-slate-300">
            {context.totalBookings === 0 ? "Light schedule" : `${context.totalBookings} bookings`}
          </p>
          <p className="mt-0.5 text-[10px] text-slate-500">
            {context.availableStaffCount} staff · {context.openRoomsCount} rooms open
          </p>
        </div>
        <div className="flex items-center gap-3 text-[10px] text-slate-400">
          <span className="inline-flex items-center gap-1">
            <Users className="h-3 w-3" aria-hidden />
            {context.availableStaffNames.slice(0, 2).join(", ") || "—"}
          </span>
        </div>
      </div>
      <ul className="mt-2 space-y-0.5">
        {context.suggestedActions.map((action) => (
          <li key={action} className="flex items-center gap-1.5 text-[10px] text-cyan-200/70">
            <CalendarPlus className="h-3 w-3 shrink-0" aria-hidden />
            {action}
          </li>
        ))}
      </ul>
    </div>
  );
}
