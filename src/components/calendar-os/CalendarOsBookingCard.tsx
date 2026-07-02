"use client";

import { useState } from "react";
import { AlertTriangle, Clock, DoorOpen, Scissors, UserRound } from "lucide-react";

import { bookingCalendarChipSurface } from "@/src/lib/bookings/calendarLabels";
import { cn } from "@/lib/utils";
import type { CalendarOsBookingCardModel } from "@/src/lib/calendar-os/calendarBookingCardModel";

const WARNING_TONE: Record<string, string> = {
  critical: "bg-rose-500/20 text-rose-200 border-rose-500/40",
  warning: "bg-amber-500/20 text-amber-200 border-amber-500/40",
  info: "bg-sky-500/15 text-sky-200 border-sky-500/30",
};

const STATUS_TONE: Record<string, string> = {
  scheduled: "bg-white/8 text-slate-300 border-white/10",
  confirmed: "bg-emerald-500/12 text-emerald-200 border-emerald-500/25",
  arrived: "bg-cyan-500/12 text-cyan-200 border-cyan-500/25",
  completed: "bg-slate-500/15 text-slate-400 border-slate-500/25",
  cancelled: "bg-slate-600/15 text-slate-500 border-slate-600/25 line-through",
  no_show: "bg-rose-500/12 text-rose-200 border-rose-500/25",
};

export type CalendarOsBookingCardProps = {
  model: CalendarOsBookingCardModel;
  compact?: boolean;
  ultraCompact?: boolean;
  showHoverDetail?: boolean;
  onSelect?: () => void;
  highlighted?: boolean;
};

export function CalendarOsBookingCard({
  model,
  compact = false,
  ultraCompact = false,
  showHoverDetail = true,
  onSelect,
  highlighted = false,
}: CalendarOsBookingCardProps) {
  const [hovered, setHovered] = useState(false);
  const surface = bookingCalendarChipSurface(model.bookingType, model.catalogColor);
  const isSurgery = Boolean(model.surgery);
  const topWarning = model.warnings.find((w) => w.severity === "critical") ?? model.warnings[0];
  const expanded = showHoverDetail && hovered;

  return (
    <button
      type="button"
      onClick={onSelect}
      onMouseEnter={() => setHovered(true)}
      onMouseLeave={() => setHovered(false)}
      className={cn(
        "group relative w-full rounded border text-left transition-all",
        "border-white/[0.07] bg-[#0c1426]/95 hover:border-cyan-500/25 hover:bg-[#101c32] hover:shadow-md hover:shadow-black/30",
        ultraCompact ? "px-1 py-0.5" : compact ? "px-1 py-0.5" : "px-1.5 py-1",
        isSurgery &&
          "border-violet-500/35 border-l-[3px] border-l-violet-400 bg-gradient-to-br from-violet-950/55 to-[#0c1426]/95 shadow-sm shadow-violet-950/40",
        highlighted && "ring-1 ring-cyan-400/50",
        model.isUnassigned && "border-amber-500/25"
      )}
      style={isSurgery ? undefined : surface.chipStyle}
    >
      <div className="flex items-center justify-between gap-0.5">
        <div className="min-w-0 flex-1">
          <div className="flex items-center gap-0.5">
            {isSurgery ? (
              <Scissors className="h-2.5 w-2.5 shrink-0 text-violet-300" aria-hidden />
            ) : null}
            <p
              className={cn(
                "truncate text-slate-100",
                isSurgery && "font-semibold text-violet-50",
                ultraCompact ? "text-[9px]" : compact ? "text-[10px]" : "text-[11px]"
              )}
            >
              {model.patientName}
            </p>
          </div>
          {expanded ? (
            <p
              className={cn(
                "truncate text-slate-500",
                ultraCompact ? "text-[8px]" : "text-[9px]"
              )}
            >
              {model.bookingTypeLabel}
            </p>
          ) : null}
        </div>
        <span
          className={cn(
            "shrink-0 rounded border font-medium uppercase tracking-wide",
            ultraCompact ? "px-0.5 py-0 text-[7px]" : "px-0.5 py-0 text-[8px]",
            STATUS_TONE[model.status] ?? STATUS_TONE.scheduled
          )}
        >
          {ultraCompact ? model.statusLabel.slice(0, 3) : model.statusLabel}
        </span>
      </div>

      {expanded ? (
        <>
          <div
            className={cn(
              "flex flex-wrap items-center gap-x-1 gap-y-0 text-slate-500",
              ultraCompact ? "mt-0 text-[8px]" : "mt-0.5 text-[9px]"
            )}
          >
            <span className="inline-flex items-center gap-0.5">
              <Clock className="h-2 w-2 shrink-0" aria-hidden />
              {model.timeRangeLabel}
            </span>
            <span>{model.durationMin}m</span>
            {isSurgery && model.surgery?.plannedGraftCount ? (
              <span className="text-violet-300/90">{model.surgery.plannedGraftCount} grafts</span>
            ) : null}
          </div>

          {model.assignedDoctor ? (
            <p className="mt-0.5 flex items-center gap-0.5 truncate text-[9px] text-slate-500">
              <UserRound className="h-2 w-2 shrink-0" aria-hidden />
              {model.assignedDoctor}
            </p>
          ) : null}

          {model.roomLabel ? (
            <p className="flex items-center gap-0.5 truncate text-[9px] text-slate-600">
              <DoorOpen className="h-2 w-2 shrink-0" aria-hidden />
              {model.roomLabel}
            </p>
          ) : null}

          {isSurgery ? (
            <div className="mt-0.5 space-y-0 rounded border border-violet-500/20 bg-violet-500/5 px-1 py-0.5 text-[8px] text-violet-100/90">
              {model.surgery?.readinessStatus ? (
                <p>Readiness: {model.surgery.readinessStatus}</p>
              ) : null}
              {model.surgery?.paymentStatus ? <p>Payment: {model.surgery.paymentStatus}</p> : null}
            </div>
          ) : null}

          {topWarning ? (
            <div
              className={cn(
                "inline-flex max-w-full items-center gap-0.5 rounded border font-medium",
                "mt-0.5 px-0.5 py-0 text-[8px]",
                WARNING_TONE[topWarning.severity] ?? WARNING_TONE.warning
              )}
            >
              <AlertTriangle className="h-2 w-2 shrink-0" aria-hidden />
              <span className="truncate">{topWarning.label}</span>
            </div>
          ) : null}
        </>
      ) : null}

      {!expanded && model.isUnassigned ? (
        <span
          className="mt-0.5 inline-block h-1 w-1 rounded-full bg-amber-400"
          title="Unassigned"
          aria-label="Unassigned"
        />
      ) : null}

      {!expanded && isSurgery && topWarning?.severity === "critical" ? (
        <span
          className="absolute right-0.5 top-0.5 h-1.5 w-1.5 rounded-full bg-rose-400"
          title={topWarning.label}
          aria-hidden
        />
      ) : null}
    </button>
  );
}