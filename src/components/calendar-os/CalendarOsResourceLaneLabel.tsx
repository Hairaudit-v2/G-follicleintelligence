"use client";

import { AlertTriangle } from "lucide-react";

import type { CalendarOsDisplayDensity } from "@/src/lib/calendar-os/calendarDisplayDensity";
import { calendarOsDensityTokens } from "@/src/lib/calendar-os/calendarDisplayDensity";
import {
  staffInitialsFromLabel,
  type CalendarOsResourceRow,
} from "@/src/lib/calendar-os/calendarResourceModel";
import { cn } from "@/lib/utils";

const UTIL_COLOUR: Record<string, string> = {
  low: "bg-slate-500/50",
  moderate: "bg-cyan-500/60",
  high: "bg-amber-500/70",
  full: "bg-rose-500/80",
};

const STATUS_DOT: Record<string, string> = {
  available: "bg-emerald-400",
  unavailable: "bg-rose-400",
  inactive: "bg-slate-500",
  room: "bg-sky-400",
  unassigned: "bg-amber-400",
};

function workingStatus(row: CalendarOsResourceRow): keyof typeof STATUS_DOT {
  if (row.kind === "unassigned") return "unassigned";
  if (row.kind === "room") return "room";
  if (row.clinicallyAvailable === false) return "unavailable";
  if (row.readinessWarning?.toLowerCase().includes("inactive")) return "inactive";
  return "available";
}

export type CalendarOsResourceLaneLabelProps = {
  row: CalendarOsResourceRow;
  density?: CalendarOsDisplayDensity;
  sticky?: boolean;
  horizontal?: boolean;
  className?: string;
};

export function CalendarOsResourceLaneLabel({
  row,
  density = "comfortable",
  sticky = true,
  horizontal = false,
  className,
}: CalendarOsResourceLaneLabelProps) {
  const tokens = calendarOsDensityTokens(density);
  const status = workingStatus(row);
  const isUnassigned = row.kind === "unassigned";
  const minH = tokens.weekRowMinHeight;

  if (horizontal) {
    return (
      <div
        className={cn(
          "flex min-w-0 items-center gap-1.5 px-2",
          tokens.dayHeaderPy,
          isUnassigned && "bg-amber-500/[0.06]",
          className
        )}
      >
        <LaneAvatar row={row} size="sm" />
        <div className="min-w-0 flex-1">
          <div className="flex items-center gap-1">
            {tokens.showWorkingStatus ? (
              <span
                className={cn("h-1.5 w-1.5 shrink-0 rounded-full", STATUS_DOT[status])}
                aria-hidden
              />
            ) : null}
            <p
              className={cn(
                "truncate font-medium text-slate-200",
                density === "command" ? "text-[10px]" : "text-xs"
              )}
            >
              {row.label}
            </p>
          </div>
          {row.subtitle ? (
            <p className="truncate text-[9px] text-slate-500">{row.subtitle}</p>
          ) : null}
        </div>
        {tokens.showUtilisation && row.utilisation ? (
          <UtilBar util={row.utilisation} compact />
        ) : null}
      </div>
    );
  }

  return (
    <div
      className={cn(
        "flex flex-col justify-center border-r border-white/[0.08] bg-[#0a1220] px-2 py-1",
        sticky && "sticky left-0 z-[2]",
        isUnassigned && "border-amber-500/20 bg-amber-950/30",
        className
      )}
      style={{ minHeight: minH }}
    >
      <div className="flex items-center gap-1.5">
        <LaneAvatar row={row} size={density === "command" ? "xs" : "sm"} />
        <div className="min-w-0 flex-1">
          <div className="flex items-center gap-1">
            {tokens.showWorkingStatus ? (
              <span
                className={cn("h-1.5 w-1.5 shrink-0 rounded-full", STATUS_DOT[status])}
                title={status}
                aria-hidden
              />
            ) : null}
            <p
              className={cn(
                "truncate font-medium",
                isUnassigned ? "text-amber-100" : "text-slate-200",
                density === "command" ? "text-[10px]" : "text-xs"
              )}
            >
              {row.label}
            </p>
          </div>
          {row.subtitle ? (
            <p className="truncate text-[9px] text-slate-500">{row.subtitle}</p>
          ) : null}
        </div>
      </div>
      {tokens.showUtilisation && row.utilisation ? (
        <UtilBar util={row.utilisation} className="mt-1" />
      ) : null}
      {row.readinessWarning ? (
        <p className="mt-0.5 flex items-center gap-0.5 truncate text-[9px] text-amber-300">
          <AlertTriangle className="h-2.5 w-2.5 shrink-0" aria-hidden />
          {row.readinessWarning}
        </p>
      ) : null}
    </div>
  );
}

function LaneAvatar({ row, size }: { row: CalendarOsResourceRow; size: "xs" | "sm" }) {
  const dim = size === "xs" ? "h-5 w-5 text-[8px]" : "h-6 w-6 text-[9px]";
  const isUnassigned = row.kind === "unassigned";
  const isRoom = row.kind === "room";
  return (
    <div
      className={cn(
        "flex shrink-0 items-center justify-center rounded-full font-semibold ring-1",
        dim,
        isUnassigned
          ? "bg-amber-500/20 text-amber-200 ring-amber-500/30"
          : isRoom
            ? "bg-sky-500/15 text-sky-200 ring-sky-500/25"
            : "bg-white/[0.08] text-slate-300 ring-white/10"
      )}
      aria-hidden
    >
      {isUnassigned ? "!" : isRoom ? "R" : staffInitialsFromLabel(row.label)}
    </div>
  );
}

function UtilBar({
  util,
  compact,
  className,
}: {
  util: NonNullable<CalendarOsResourceRow["utilisation"]>;
  compact?: boolean;
  className?: string;
}) {
  return (
    <div className={cn("flex items-center gap-1", className)}>
      <div
        className={cn("h-1 flex-1 overflow-hidden rounded-full bg-white/[0.06]", compact && "max-w-8")}
        aria-hidden
      >
        <div
          className={cn("h-full rounded-full transition-all", UTIL_COLOUR[util.level])}
          style={{ width: `${Math.max(util.percent, util.bookingCount > 0 ? 8 : 0)}%` }}
        />
      </div>
      {!compact ? (
        <span className="shrink-0 text-[8px] tabular-nums text-slate-500">{util.percent}%</span>
      ) : null}
    </div>
  );
}
