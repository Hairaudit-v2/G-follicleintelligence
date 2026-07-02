"use client";

import type { ReactNode } from "react";

import { DashboardCard } from "@/src/components/fi-admin/dashboard-ui/DashboardCard";
import type { StaffUnifiedStatusSnapshot } from "@/src/lib/workforce/staffLifecycleUxCore";
import { cn } from "@/lib/utils";

function StatusPill({
  children,
  className,
}: {
  children: ReactNode;
  className?: string;
}) {
  return (
    <span
      className={cn(
        "inline-flex items-center rounded-full px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wide ring-1 ring-inset",
        className
      )}
    >
      {children}
    </span>
  );
}

function pillToneForOperationalState(
  state: StaffUnifiedStatusSnapshot["operationalState"]
): string {
  if (state === "active") return "bg-emerald-500/15 text-emerald-300 ring-emerald-500/25";
  if (state === "pending_onboarding") return "bg-sky-500/15 text-sky-300 ring-sky-500/25";
  if (state === "temporarily_unavailable") return "bg-amber-500/15 text-amber-200 ring-amber-500/25";
  if (state === "departed" || state === "archived") {
    return "bg-slate-500/15 text-slate-400 ring-slate-500/20";
  }
  return "bg-slate-500/15 text-slate-400 ring-slate-500/20";
}

export function StaffStatusCard({
  name,
  roleLabel,
  status,
  compact = false,
  className,
}: {
  name: string;
  roleLabel?: string | null;
  status: StaffUnifiedStatusSnapshot;
  compact?: boolean;
  className?: string;
}) {
  const pills: { label: string; className: string }[] = [
    {
      label: status.operationalLabel,
      className: pillToneForOperationalState(status.operationalState),
    },
  ];

  if (status.loginLabel) {
    pills.push({
      label: status.loginLabel,
      className: status.isAccessSuspended
        ? "bg-rose-500/15 text-rose-300 ring-rose-500/25"
        : "bg-slate-500/15 text-slate-300 ring-slate-500/20",
    });
  }
  if (status.pinLabel) {
    pills.push({
      label: status.pinLabel,
      className: status.pinLabel.includes("Active")
        ? "bg-emerald-500/15 text-emerald-300 ring-emerald-500/25"
        : "bg-amber-500/15 text-amber-200 ring-amber-500/25",
    });
  }
  if (status.readinessLabel) {
    pills.push({
      label: status.readinessLabel,
      className: "bg-violet-500/15 text-violet-200 ring-violet-500/25",
    });
  }
  if (status.complianceLabel) {
    pills.push({
      label: status.complianceLabel,
      className: "bg-amber-500/15 text-amber-200 ring-amber-500/25",
    });
  }

  if (compact) {
    return (
      <div className={cn("flex flex-wrap items-center gap-2", className)}>
        {pills.map((pill) => (
          <StatusPill key={pill.label} className={pill.className}>
            {pill.label}
          </StatusPill>
        ))}
      </div>
    );
  }

  return (
    <DashboardCard className={cn("p-4 sm:p-5", className)}>
      <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
        <div className="min-w-0">
          <p className="text-xs font-medium uppercase tracking-wider text-[#64748B]">Staff status</p>
          <h3 className="mt-1 truncate text-base font-semibold text-[#F8FAFC]">{name}</h3>
          {roleLabel ? (
            <p className="text-xs capitalize text-[#64748B]">{roleLabel.replace(/_/g, " ")}</p>
          ) : null}
        </div>
        <div className="flex flex-wrap gap-2">{pills.map((pill) => (
            <StatusPill key={pill.label} className={pill.className}>
              {pill.label}
            </StatusPill>
          ))}</div>
      </div>
      {status.isAccessSuspended ? (
        <p className="mt-3 text-xs text-rose-200/90">
          Access is suspended or revoked. Manage reactivation in Staff Access — do not send new
          onboarding invites until resolved.
        </p>
      ) : null}
    </DashboardCard>
  );
}
