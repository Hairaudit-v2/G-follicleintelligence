"use client";

import type { CalendarOsDisplayDensity } from "@/src/lib/calendar-os/calendarDisplayDensity";
import { CALENDAR_OS_DISPLAY_DENSITIES } from "@/src/lib/calendar-os/calendarDisplayDensity";
import { cn } from "@/lib/utils";

const DENSITY_LABELS: Record<CalendarOsDisplayDensity, string> = {
  comfortable: "Comfortable",
  compact: "Compact",
  command: "Command",
};

export type CalendarOsDensityToggleProps = {
  density: CalendarOsDisplayDensity;
  onDensityChange: (density: CalendarOsDisplayDensity) => void;
  className?: string;
};

export function CalendarOsDensityToggle({
  density,
  onDensityChange,
  className,
}: CalendarOsDensityToggleProps) {
  return (
    <div className={cn("flex items-center gap-1", className)}>
      <span className="mr-1 text-[10px] font-semibold uppercase tracking-wider text-slate-500">
        Density
      </span>
      {CALENDAR_OS_DISPLAY_DENSITIES.map((d) => (
        <button
          key={d}
          type="button"
          onClick={() => onDensityChange(d)}
          className={cn(
            "rounded border px-2 py-0.5 text-[10px] font-medium transition-colors",
            density === d
              ? "border-violet-500/40 bg-violet-500/15 text-violet-100"
              : "border-white/[0.08] bg-white/[0.03] text-slate-400 hover:border-white/15 hover:text-slate-200"
          )}
          aria-pressed={density === d}
        >
          {DENSITY_LABELS[d]}
        </button>
      ))}
    </div>
  );
}
