"use client";

import { AlertTriangle, Clock, DoorOpen, UserRound } from "lucide-react";

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
  onSelect?: () => void;
  highlighted?: boolean;
};

export function CalendarOsBookingCard({
  model,
  compact = false,
  onSelect,
  highlighted = false,
}: CalendarOsBookingCardProps) {
  const surface = bookingCalendarChipSurface(model.bookingType, model.catalogColor);
  const topWarning = model.warnings.find((w) => w.severity === "critical") ?? model.warnings[0];

  return (
    <button
      type="button"
      onClick={onSelect}
      className={cn(
        "group w-full rounded-md border text-left transition-colors",
        "border-white/[0.08] bg-[#0F1629]/90 hover:border-cyan-500/30 hover:bg-[#121c33]",
        compact ? "p-1.5" : "p-2",
        highlighted && "ring-1 ring-cyan-400/60"
      )}
      style={surface.chipStyle}
    >
      <div className="flex items-start justify-between gap-1">
        <div className="min-w-0 flex-1">
          <p className={cn("truncate font-medium text-slate-100", compact ? "text-[11px]" : "text-xs")}>
            {model.patientName}
          </p>
          <p className={cn("truncate text-slate-400", compact ? "text-[10px]" : "text-[11px]")}>
            {model.bookingTypeLabel}
          </p>
        </div>
        <span
          className={cn(
            "shrink-0 rounded border px-1 py-0.5 text-[9px] font-medium uppercase tracking-wide",
            STATUS_TONE[model.status] ?? STATUS_TONE.scheduled
          )}
        >
          {model.statusLabel}
        </span>
      </div>

      <div className={cn("mt-1 flex flex-wrap items-center gap-x-2 gap-y-0.5 text-slate-400", compact ? "text-[9px]" : "text-[10px]")}>
        <span className="inline-flex items-center gap-0.5">
          <Clock className="h-2.5 w-2.5 shrink-0" aria-hidden />
          {model.timeRangeLabel}
        </span>
        <span>{model.durationMin}m</span>
      </div>

      {!compact && model.assignedDoctor ? (
        <p className="mt-1 flex items-center gap-1 truncate text-[10px] text-slate-400">
          <UserRound className="h-2.5 w-2.5 shrink-0" aria-hidden />
          {model.assignedDoctor}
        </p>
      ) : null}

      {!compact && model.roomLabel ? (
        <p className="mt-0.5 flex items-center gap-1 truncate text-[10px] text-slate-500">
          <DoorOpen className="h-2.5 w-2.5 shrink-0" aria-hidden />
          {model.roomLabel}
        </p>
      ) : null}

      {model.surgery && !compact ? (
        <div className="mt-1.5 space-y-0.5 rounded border border-white/[0.06] bg-white/[0.02] px-1.5 py-1 text-[10px] text-slate-300">
          {model.surgery.plannedGraftCount ? (
            <p>Grafts: {model.surgery.plannedGraftCount}</p>
          ) : null}
          {model.surgery.readinessStatus ? (
            <p>Readiness: {model.surgery.readinessStatus}</p>
          ) : null}
          {model.surgery.paymentStatus ? <p>Payment: {model.surgery.paymentStatus}</p> : null}
        </div>
      ) : null}

      {topWarning ? (
        <div
          className={cn(
            "mt-1.5 inline-flex max-w-full items-center gap-1 rounded border px-1 py-0.5 text-[9px] font-medium",
            WARNING_TONE[topWarning.severity] ?? WARNING_TONE.warning
          )}
        >
          <AlertTriangle className="h-2.5 w-2.5 shrink-0" aria-hidden />
          <span className="truncate">{topWarning.label}</span>
        </div>
      ) : null}

      {model.isUnassigned ? (
        <span className="mt-1 inline-block rounded border border-amber-500/35 bg-amber-500/10 px-1 py-0.5 text-[9px] font-medium text-amber-200">
          Unassigned
        </span>
      ) : null}
    </button>
  );
}
