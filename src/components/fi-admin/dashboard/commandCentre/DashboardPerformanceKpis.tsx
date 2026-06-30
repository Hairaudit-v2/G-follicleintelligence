import Link from "next/link";

import { cn } from "@/lib/utils";
import { DashboardCard, SectionHeader } from "@/src/components/fi-admin/dashboard-ui";
import type { PerformanceKpi } from "@/src/lib/fiAdmin/dashboardCommandCentreDerive";

export function DashboardPerformanceKpis(props: { kpis: readonly PerformanceKpi[] }) {
  const { kpis } = props;

  return (
    <DashboardCard className="p-4 sm:p-5" role="region" aria-labelledby="performance-kpis-heading">
      <SectionHeader
        id="performance-kpis-heading"
        kicker="Performance"
        title="Operational performance"
        description="High-level clinic signals — not a substitute for AnalyticsOS."
      />
      <div className="mt-4 grid grid-cols-2 gap-2 lg:grid-cols-4">
        {kpis.map((kpi) => (
          <Link
            key={kpi.id}
            href={kpi.href}
            className={cn(
              "flex min-w-0 flex-col rounded-xl border border-white/[0.07] bg-[#0c1426]/70 px-3 py-3 shadow-inner shadow-black/20 backdrop-blur-sm transition",
              "hover:border-cyan-500/25 hover:bg-[#141c33]/80"
            )}
          >
            <p className="truncate text-[0.62rem] font-semibold uppercase tracking-[0.16em] text-slate-500">
              {kpi.label}
            </p>
            <p className="mt-2 font-mono text-xl font-semibold tabular-nums tracking-tight text-slate-50">
              {kpi.value}
            </p>
            <p className="mt-1 text-[0.65rem] leading-relaxed text-slate-600">{kpi.detail}</p>
          </Link>
        ))}
      </div>
    </DashboardCard>
  );
}
