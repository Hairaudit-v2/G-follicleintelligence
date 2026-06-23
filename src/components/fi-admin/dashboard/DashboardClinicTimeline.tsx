import Link from "next/link";

import { DashboardCard, SectionHeader } from "@/src/components/fi-admin/dashboard-ui";
import { DashboardEmptyState } from "@/src/components/fi-admin/dashboard/DashboardEmptyState";
import { buildTodayTimeline } from "@/src/lib/fiAdmin/dashboardCommandCentreDerive";
import type { TenantOperationalDashboard } from "@/src/lib/fiOs/tenantOperationalDashboardLoader.server";

export function DashboardClinicTimeline(props: { base: string; data: TenantOperationalDashboard }) {
  const { base, data } = props;
  const entries = buildTodayTimeline({
    tenantId: data.tenantId,
    base,
    operationalDay: data.operationalDay,
    agendaByBucket: data.agendaByBucket,
    paymentCommercialKpis: data.paymentCommercialKpis,
  });

  return (
    <DashboardCard className="p-4 sm:p-5" role="region" aria-labelledby="dash-clinic-timeline-heading">
      <SectionHeader
        id="dash-clinic-timeline-heading"
        kicker="Today"
        title="Today’s clinic timeline"
        description="Chronological view of today’s patient flow, appointments, and payment milestones."
      />
      {entries.length === 0 ? (
        <DashboardEmptyState
          className="mt-4 max-w-xl py-5 sm:px-6 sm:py-6"
          title="No scheduled activity yet"
          description="Today’s timeline will populate as bookings and arrivals are recorded."
          actionLabel="Open Calendar"
          actionHref={`${base}/calendar`}
        />
      ) : (
        <ol className="relative mt-5 space-y-0 border-l border-cyan-500/15 pl-4 sm:pl-5">
          {entries.map((entry) => (
            <li key={entry.id} className="relative pb-5 last:pb-0">
              <span
                className="absolute -left-[1.34rem] top-1.5 h-2.5 w-2.5 rounded-full border border-cyan-400/40 bg-[#0c1426] sm:-left-[1.46rem]"
                aria-hidden
              />
              <div className="flex flex-col gap-0.5 sm:flex-row sm:items-baseline sm:gap-4">
                <time className="shrink-0 font-mono text-xs font-semibold tabular-nums text-cyan-400/90">{entry.timeLabel}</time>
                <div className="min-w-0">
                  {entry.href ? (
                    <Link href={entry.href} className="text-sm font-medium text-slate-200 hover:text-cyan-100 hover:underline">
                      {entry.title}
                    </Link>
                  ) : (
                    <span className="text-sm font-medium text-slate-200">{entry.title}</span>
                  )}
                  <p className="text-xs text-slate-500">{entry.detail}</p>
                </div>
              </div>
            </li>
          ))}
        </ol>
      )}
    </DashboardCard>
  );
}
