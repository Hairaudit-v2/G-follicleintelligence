import Link from "next/link";
import { Clock } from "lucide-react";

import { DashboardCard, SectionHeader } from "@/src/components/fi-admin/dashboard-ui";
import { DashboardEmptyState } from "@/src/components/fi-admin/dashboard/DashboardEmptyState";
import type { TimelineEntry } from "@/src/lib/fiAdmin/dashboardCommandCentreDerive";

export function DashboardTodayTimeline(props: { entries: readonly TimelineEntry[]; base: string }) {
  const { entries, base } = props;

  return (
    <DashboardCard className="p-4 sm:p-5" role="region" aria-labelledby="today-timeline-heading">
      <SectionHeader
        id="today-timeline-heading"
        kicker="Today"
        title="Clinic timeline"
        description="A chronological view of today’s operational rhythm."
      />
      {entries.length === 0 ? (
        <DashboardEmptyState
          className="mt-4 max-w-xl py-5 sm:px-6 sm:py-6"
          title="A quiet clinic day"
          description="No scheduled visits or payment actions appear on today’s timeline yet."
          actionLabel="Open Calendar"
          actionHref={`${base}/calendar`}
        />
      ) : (
        <ol className="relative mt-4 space-y-0 border-l border-cyan-500/15 pl-4 sm:pl-5">
          {entries.map((entry) => (
            <li key={entry.id} className="relative pb-4 last:pb-0">
              <span
                className="absolute -left-[0.44rem] top-1.5 h-2.5 w-2.5 rounded-full border border-cyan-400/50 bg-[#0c1426]"
                aria-hidden
              />
              <div className="flex flex-col gap-1 sm:flex-row sm:items-start sm:gap-4">
                <span className="flex shrink-0 items-center gap-1.5 font-mono text-xs font-semibold tabular-nums text-cyan-200/90">
                  <Clock className="h-3.5 w-3.5 text-cyan-400/70" aria-hidden />
                  {entry.timeLabel}
                </span>
                <div className="min-w-0 flex-1">
                  {entry.href ? (
                    <Link href={entry.href} className="group block">
                      <p className="text-sm font-semibold text-slate-100 group-hover:text-cyan-100">
                        {entry.title}
                      </p>
                      <p className="mt-0.5 text-xs text-slate-500">{entry.detail}</p>
                    </Link>
                  ) : (
                    <>
                      <p className="text-sm font-semibold text-slate-100">{entry.title}</p>
                      <p className="mt-0.5 text-xs text-slate-500">{entry.detail}</p>
                    </>
                  )}
                </div>
              </div>
            </li>
          ))}
        </ol>
      )}
    </DashboardCard>
  );
}
