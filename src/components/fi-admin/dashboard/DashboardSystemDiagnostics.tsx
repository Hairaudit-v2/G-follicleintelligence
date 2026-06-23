"use client";

import { ChevronDown } from "lucide-react";

import { SectionHeader } from "@/src/components/fi-admin/dashboard-ui";
import { DashboardPlatformDevelopmentProgress } from "@/src/components/fi-admin/dashboard/DashboardPlatformDevelopmentProgress";
import { DashboardRecentPlatformReleases } from "@/src/components/fi-admin/dashboard/DashboardRecentPlatformReleases";

export function DashboardSystemDiagnostics() {
  return (
    <section
      className="overflow-hidden rounded-xl border border-white/[0.07] bg-[#0c1426]/50"
      aria-labelledby="dash-system-diagnostics-heading"
    >
      <details className="group">
        <summary className="flex cursor-pointer list-none items-center justify-between gap-3 px-4 py-4 sm:px-5 [&::-webkit-details-marker]:hidden">
          <div className="min-w-0">
            <SectionHeader
              id="dash-system-diagnostics-heading"
              kicker="Operators"
              title="System diagnostics"
              description="For platform operators only. These checks support platform integrity and do not affect day-to-day clinic operations."
            />
          </div>
          <ChevronDown
            className="h-5 w-5 shrink-0 text-slate-500 transition group-open:rotate-180"
            aria-hidden
          />
        </summary>
        <div className="space-y-4 border-t border-white/[0.06] px-3 pb-4 pt-2 sm:px-4 sm:pb-5">
          <DashboardPlatformDevelopmentProgress />
          <DashboardRecentPlatformReleases />
        </div>
      </details>
    </section>
  );
}
