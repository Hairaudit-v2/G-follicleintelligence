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
  compact?: boolean;
  className?: string;
};

export function CalendarOsPresetBar({
  tenantId,
  query,
  route = "fi-admin",
  compact = false,
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
    <div className={cn("flex flex-wrap items-center gap-0.5", className)}>
      {!compact ? (
        <span className="mr-1 text-[10px] font-semibold uppercase tracking-wider text-slate-500">
          Presets
        </span>
      ) : null}
      {CALENDAR_OS_VIEW_PRESETS.map((preset) => {
        const active = activeId === preset.id;
        return (
          <a
            key={preset.id}
            href={presetHref(preset.id)}
            title={preset.description}
            className={cn(
              "rounded border font-medium transition-colors",
              compact ? "px-1.5 py-0.5 text-[9px]" : "px-2 py-0.5 text-[10px]",
              active
                ? "border-emerald-500/35 bg-emerald-500/12 text-emerald-100"
                : "border-white/[0.06] bg-white/[0.02] text-slate-500 hover:border-white/12 hover:text-slate-300"
            )}
          >
            {preset.label}
          </a>
        );
      })}
    </div>
  );
}
