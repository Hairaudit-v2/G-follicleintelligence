import Link from "next/link";

import { DashboardCard, SectionHeader } from "@/src/components/fi-admin/dashboard-ui";
import { PLATFORM_RECENT_RELEASES } from "@/lib/marketing/platformProgressPageContent";
import { Rocket } from "lucide-react";

export function DashboardRecentPlatformReleases() {
  return (
    <DashboardCard
      className="p-4 sm:p-5"
      role="region"
      aria-labelledby="dash-platform-releases-heading"
    >
      <SectionHeader
        id="dash-platform-releases-heading"
        kicker="FI OS platform"
        title="Recent Platform Releases"
        description="Latest infrastructure deployments across the Follicle Intelligence operating system."
      />

      <ol className="mt-4 space-y-3">
        {PLATFORM_RECENT_RELEASES.map((release) => (
          <li
            key={release.id}
            className="flex gap-3 rounded-xl border border-white/[0.07] bg-[#0F1528]/70 px-3 py-3 sm:px-4"
          >
            <Rocket className="mt-0.5 h-4 w-4 shrink-0 text-cyan-400/80" aria-hidden />
            <div className="min-w-0 flex-1">
              <p className="text-sm font-semibold text-[#F8FAFC]">{release.title}</p>
              <div className="mt-1.5 flex flex-wrap items-center gap-2">
                <span className="rounded-full border border-white/[0.08] bg-white/[0.03] px-2 py-0.5 text-[10px] font-semibold uppercase tracking-[0.12em] text-slate-300">
                  {release.module}
                </span>
                <time
                  dateTime={release.date}
                  className="font-mono text-[11px] tabular-nums text-slate-500"
                >
                  {release.date}
                </time>
              </div>
            </div>
          </li>
        ))}
      </ol>

      <p className="mt-4">
        <Link
          href="/platform/progress#engineering-changelog"
          target="_blank"
          rel="noopener noreferrer"
          className="text-sm font-semibold text-cyan-400/90 underline-offset-2 hover:underline"
        >
          Read full engineering changelog
        </Link>
      </p>
    </DashboardCard>
  );
}
