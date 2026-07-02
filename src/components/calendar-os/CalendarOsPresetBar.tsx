"use client";

import {
  buildCalendarHref,
  mergeCalendarHrefQuery,
  type CalendarRoute,
  type ParsedCalendarQuery,
} from "@/src/lib/bookings/calendarQuery";
import {
  activeCalendarOsViewPresetId,
  CALENDAR_OS_VIEW_PRESETS,
  calendarOsPresetPatch,
  type CalendarOsViewPresetId,
} from "@/src/lib/calendar-os/calendarViewPresets";
import { cn } from "@/lib/utils";

export type CalendarOsPresetBarProps = {
  tenantId: string;
  query: ParsedCalendarQuery;
  route?: CalendarRoute;
  className?: string;
};

export function CalendarOsPresetBar({
  tenantId,
  query,
  route = "fi-admin",
  className,
}: CalendarOsPresetBarProps) {
  const activeId = activeCalendarOsViewPresetId(query);

  function presetHref(presetId: CalendarOsViewPresetId): string {
    return buildCalendarHref(
      tenantId,
      mergeCalendarHrefQuery(query, calendarOsPresetPatch(presetId)),
      { route }
    );
  }

  return (
    <div className={cn("flex flex-wrap items-center gap-1", className)}>
      <span className="mr-1 text-[10px] font-semibold uppercase tracking-wider text-slate-500">
        Presets
      </span>
      {CALENDAR_OS_VIEW_PRESETS.map((preset) => {
        const active = activeId === preset.id;
        return (
          <a
            key={preset.id}
            href={presetHref(preset.id)}
            title={preset.description}
            className={cn(
              "rounded border px-2 py-0.5 text-[10px] font-medium transition-colors",
              active
                ? "border-emerald-500/40 bg-emerald-500/15 text-emerald-100"
                : "border-white/[0.08] bg-white/[0.03] text-slate-400 hover:border-white/15 hover:text-slate-200"
            )}
          >
            {preset.label}
          </a>
        );
      })}
    </div>
  );
}
