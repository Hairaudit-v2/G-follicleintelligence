import Link from "next/link";
import { Percent, Scissors, Stethoscope, TrendingUp } from "lucide-react";

import { cn } from "@/lib/utils";
import { DashboardCard, SectionHeader } from "@/src/components/fi-admin/dashboard-ui";
import { buildPerformanceKpis } from "@/src/lib/fiAdmin/dashboardCommandCentreDerive";
import type { TenantOperationalDashboard } from "@/src/lib/fiOs/tenantOperationalDashboardLoader.server";

const KPI_ICONS: Record<string, React.ReactNode> = {
  conversion: <Percent className="h-4 w-4" />,
  procedure_readiness: <Scissors className="h-4 w-4" />,
  revenue_today: <TrendingUp className="h-4 w-4" />,
  active_journeys: <Stethoscope className="h-4 w-4" />,
};

export function DashboardOperationalPerformance(props: {
  base: string;
  data: TenantOperationalDashboard;
}) {
  const { base, data } = props;
  const kpis = buildPerformanceKpis({
    base,
    quickStats: data.quickStats,
    launchControl: data.launchControl,
    actionCentre: data.actionCentre,
    paymentCommercialKpis: data.paymentCommercialKpis,
  });

  return (
    <DashboardCard className="p-4 sm:p-5" role="region" aria-labelledby="dash-performance-heading">
      <SectionHeader
        id="dash-performance-heading"
        kicker="Performance"
        title="Operational performance"
        description="Four high-level signals — detailed analytics live in AnalyticsOS."
      />
      <div className="mt-4 grid grid-cols-1 gap-3 sm:grid-cols-2 xl:grid-cols-4">
        {kpis.map((kpi) => (
          <Link
            key={kpi.id}
            href={kpi.href}
            className={cn(
              "flex min-w-0 flex-col rounded-xl border border-white/[0.07] bg-[#0c1426]/70 px-4 py-4 shadow-inner shadow-black/20 backdrop-blur-sm transition",
              "hover:border-cyan-500/25 hover:bg-[#141c33]/80"
            )}
          >
            <div className="flex items-center gap-2">
              <span className="text-cyan-400/90" aria-hidden>
                {KPI_ICONS[kpi.id]}
              </span>
              <p className="truncate text-[0.62rem] font-semibold uppercase tracking-[0.16em] text-slate-500">
                {kpi.label}
              </p>
            </div>
            <p className="mt-3 font-mono text-2xl font-semibold tabular-nums tracking-tight text-slate-50">
              {kpi.value}
            </p>
            <p className="mt-1 text-[0.65rem] leading-relaxed text-slate-600">{kpi.detail}</p>
          </Link>
        ))}
      </div>
    </DashboardCard>
  );
}
