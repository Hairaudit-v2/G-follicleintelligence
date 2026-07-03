"use client";

import Link from "next/link";

import { DashboardCard } from "@/src/components/fi-admin/dashboard-ui/DashboardCard";
import { StaffStatusCard } from "@/src/components/fi/workforce/StaffStatusCard";
import type {
  StaffLifecycleBlocker,
  StaffLifecycleProgressStage,
  StaffProfileExtendedStatus,
} from "@/src/lib/workforce/staffProfileHubCore";
import type { StaffLifecycleAction } from "@/src/lib/workforce/staffLifecycleUxCore";
import { cn } from "@/lib/utils";

function ProgressRail({ stages }: { stages: StaffLifecycleProgressStage[] }) {
  return (
    <DashboardCard className="p-4 sm:p-5">
      <p className="text-xs font-medium uppercase tracking-wider text-[#64748B]">Lifecycle progress</p>
      <ol className="mt-4 flex flex-col gap-0 sm:flex-row sm:items-start sm:justify-between">
        {stages.map((stage, index) => (
          <li
            key={stage.id}
            className={cn(
              "relative flex min-w-0 flex-1 flex-col items-start sm:items-center sm:text-center",
              index < stages.length - 1 &&
                "sm:after:absolute sm:after:left-[calc(50%+1rem)] sm:after:top-3 sm:after:h-px sm:after:w-[calc(100%-2rem)] sm:after:bg-white/10"
            )}
          >
            <span
              className={cn(
                "inline-flex h-6 w-6 shrink-0 items-center justify-center rounded-full text-[10px] font-bold",
                stage.status === "complete" && "bg-emerald-500/20 text-emerald-300 ring-1 ring-emerald-500/30",
                stage.status === "current" && "bg-[#22C1FF]/20 text-[#22C1FF] ring-1 ring-[#22C1FF]/40",
                stage.status === "blocked" && "bg-rose-500/20 text-rose-300 ring-1 ring-rose-500/30",
                stage.status === "upcoming" && "bg-white/5 text-slate-500 ring-1 ring-white/10"
              )}
              aria-hidden
            >
              {stage.status === "complete" ? "✓" : index + 1}
            </span>
            <p className="mt-2 text-xs font-semibold text-[#E2E8F0]">{stage.label}</p>
            {stage.blockReason ? (
              <p className="mt-1 text-[10px] text-amber-200/90">{stage.blockReason}</p>
            ) : null}
          </li>
        ))}
      </ol>
    </DashboardCard>
  );
}

function AttentionPanel({ blockers }: { blockers: StaffLifecycleBlocker[] }) {
  if (blockers.length === 0) {
    return (
      <DashboardCard className="p-4 sm:p-5">
        <p className="text-xs font-medium uppercase tracking-wider text-[#64748B]">What needs attention</p>
        <p className="mt-3 text-sm text-emerald-200/90">
          No blockers detected — staff lifecycle pathways look clear from available data.
        </p>
      </DashboardCard>
    );
  }

  return (
    <DashboardCard className="p-4 sm:p-5">
      <p className="text-xs font-medium uppercase tracking-wider text-[#64748B]">What needs attention</p>
      <ul className="mt-3 space-y-3">
        {blockers.map((blocker) => (
          <li
            key={`${blocker.id}-${blocker.label}`}
            className="rounded-lg border border-amber-500/20 bg-amber-500/5 px-3 py-2.5"
          >
            <Link href={blocker.href} className="group block">
              <p className="text-sm font-medium text-amber-100 group-hover:text-[#22C1FF]">
                {blocker.label}
              </p>
              <p className="mt-1 text-xs text-[#94A3B8]">{blocker.description}</p>
            </Link>
          </li>
        ))}
      </ul>
    </DashboardCard>
  );
}

function ActionPanel({ actions }: { actions: StaffLifecycleAction[] }) {
  const primary = actions.filter((a) => a.priority === "primary");
  const secondary = actions.filter((a) => a.priority === "secondary");
  const guidance = actions.find((a) => a.guidance)?.guidance;

  return (
    <DashboardCard className="p-4 sm:p-5">
      <p className="text-xs font-medium uppercase tracking-wider text-[#64748B]">Next actions</p>
      {guidance ? (
        <p className="mt-2 text-xs text-rose-200/90">{guidance}</p>
      ) : null}
      <div className="mt-3 flex flex-wrap gap-2">
        {primary.map((action) =>
          action.href ? (
            <Link
              key={action.id}
              href={action.href}
              className="rounded-lg border border-[#22C1FF]/40 bg-[#22C1FF]/15 px-3 py-1.5 text-xs font-semibold text-[#22C1FF] hover:bg-[#22C1FF]/25"
            >
              {action.label}
            </Link>
          ) : (
            <span
              key={action.id}
              className="rounded-lg border border-[#22C1FF]/40 bg-[#22C1FF]/15 px-3 py-1.5 text-xs font-semibold text-[#22C1FF]"
            >
              {action.label}
            </span>
          )
        )}
        {secondary.map((action) =>
          action.href ? (
            <Link
              key={`${action.id}-${action.label}`}
              href={action.href}
              className="rounded-lg border border-white/10 px-3 py-1.5 text-xs font-medium text-[#CBD5E1] hover:bg-white/5"
            >
              {action.label}
            </Link>
          ) : null
        )}
      </div>
    </DashboardCard>
  );
}

export function StaffProfileOverviewPanel({
  name,
  roleLabel,
  status,
  blockers,
  actions,
  progressStages,
}: {
  name: string;
  roleLabel?: string | null;
  status: StaffProfileExtendedStatus;
  blockers: StaffLifecycleBlocker[];
  actions: StaffLifecycleAction[];
  progressStages: StaffLifecycleProgressStage[];
}) {
  return (
    <div className="space-y-4" data-testid="staff-profile-overview">
      <StaffStatusCard name={name} roleLabel={roleLabel} status={status} extended />
      <ProgressRail stages={progressStages} />
      <AttentionPanel blockers={blockers} />
      <ActionPanel actions={actions} />
    </div>
  );
}
