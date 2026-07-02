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
  scheduled: "bg-white/10 text-slate-200 border-white/15",
  confirmed: "bg-emerald-500/15 text-emerald-200 border-emerald-500/30",
  arrived: "bg-cyan-500/15 text-cyan-200 border-cyan-500/30",
  completed: "bg-slate-500/20 text-slate-300 border-slate-500/30",
  cancelled: "bg-slate-600/20 text-slate-400 border-slate-600/30 line-through",
  no_show: "bg-rose-500/15 text-rose-200 border-rose-500/30",
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
  const expanded = showHoverDetail && hovered && !ultraCompact;

  return (
    <button
      type="button"
      onClick={onSelect}
      onMouseEnter={() => setHovered(true)}
      onMouseLeave={() => setHovered(false)}
      className={cn(
        "group relative w-full rounded border text-left transition-all",
        "border-white/[0.08] bg-[#0F1629]/90 hover:border-cyan-500/30 hover:bg-[#121c33]",
        ultraCompact ? "p-1" : compact ? "p-1.5" : "p-2",
        isSurgery &&
          "border-violet-500/30 border-l-2 border-l-violet-400 bg-gradient-to-br from-violet-950/50 to-[#0F1629]/90",
        highlighted && "ring-1 ring-cyan-400/60",
        model.isUnassigned && "border-amber-500/30"
      )}
      style={surface.chipStyle}
    >
      <div className="flex items-start justify-between gap-0.5">
        <div className="min-w-0 flex-1">
          <div className="flex items-center gap-1">
            {isSurgery ? (
              <Scissors className="h-2.5 w-2.5 shrink-0 text-violet-300" aria-hidden />
            ) : null}
            <p
              className={cn(
                "truncate font-medium text-slate-100",
                ultraCompact ? "text-[10px]" : compact ? "text-[11px]" : "text-xs"
              )}
            >
              {model.patientName}
            </p>
          </div>
          <p
            className={cn(
              "truncate text-slate-400",
              ultraCompact ? "text-[9px]" : compact ? "text-[10px]" : "text-[11px]"
            )}
          >
            {model.bookingTypeLabel}
          </p>
        </div>
        <span
          className={cn(
            "shrink-0 rounded border font-medium uppercase tracking-wide",
            ultraCompact ? "px-0.5 py-0 text-[8px]" : "px-1 py-0.5 text-[9px]",
            STATUS_TONE[model.status] ?? STATUS_TONE.scheduled
          )}
        >
          {ultraCompact ? model.statusLabel.slice(0, 3) : model.statusLabel}
        </span>
      </div>

      <div
        className={cn(
          "flex flex-wrap items-center gap-x-1.5 gap-y-0 text-slate-400",
          ultraCompact ? "mt-0.5 text-[8px]" : compact ? "mt-0.5 text-[9px]" : "mt-1 text-[10px]"
        )}
      >
        <span className="inline-flex items-center gap-0.5">
          <Clock className="h-2.5 w-2.5 shrink-0" aria-hidden />
          {model.timeRangeLabel}
        </span>
        <span>{model.durationMin}m</span>
        {isSurgery && model.surgery?.plannedGraftCount ? (
          <span className="text-violet-300/80">{model.surgery.plannedGraftCount} grafts</span>
        ) : null}
      </div>

      {expanded && model.assignedDoctor ? (
        <p className="mt-1 flex items-center gap-1 truncate text-[10px] text-slate-400">
          <UserRound className="h-2.5 w-2.5 shrink-0" aria-hidden />
          {model.assignedDoctor}
        </p>
      ) : null}

      {expanded && model.roomLabel ? (
        <p className="mt-0.5 flex items-center gap-1 truncate text-[10px] text-slate-500">
          <DoorOpen className="h-2.5 w-2.5 shrink-0" aria-hidden />
          {model.roomLabel}
        </p>
      ) : null}

      {isSurgery && (expanded || !compact) ? (
        <div className="mt-1 space-y-0.5 rounded border border-violet-500/20 bg-violet-500/5 px-1 py-0.5 text-[9px] text-violet-100/90">
          {model.surgery?.readinessStatus ? (
            <p>Readiness: {model.surgery.readinessStatus}</p>
          ) : null}
          {model.surgery?.paymentStatus ? <p>Payment: {model.surgery.paymentStatus}</p> : null}
        </div>
      ) : null}

      {topWarning && !ultraCompact ? (
        <div
          className={cn(
            "inline-flex max-w-full items-center gap-0.5 rounded border font-medium",
            compact ? "mt-0.5 px-1 py-0 text-[8px]" : "mt-1 px-1 py-0.5 text-[9px]",
            WARNING_TONE[topWarning.severity] ?? WARNING_TONE.warning
          )}
        >
          <AlertTriangle className="h-2.5 w-2.5 shrink-0" aria-hidden />
          <span className="truncate">{topWarning.label}</span>
        </div>
      ) : null}

      {model.isUnassigned ? (
        <span className="mt-0.5 inline-block rounded border border-amber-500/35 bg-amber-500/10 px-1 py-0 text-[8px] font-medium text-amber-200">
          Unassigned
        </span>
      ) : null}
    </button>
  );
}
