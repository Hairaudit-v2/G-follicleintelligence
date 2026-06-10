import Link from "next/link";
import type { ReactNode } from "react";
import { ClipboardList, Scissors, Stethoscope, UserCircle2, UserPlus } from "lucide-react";

import { cn } from "@/lib/utils";
import { DashboardActionCentre } from "@/src/components/fi-admin/dashboard/DashboardActionCentre";
import { DashboardClinicToday } from "@/src/components/fi-admin/dashboard/DashboardClinicToday";
import { DashboardTodayAgenda } from "@/src/components/fi-admin/dashboard/DashboardTodayAgenda";
import { DashboardCard, SectionHeader } from "@/src/components/fi-admin/dashboard-ui";
import { OperationsCrmPipelineSnapshot } from "@/src/components/fi-admin/operations/OperationsCrmPipelineSnapshot";
import { OperationsTodayPatientFlow } from "@/src/components/fi-admin/operations/OperationsTodayPatientFlow";
import { countDistinctLeadBookingsOnOperationalDay } from "@/src/components/fi-admin/operations/operationsAgendaDayStats";
import { fiOsChromeClasses } from "@/src/components/fi-os/fiOsChromeTokens";
import type { TenantOperationalDashboard } from "@/src/lib/fiOs/tenantOperationalDashboardLoader.server";

function TopMetricLink(props: {
  href: string;
  label: string;
  value: number | string;
  foot?: string;
  icon: ReactNode;
}) {
  const { href, label, value, foot, icon } = props;
  return (
    <Link
      href={href}
      className={cn(
        "flex min-w-0 flex-col rounded-xl border border-white/[0.07] bg-[#0c1426]/70 px-3 py-3 shadow-inner shadow-black/20 backdrop-blur-sm transition",
        "hover:border-cyan-500/25 hover:bg-[#141c33]/80",
      )}
    >
      <div className="flex items-center gap-2">
        <span className="text-cyan-400/90" aria-hidden>
          {icon}
        </span>
        <p className="truncate text-[0.62rem] font-semibold uppercase tracking-[0.16em] text-slate-500">{label}</p>
      </div>
      <p className="mt-2 font-mono text-xl font-semibold tabular-nums tracking-tight text-slate-50">{value}</p>
      {foot ? <p className="mt-1 text-[0.65rem] leading-snug text-slate-600">{foot}</p> : null}
    </Link>
  );
}

/**
 * ClinicOS Operations Centre — tenant operational dashboard composition (single `loadTenantOperationalDashboard` fetch).
 */
export function ClinicOsOperationsCentre(props: {
  data: TenantOperationalDashboard;
  showCrmNav: boolean;
}) {
  const { data, showCrmNav } = props;
  const base = `/fi-admin/${data.tenantId}`;
  const crmHref = showCrmNav ? `${base}/crm` : `${base}/calendar`;
  const tasksHref = showCrmNav ? `${base}/crm` : `${base}/calendar`;

  const now = new Date();
  const dateLine = new Intl.DateTimeFormat(undefined, {
    weekday: "long",
    month: "long",
    day: "numeric",
    year: "numeric",
  }).format(now);

  const leadBookingsToday = countDistinctLeadBookingsOnOperationalDay(
    data.agendaByBucket,
    data.operationalDay.todayYmd,
    data.operationalDay.calendarTimezone
  );

  return (
    <div className="space-y-6 pb-8 sm:space-y-7">
      <header className="flex flex-col gap-3 border-b border-white/[0.07] pb-5 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <p className="text-xs font-semibold uppercase tracking-[0.28em] text-cyan-400/85">ClinicOS · Operations centre</p>
          <h1 className="mt-1.5 text-xl font-semibold tracking-tight text-slate-50 sm:text-2xl">{data.tenantName}</h1>
          <p className="mt-1 text-sm text-slate-500">{dateLine}</p>
        </div>
        <div className="flex flex-wrap items-center gap-2 sm:justify-end">
          <Link
            href={`${base}/reception`}
            className={cn(
              fiOsChromeClasses.toolbarControlSurface,
              "inline-flex items-center gap-2 px-3 py-2 text-sm font-semibold text-cyan-100/95",
            )}
          >
            Open reception board
          </Link>
          <Link
            href={base}
            className={cn(
              fiOsChromeClasses.toolbarControlSurface,
              "inline-flex items-center gap-2 px-3 py-2 text-sm font-semibold text-slate-200",
            )}
          >
            Back to dashboard
          </Link>
        </div>
      </header>

      <DashboardCard className="p-4 sm:p-5" role="region" aria-labelledby="ops-today-kpis-heading">
        <SectionHeader
          id="ops-today-kpis-heading"
          kicker="Today"
          title="Front desk pulse"
          description="Counts reuse the same operational dashboard payload as tenant home (one loader round-trip)."
          className="mb-4"
        />
        <div className="grid grid-cols-2 gap-2 lg:grid-cols-5">
          <TopMetricLink
            href={crmHref}
            label="Lead bookings today"
            value={leadBookingsToday}
            foot="Distinct leads with a booking starting today (agenda rows, tenant calendar day)."
            icon={<UserCircle2 className="h-3.5 w-3.5" aria-hidden />}
          />
          <TopMetricLink
            href={crmHref}
            label="New leads today"
            value={data.quickStats.newLeadsToday}
            foot="CRM leads created today in the tenant operational calendar day."
            icon={<UserPlus className="h-3.5 w-3.5" aria-hidden />}
          />
          <TopMetricLink
            href={`${base}/calendar`}
            label="Consultations today"
            value={data.clinicToday.consultations}
            foot="Scheduled consultation-type visits today."
            icon={<Stethoscope className="h-3.5 w-3.5" aria-hidden />}
          />
          <TopMetricLink
            href={`${base}/calendar`}
            label="Surgeries today"
            value={data.clinicToday.surgeries}
            foot="Scheduled surgery-type visits today."
            icon={<Scissors className="h-3.5 w-3.5" aria-hidden />}
          />
          <TopMetricLink
            href={tasksHref}
            label="Tasks due"
            value={data.launchControl.openTasks}
            foot="Active CRM tasks visible to you (same filter as home launch control)."
            icon={<ClipboardList className="h-3.5 w-3.5" aria-hidden />}
          />
        </div>
      </DashboardCard>

      <div className="grid grid-cols-1 gap-4 xl:grid-cols-12 xl:gap-5">
        <div className="min-w-0 space-y-4 xl:col-span-5">
          <DashboardTodayAgenda
            tenantId={data.tenantId}
            agendaRange={data.agendaRange}
            agendaByBucket={data.agendaByBucket}
            variant="launch"
          />
        </div>
        <div className="space-y-4 xl:col-span-4">
          <DashboardClinicToday base={base} clinicToday={data.clinicToday} />
          <OperationsTodayPatientFlow base={base} data={data} />
        </div>
        <div className="space-y-4 xl:col-span-3">
          <DashboardActionCentre base={base} actionCentre={data.actionCentre} showCrmNav={showCrmNav} />
        </div>
      </div>

      <div className="grid grid-cols-1 gap-4 lg:grid-cols-2 lg:gap-5">
        <DashboardCard className="p-4 sm:p-5" role="region" aria-labelledby="ops-surgery-readiness-heading">
          <SectionHeader
            id="ops-surgery-readiness-heading"
            kicker="SurgeryOS"
            title="Surgery readiness"
            description="Open the 14-day Surgery readiness board — pathology, consent proxy, confirmations, and case linkage."
            className="mb-4"
          />
          <Link
            href={`${base}/surgery-readiness`}
            className={cn(
              "flex items-center justify-between gap-3 rounded-xl border px-4 py-4 transition",
              data.actionCentre.surgeryReadinessAlerts > 0
                ? "border-amber-500/25 bg-amber-500/[0.06] hover:border-amber-400/40 hover:bg-amber-500/10"
                : "border-white/[0.08] bg-white/[0.03] hover:border-cyan-500/30 hover:bg-cyan-500/[0.06]",
            )}
          >
            <div className="min-w-0">
              <p className="text-sm font-semibold text-slate-100">Surgery readiness board</p>
              <p className="mt-0.5 text-xs text-slate-500">Cases missing for booked procedures (next 30 days) — tap for full board</p>
            </div>
            <span
              className={cn(
                "shrink-0 rounded-lg px-3 py-1.5 font-mono text-lg font-semibold tabular-nums",
                data.actionCentre.surgeryReadinessAlerts > 0 ? "bg-amber-500/15 text-amber-100" : "bg-white/[0.04] text-slate-500",
              )}
            >
              {data.actionCentre.surgeryReadinessAlerts}
            </span>
          </Link>
        </DashboardCard>

        <OperationsCrmPipelineSnapshot base={base} showCrmNav={showCrmNav} data={data} />
      </div>
    </div>
  );
}
