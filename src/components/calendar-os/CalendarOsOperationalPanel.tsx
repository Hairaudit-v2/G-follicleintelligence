"use client";

import { AlertCircle, CalendarCheck, CreditCard, DoorOpen, Stethoscope, Users } from "lucide-react";

import type { CalendarOsOperationalPanelSummary } from "@/src/lib/calendar-os/calendarOperationalWarnings";
import { cn } from "@/lib/utils";

type PanelCardProps = {
  icon: React.ReactNode;
  label: string;
  value: string | number;
  tone?: "default" | "warning" | "success";
  detail?: string;
};

function PanelCard({ icon, label, value, tone = "default", detail }: PanelCardProps) {
  return (
    <div
      className={cn(
        "rounded-lg border px-3 py-2.5",
        tone === "warning" && "border-amber-500/25 bg-amber-500/5",
        tone === "success" && "border-emerald-500/25 bg-emerald-500/5",
        tone === "default" && "border-white/[0.08] bg-white/[0.03]"
      )}
    >
      <div className="flex items-center gap-2 text-slate-400">
        {icon}
        <span className="text-[10px] font-semibold uppercase tracking-wide">{label}</span>
      </div>
      <p className="mt-1 text-lg font-semibold tabular-nums text-slate-100">{value}</p>
      {detail ? <p className="mt-0.5 truncate text-[10px] text-slate-500">{detail}</p> : null}
    </div>
  );
}

export type CalendarOsOperationalPanelProps = {
  summary: CalendarOsOperationalPanelSummary;
  className?: string;
};

export function CalendarOsOperationalPanel({ summary, className }: CalendarOsOperationalPanelProps) {
  const clinicianDetail =
    summary.availableClinicians.length > 0
      ? summary.availableClinicians.slice(0, 3).join(", ")
      : "No clinicians marked available";

  return (
    <aside
      className={cn(
        "grid shrink-0 grid-cols-2 gap-2 border-b border-white/[0.06] bg-[#081020]/60 p-3 lg:grid-cols-4 xl:grid-cols-7",
        className
      )}
      aria-label="Operational context"
    >
      <PanelCard
        icon={<CalendarCheck className="h-3.5 w-3.5" aria-hidden />}
        label="Today's capacity"
        value={`${summary.todaysCapacity.booked} booked`}
        detail={`${summary.todaysCapacity.availableStaff} clinicians available`}
      />
      <PanelCard
        icon={<Users className="h-3.5 w-3.5" aria-hidden />}
        label="Available clinicians"
        value={summary.availableClinicians.length}
        detail={clinicianDetail}
        tone="success"
      />
      <PanelCard
        icon={<AlertCircle className="h-3.5 w-3.5" aria-hidden />}
        label="Unassigned"
        value={summary.unassignedBookings}
        tone={summary.unassignedBookings > 0 ? "warning" : "default"}
      />
      <PanelCard
        icon={<Stethoscope className="h-3.5 w-3.5" aria-hidden />}
        label="Surgery readiness"
        value={summary.surgeryReadinessIssues}
        detail={summary.surgeryReadinessIssues > 0 ? "Issues need review" : "All clear"}
        tone={summary.surgeryReadinessIssues > 0 ? "warning" : "default"}
      />
      <PanelCard
        icon={<DoorOpen className="h-3.5 w-3.5" aria-hidden />}
        label="Rooms available"
        value={summary.roomsAvailable}
      />
      <PanelCard
        icon={<CalendarCheck className="h-3.5 w-3.5" aria-hidden />}
        label="Follow-ups due"
        value={summary.followUpsDue}
      />
      <PanelCard
        icon={<CreditCard className="h-3.5 w-3.5" aria-hidden />}
        label="Payments"
        value={summary.paymentsRequiringAttention}
        detail="Requiring attention"
        tone={summary.paymentsRequiringAttention > 0 ? "warning" : "default"}
      />
    </aside>
  );
}
