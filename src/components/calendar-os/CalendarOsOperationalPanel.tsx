"use client";

import {
  AlertCircle,
  CalendarCheck,
  CreditCard,
  DoorOpen,
  Stethoscope,
  Users,
} from "lucide-react";

import type { CalendarOsOperationalPanelSummary } from "@/src/lib/calendar-os/calendarOperationalWarnings";
import type { CalendarOsDisplayDensity } from "@/src/lib/calendar-os/calendarDisplayDensity";
import { calendarOsDensityTokens } from "@/src/lib/calendar-os/calendarDisplayDensity";
import { cn } from "@/lib/utils";

type PanelCardProps = {
  icon: React.ReactNode;
  label: string;
  value: string | number;
  tone?: "default" | "warning" | "success";
  detail?: string;
  compact?: boolean;
};

function PanelCard({ icon, label, value, tone = "default", detail, compact }: PanelCardProps) {
  return (
    <div
      className={cn(
        "rounded-lg border",
        compact ? "px-2 py-1.5" : "px-3 py-2.5",
        tone === "warning" && "border-amber-500/25 bg-amber-500/5",
        tone === "success" && "border-emerald-500/25 bg-emerald-500/5",
        tone === "default" && "border-white/[0.08] bg-white/[0.03]"
      )}
    >
      <div className="flex items-center gap-1.5 text-slate-400">
        {icon}
        <span
          className={cn(
            "font-semibold uppercase tracking-wide",
            compact ? "text-[9px]" : "text-[10px]"
          )}
        >
          {label}
        </span>
      </div>
      <p
        className={cn(
          "font-semibold tabular-nums text-slate-100",
          compact ? "mt-0.5 text-base" : "mt-1 text-lg"
        )}
      >
        {value}
      </p>
      {detail ? (
        <p className={cn("truncate text-slate-500", compact ? "mt-0 text-[9px]" : "mt-0.5 text-[10px]")}>
          {detail}
        </p>
      ) : null}
    </div>
  );
}

export type CalendarOsOperationalPanelProps = {
  summary: CalendarOsOperationalPanelSummary;
  density?: CalendarOsDisplayDensity;
  className?: string;
};

export function CalendarOsOperationalPanel({
  summary,
  density = "comfortable",
  className,
}: CalendarOsOperationalPanelProps) {
  const compact = calendarOsDensityTokens(density).panelCompact;
  const clinicianDetail =
    summary.availableClinicians.length > 0
      ? summary.availableClinicians.slice(0, 3).join(", ")
      : "No clinicians marked available";

  const capacityDetail =
    summary.todaysCapacity.availableStaff > 0
      ? `${summary.todaysCapacity.availableStaff} clinicians · ${summary.roomsAvailable} rooms`
      : `${summary.roomsAvailable} rooms open`;

  return (
    <aside className={cn("shrink-0 border-b border-white/[0.06] bg-[#081020]/60", className)} aria-label="Operational context">
      <div
        className={cn(
          "grid grid-cols-2 gap-2 lg:grid-cols-4 xl:grid-cols-8",
          compact ? "p-2" : "p-3"
        )}
      >
        <PanelCard
          compact={compact}
          icon={<CalendarCheck className="h-3 w-3" aria-hidden />}
          label="Today capacity"
          value={`${summary.todaysCapacity.booked}`}
          detail={capacityDetail}
        />
        <PanelCard
          compact={compact}
          icon={<Users className="h-3 w-3" aria-hidden />}
          label="Available staff"
          value={summary.availableClinicians.length}
          detail={clinicianDetail}
          tone="success"
        />
        <PanelCard
          compact={compact}
          icon={<DoorOpen className="h-3 w-3" aria-hidden />}
          label="Rooms available"
          value={summary.roomsAvailable}
        />
        <PanelCard
          compact={compact}
          icon={<AlertCircle className="h-3 w-3" aria-hidden />}
          label="Unassigned"
          value={summary.unassignedBookings}
          tone={summary.unassignedBookings > 0 ? "warning" : "default"}
        />
        <PanelCard
          compact={compact}
          icon={<Stethoscope className="h-3 w-3" aria-hidden />}
          label="Surgery readiness"
          value={summary.surgeryReadinessIssues}
          detail={summary.surgeryReadinessIssues > 0 ? "Issues need review" : "All clear"}
          tone={summary.surgeryReadinessIssues > 0 ? "warning" : "default"}
        />
        <PanelCard
          compact={compact}
          icon={<CreditCard className="h-3 w-3" aria-hidden />}
          label="Payments"
          value={summary.paymentsRequiringAttention}
          detail="Requiring attention"
          tone={summary.paymentsRequiringAttention > 0 ? "warning" : "default"}
        />
        <PanelCard
          compact={compact}
          icon={<CalendarCheck className="h-3 w-3" aria-hidden />}
          label="Follow-ups due"
          value={summary.followUpsDue}
        />
        <PanelCard
          compact={compact}
          icon={<Users className="h-3 w-3" aria-hidden />}
          label="Coverage"
          value={summary.staffCoverageWarnings.length}
          detail={
            summary.staffCoverageWarnings.length > 0 ? "Warnings active" : "Roster OK"
          }
          tone={summary.staffCoverageWarnings.some((w) => w.severity === "critical") ? "warning" : "default"}
        />
      </div>

      {summary.staffCoverageWarnings.length > 0 ? (
        <div className={cn("border-t border-white/[0.05]", compact ? "px-2 pb-2" : "px-3 pb-3")}>
          <ul className="space-y-1">
            {summary.staffCoverageWarnings.map((w) => (
              <li
                key={w.id}
                className={cn(
                  "flex items-center gap-2 rounded border px-2 py-1 text-[10px]",
                  w.severity === "critical"
                    ? "border-rose-500/30 bg-rose-500/10 text-rose-200"
                    : "border-amber-500/25 bg-amber-500/5 text-amber-200"
                )}
              >
                <AlertCircle className="h-3 w-3 shrink-0" aria-hidden />
                <span className="truncate">{w.label}</span>
              </li>
            ))}
          </ul>
        </div>
      ) : null}
    </aside>
  );
}
