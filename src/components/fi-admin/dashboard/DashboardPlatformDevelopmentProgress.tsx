import Link from "next/link";

import { EcosystemCompletionSnapshot } from "@/components/platform/EcosystemCompletionSnapshot";
import { DashboardCard, SectionHeader } from "@/src/components/fi-admin/dashboard-ui";
import {
  PlatformProgressAnimatedBar,
  PlatformProgressStatusBadge,
} from "@/components/platform/PlatformProgressPrimitives";
import { PLATFORM_PROGRESS_MODULES } from "@/lib/marketing/platformProgressPageContent";

export function DashboardPlatformDevelopmentProgress() {
  return (
    <DashboardCard className="p-4 sm:p-5" role="region" aria-labelledby="dash-platform-progress-heading">
      <SectionHeader
        id="dash-platform-progress-heading"
        kicker="FI OS platform"
        title="Platform Development Progress"
        description="Live delivery status across the FI ecosystem and all active OS modules."
      />

      <EcosystemCompletionSnapshot variant="admin" className="mt-4" />

      <p className="mt-5 text-[0.6rem] font-semibold uppercase tracking-[0.16em] text-[#94A3B8]">FI OS module registry</p>

      <ul className="mt-3 space-y-3">
        {PLATFORM_PROGRESS_MODULES.map((mod) => (
          <li
            key={mod.id}
            className="rounded-xl border border-white/[0.07] bg-[#0F1528]/70 px-3 py-3 sm:px-4"
          >
            <div className="flex flex-wrap items-start justify-between gap-2">
              <div className="min-w-0">
                <p className="text-sm font-semibold text-[#F8FAFC]">{mod.name}</p>
                <p className="mt-0.5 text-[10px] font-medium uppercase tracking-[0.12em] text-slate-500">{mod.stage}</p>
              </div>
              <div className="flex flex-wrap items-center gap-2">
                <span className="font-mono text-sm font-semibold tabular-nums text-cyan-300/90">{mod.completionPercent}%</span>
                <PlatformProgressStatusBadge status={mod.status} label={mod.statusLabel} />
              </div>
            </div>
            <div className="mt-2.5">
              <PlatformProgressAnimatedBar percent={mod.completionPercent} status={mod.status} delay={0} />
            </div>
          </li>
        ))}
      </ul>

      <p className="mt-4">
        <Link
          href="/platform/progress"
          target="_blank"
          rel="noopener noreferrer"
          className="text-sm font-semibold text-cyan-400/90 underline-offset-2 hover:underline"
        >
          View public platform progress
        </Link>
      </p>
    </DashboardCard>
  );
}
