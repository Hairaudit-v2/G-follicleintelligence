import Link from "next/link";
import { Calendar } from "lucide-react";

import { cn } from "@/lib/utils";
import type { TenantOperationalDashboard } from "@/src/lib/fiOs/tenantOperationalDashboardLoader.server";
import { DashboardActionCentre } from "@/src/components/fi-admin/dashboard/DashboardActionCentre";
import { DashboardClinicMetrics } from "@/src/components/fi-admin/dashboard/DashboardClinicMetrics";
import { DashboardClinicToday } from "@/src/components/fi-admin/dashboard/DashboardClinicToday";
import { DashboardPrimaryActions } from "@/src/components/fi-admin/dashboard/DashboardPrimaryActions";
import { DashboardTodayAgenda } from "@/src/components/fi-admin/dashboard/DashboardTodayAgenda";
import { TenantHomeQuickCallIn } from "@/src/components/fi-admin/TenantHomeQuickCallIn";
import { fiOsChromeClasses } from "@/src/components/fi-os/fiOsChromeTokens";

/**
 * FI OS tenant home — clinic operating centre (agenda-first, premium glass layout).
 */
export function FiOsControlCentreHome(props: {
  data: TenantOperationalDashboard;
  showCrmNav: boolean;
  showBookingsBoard: boolean;
}) {
  const { data, showCrmNav, showBookingsBoard } = props;
  const base = `/fi-admin/${data.tenantId}`;

  const now = new Date();
  const dateLine = new Intl.DateTimeFormat(undefined, {
    weekday: "long",
    month: "long",
    day: "numeric",
    year: "numeric",
  }).format(now);

  return (
    <div className="space-y-6 pb-8 sm:space-y-7">
      <header className="flex flex-col gap-3 border-b border-white/[0.07] pb-5 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <p className="text-xs font-semibold uppercase tracking-[0.28em] text-cyan-400/85">Clinic operating centre</p>
          <h1 className="mt-1.5 text-xl font-semibold tracking-tight text-slate-50 sm:text-2xl">{data.tenantName}</h1>
          <p className="mt-1 text-sm text-slate-500">{dateLine}</p>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          {data.canQuickCallIn ? <TenantHomeQuickCallIn tenantId={data.tenantId} /> : null}
          <Link
            href={`${base}/calendar`}
            className={cn(
              fiOsChromeClasses.toolbarControlSurface,
              "inline-flex items-center gap-2 px-3 py-2 text-sm font-semibold text-cyan-50",
            )}
          >
            <Calendar className="h-4 w-4 text-cyan-400" aria-hidden />
            Full calendar
          </Link>
        </div>
      </header>

      <DashboardPrimaryActions base={base} showCrmNav={showCrmNav} showBookingsBoard={showBookingsBoard} />

      <div className="grid grid-cols-1 gap-4 xl:grid-cols-12 xl:gap-5">
        <div className="space-y-4 xl:col-span-5">
          <DashboardClinicToday base={base} clinicToday={data.clinicToday} />
          <DashboardActionCentre base={base} actionCentre={data.actionCentre} showCrmNav={showCrmNav} />
        </div>

        <div className="min-w-0 xl:col-span-7">
          <DashboardTodayAgenda
            tenantId={data.tenantId}
            agendaRange={data.agendaRange}
            agendaByBucket={data.agendaByBucket}
            variant="launch"
          />
        </div>
      </div>

      <DashboardClinicMetrics base={base} quickStats={data.quickStats} launchControl={data.launchControl} />
    </div>
  );
}
