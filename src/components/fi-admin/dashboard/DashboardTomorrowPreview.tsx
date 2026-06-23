import Link from "next/link";

import { cn } from "@/lib/utils";
import { fiOsChromeClasses } from "@/src/components/fi-os/fiOsChromeTokens";
import { DashboardCard, SectionHeader } from "@/src/components/fi-admin/dashboard-ui";
import { buildTomorrowPreview } from "@/src/lib/fiAdmin/dashboardCommandCentreDerive";
import type { TenantOperationalDashboard } from "@/src/lib/fiOs/tenantOperationalDashboardLoader.server";

export function DashboardTomorrowPreview(props: { base: string; data: TenantOperationalDashboard }) {
  const { base, data } = props;
  const lines = buildTomorrowPreview({
    operationalDay: data.operationalDay,
    agendaByBucket: data.agendaByBucket,
    paymentCommercialKpis: data.paymentCommercialKpis,
  });

  return (
    <DashboardCard className="p-4 sm:p-5" role="region" aria-labelledby="dash-tomorrow-preview-heading">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
        <SectionHeader
          id="dash-tomorrow-preview-heading"
          kicker="Tomorrow"
          title="Tomorrow readiness preview"
          description="A lightweight glance at tomorrow — open Tomorrow Board for the full readiness view."
        />
        <Link
          href={`${base}/tomorrow`}
          className={cn(
            fiOsChromeClasses.toolbarControlSurface,
            "inline-flex shrink-0 items-center justify-center px-3 py-2 text-sm font-semibold text-cyan-50",
          )}
        >
          Open Tomorrow Board
        </Link>
      </div>
      {lines.length === 0 ? (
        <p className="mt-4 text-sm text-slate-500">No tomorrow signals from current bookings yet.</p>
      ) : (
        <ul className="mt-4 space-y-2">
          {lines.map((line) => (
            <li
              key={line.id}
              className="rounded-lg border border-white/[0.06] bg-white/[0.02] px-3 py-2.5 text-sm text-slate-200"
            >
              {line.text}
            </li>
          ))}
        </ul>
      )}
    </DashboardCard>
  );
}
