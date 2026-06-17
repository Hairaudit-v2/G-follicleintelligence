import Link from "next/link";
import type { ReactNode } from "react";
import { Banknote, ClipboardList, Scissors, Stethoscope, UserCircle2, UserPlus } from "lucide-react";

import { cn } from "@/lib/utils";
import { DashboardActionCentre } from "@/src/components/fi-admin/dashboard/DashboardActionCentre";
import { DashboardClinicToday } from "@/src/components/fi-admin/dashboard/DashboardClinicToday";
import { DashboardTodayAgenda } from "@/src/components/fi-admin/dashboard/DashboardTodayAgenda";
import { DashboardCard, SectionHeader } from "@/src/components/fi-admin/dashboard-ui";
import { OperationsCrmPipelineSnapshot } from "@/src/components/fi-admin/operations/OperationsCrmPipelineSnapshot";
import { OperationsTodayPatientFlow } from "@/src/components/fi-admin/operations/OperationsTodayPatientFlow";
import { countDistinctLeadBookingsOnOperationalDay } from "@/src/components/fi-admin/operations/operationsAgendaDayStats";
import { fiOsChromeClasses } from "@/src/components/fi-os/fiOsChromeTokens";
import { formatCalendarLongWeekdayDate } from "@/src/lib/calendar/calendarTimezone";
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

  const tz = data.operationalDay.calendarTimezone.trim();
  const dateLine = formatCalendarLongWeekdayDate(data.operationalDay.todayYmd, tz);
  const operationalKey = `${data.operationalDay.todayYmd} · ${tz}`;

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
          <p className="mt-0.5 text-xs text-slate-600">
            Operational day <span className="font-mono text-slate-400">{operationalKey}</span>
          </p>
        </div>
        <div className="flex flex-wrap items-center gap-2 sm:justify-end">
          <Link
            href={`${base}/tomorrow`}
            className={cn(
              fiOsChromeClasses.toolbarControlSurface,
              "inline-flex items-center gap-2 px-3 py-2 text-sm font-semibold text-cyan-100/95",
            )}
          >
            Tomorrow board
          </Link>
          <Link
            href={`${base}/reception`}
            className={cn(
              fiOsChromeClasses.toolbarControlSurface,
              "inline-flex items-center gap-2 px-3 py-2 text-sm font-semibold text-cyan-100/95",
            )}
          >
            Reception board
          </Link>
          <Link
            href={`${base}/consultation-conversion`}
            className={cn(
              fiOsChromeClasses.toolbarControlSurface,
              "inline-flex items-center gap-2 px-3 py-2 text-sm font-semibold text-slate-200",
            )}
          >
            Conversion board
          </Link>
          <Link
            href={`${base}/surgery-readiness`}
            className={cn(
              fiOsChromeClasses.toolbarControlSurface,
              "inline-flex items-center gap-2 px-3 py-2 text-sm font-semibold text-slate-200",
            )}
          >
            Surgery readiness
          </Link>
          <Link
            href={`${base}/procedure-day`}
            className={cn(
              fiOsChromeClasses.toolbarControlSurface,
              "inline-flex items-center gap-2 px-3 py-2 text-sm font-semibold text-slate-200",
            )}
          >
            Procedure day
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

      <DashboardCard className="p-4 sm:p-5" role="region" aria-labelledby="ops-payment-kpis-heading">
        <SectionHeader
          id="ops-payment-kpis-heading"
          kicker="Manual tracking"
          title="Recorded payment status"
          description="Counts come from internal payment rows — not POS, not Stripe, not integrated billing."
          className="mb-4"
        />
        <div className="grid grid-cols-2 gap-2 lg:grid-cols-3">
          <TopMetricLink
            href={`${base}/surgery-readiness`}
            label="Deposits due"
            value={data.paymentCommercialKpis.depositsDueCount}
            foot="Rows still expecting funds (pending / partial / overdue)."
            icon={<Banknote className="h-3.5 w-3.5" aria-hidden />}
          />
          <TopMetricLink
            href={`${base}/consultation-conversion`}
            label="Deposits paid today"
            value={data.paymentCommercialKpis.depositsPaidTodayCount}
            foot="Rows marked paid with an update timestamp in today’s operational window (best-effort)."
            icon={<Banknote className="h-3.5 w-3.5" aria-hidden />}
          />
          <TopMetricLink
            href={`${base}/surgery-readiness`}
            label="Overdue payments"
            value={data.paymentCommercialKpis.overduePaymentsCount}
            foot="Stored overdue or past-due pending / partial rows (tenant calendar day)."
            icon={<Banknote className="h-3.5 w-3.5" aria-hidden />}
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
        <div className="space-y-4">
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
                <p className="mt-0.5 text-xs text-slate-500">
                  Active surgery bookings in the next 14 days without a linked SurgeryOS case — same window as the readiness
                  board; tap for full view.
                </p>
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

          <DashboardCard className="p-4 sm:p-5" role="region" aria-labelledby="ops-surgery-financial-heading">
            <SectionHeader
              id="ops-surgery-financial-heading"
              kicker="FinancialOS"
              title="Surgery revenue attention"
              description="Same 14-day surgery window as readiness — unpaid deposits, balance due soon, overdue balances, failed payments, or installment slips."
              className="mb-4"
            />
            <div className="flex flex-col gap-3">
              <Link
                href={`${base}/financial/invoices`}
                className={cn(
                  "flex items-center justify-between gap-3 rounded-xl border px-4 py-4 transition",
                  data.actionCentre.surgeryFinancialPaymentAttention > 0
                    ? "border-rose-500/25 bg-rose-500/[0.07] hover:border-rose-400/40 hover:bg-rose-500/12"
                    : "border-white/[0.08] bg-white/[0.03] hover:border-cyan-500/30 hover:bg-cyan-500/[0.06]",
                )}
              >
                <div className="min-w-0">
                  <p className="text-sm font-semibold text-slate-100">Payment attention (surgery dates)</p>
                  <p className="mt-0.5 text-xs text-slate-500">
                    Open invoices — follow up before procedure day when deposits, balances, installments, or failed card
                    attempts need staff action.
                  </p>
                </div>
                <span
                  className={cn(
                    "shrink-0 rounded-lg px-3 py-1.5 font-mono text-lg font-semibold tabular-nums",
                    data.actionCentre.surgeryFinancialPaymentAttention > 0
                      ? "bg-rose-500/15 text-rose-100"
                      : "bg-white/[0.04] text-slate-500",
                  )}
                >
                  {data.actionCentre.surgeryFinancialPaymentAttention}
                </span>
              </Link>
              <Link
                href={`${base}/financial/payment-requests`}
                className="text-xs font-semibold text-cyan-400/90 hover:text-cyan-300"
              >
                Payment requests →
              </Link>
            </div>
          </DashboardCard>

          <DashboardCard className="p-4 sm:p-5" role="region" aria-labelledby="ops-pathway-tasks-heading">
            <SectionHeader
              id="ops-pathway-tasks-heading"
              kicker="FinancialOS"
              title="Financial pathway tasks requiring attention"
              description="Open operational inbox tasks for non-standard payment pathways — medical finance, super release, transfers, installments, and manual settlement."
              className="mb-4"
            />
            <Link
              href={`${base}/financial/pathway-inbox`}
              className={cn(
                "flex items-center justify-between gap-3 rounded-xl border px-4 py-4 transition",
                data.actionCentre.financialPathwayTasksAttention > 0
                  ? "border-amber-500/25 bg-amber-500/[0.07] hover:border-amber-400/40 hover:bg-amber-500/12"
                  : "border-white/[0.08] bg-white/[0.03] hover:border-cyan-500/30 hover:bg-cyan-500/[0.06]",
              )}
            >
              <div className="min-w-0">
                <p className="text-sm font-semibold text-slate-100">Pathway workflow tasks</p>
                <p className="mt-0.5 text-xs text-slate-500">Staff inbox for pathway review before financial clearance.</p>
              </div>
              <span
                className={cn(
                  "shrink-0 rounded-lg px-3 py-1.5 font-mono text-lg font-semibold tabular-nums",
                  data.actionCentre.financialPathwayTasksAttention > 0
                    ? "bg-amber-500/15 text-amber-100"
                    : "bg-white/[0.04] text-slate-500",
                )}
              >
                {data.actionCentre.financialPathwayTasksAttention}
              </span>
            </Link>
          </DashboardCard>

          <DashboardCard className="p-4 sm:p-5" role="region" aria-labelledby="ops-finance-applications-heading">
            <SectionHeader
              id="ops-finance-applications-heading"
              kicker="FinancialOS"
              title="Finance applications requiring attention"
              description="Document, approval, and settlement SLAs for medical finance applications — no live provider APIs in Phase 3."
              className="mb-4"
            />
            <Link
              href={`${base}/financial/finance-applications`}
              className={cn(
                "flex items-center justify-between gap-3 rounded-xl border px-4 py-4 transition",
                data.actionCentre.financeApplicationsAttention > 0
                  ? "border-amber-500/25 bg-amber-500/[0.07] hover:border-amber-400/40 hover:bg-amber-500/12"
                  : "border-white/[0.08] bg-white/[0.03] hover:border-cyan-500/30 hover:bg-cyan-500/[0.06]",
              )}
            >
              <div className="min-w-0">
                <p className="text-sm font-semibold text-slate-100">Financing workflow</p>
                <p className="mt-0.5 text-xs text-slate-500">Applications pending docs, approval, or settlement follow-up.</p>
              </div>
              <span
                className={cn(
                  "shrink-0 rounded-lg px-3 py-1.5 font-mono text-lg font-semibold tabular-nums",
                  data.actionCentre.financeApplicationsAttention > 0
                    ? "bg-amber-500/15 text-amber-100"
                    : "bg-white/[0.04] text-slate-500",
                )}
              >
                {data.actionCentre.financeApplicationsAttention}
              </span>
            </Link>
          </DashboardCard>

          <DashboardCard className="p-4 sm:p-5" role="region" aria-labelledby="ops-super-release-heading">
            <SectionHeader
              id="ops-super-release-heading"
              kicker="FinancialOS"
              title="Super Release Applications Requiring Attention"
              description="Eligibility, documents, clinical letters, approval, and funds release SLAs for super release applications — no live provider APIs in Phase 3B."
              className="mb-4"
            />
            <Link
              href={`${base}/financial/super-release`}
              className={cn(
                "flex items-center justify-between gap-3 rounded-xl border px-4 py-4 transition",
                data.actionCentre.superReleaseApplicationsAttention > 0
                  ? "border-amber-500/25 bg-amber-500/[0.07] hover:border-amber-400/40 hover:bg-amber-500/12"
                  : "border-white/[0.08] bg-white/[0.03] hover:border-cyan-500/30 hover:bg-cyan-500/[0.06]",
              )}
            >
              <div className="min-w-0">
                <p className="text-sm font-semibold text-slate-100">Super release workflow</p>
                <p className="mt-0.5 text-xs text-slate-500">Applications pending eligibility, docs, clinical letters, or funds release.</p>
              </div>
              <span
                className={cn(
                  "shrink-0 rounded-lg px-3 py-1.5 font-mono text-lg font-semibold tabular-nums",
                  data.actionCentre.superReleaseApplicationsAttention > 0
                    ? "bg-amber-500/15 text-amber-100"
                    : "bg-white/[0.04] text-slate-500",
                )}
              >
                {data.actionCentre.superReleaseApplicationsAttention}
              </span>
            </Link>
          </DashboardCard>

          <DashboardCard className="p-4 sm:p-5" role="region" aria-labelledby="ops-international-transfer-heading">
            <SectionHeader
              id="ops-international-transfer-heading"
              kicker="FinancialOS"
              title="International Transfers Requiring Attention"
              description="Instructions, proof, reconciliation, settlement, and FX variance SLAs for international transfer applications — no live Wise/bank/SWIFT APIs in Phase 3C."
              className="mb-4"
            />
            <Link
              href={`${base}/financial/international-transfers`}
              className={cn(
                "flex items-center justify-between gap-3 rounded-xl border px-4 py-4 transition",
                data.actionCentre.internationalTransferApplicationsAttention > 0
                  ? "border-amber-500/25 bg-amber-500/[0.07] hover:border-amber-400/40 hover:bg-amber-500/12"
                  : "border-white/[0.08] bg-white/[0.03] hover:border-cyan-500/30 hover:bg-cyan-500/[0.06]",
              )}
            >
              <div className="min-w-0">
                <p className="text-sm font-semibold text-slate-100">International transfer workflow</p>
                <p className="mt-0.5 text-xs text-slate-500">Applications pending instructions, proof, reconciliation, or settlement.</p>
              </div>
              <span
                className={cn(
                  "shrink-0 rounded-lg px-3 py-1.5 font-mono text-lg font-semibold tabular-nums",
                  data.actionCentre.internationalTransferApplicationsAttention > 0
                    ? "bg-amber-500/15 text-amber-100"
                    : "bg-white/[0.04] text-slate-500",
                )}
              >
                {data.actionCentre.internationalTransferApplicationsAttention}
              </span>
            </Link>
          </DashboardCard>

          <DashboardCard className="p-4 sm:p-5" role="region" aria-labelledby="ops-financial-clearance-heading">
            <SectionHeader
              id="ops-financial-clearance-heading"
              kicker="FinancialOS"
              title="Financial Clearance Attention"
              description="Unified clearance engine for the 14-day surgery window — advisory visibility only; does not block SurgeryOS workflows."
              className="mb-4"
            />
            <Link
              href={`${base}/financial/dashboard`}
              className={cn(
                "flex items-center justify-between gap-3 rounded-xl border px-4 py-4 transition",
                data.actionCentre.financialClearanceAttention > 0
                  ? "border-rose-500/25 bg-rose-500/[0.07] hover:border-rose-400/40 hover:bg-rose-500/12"
                  : "border-white/[0.08] bg-white/[0.03] hover:border-cyan-500/30 hover:bg-cyan-500/[0.06]",
              )}
            >
              <div className="min-w-0">
                <p className="text-sm font-semibold text-slate-100">Clearance attention (surgery dates)</p>
                <p className="mt-0.5 text-xs text-slate-500">
                  Bookings where deposits, pathways, balances, installments, or workflow SLAs need resolution before procedure day.
                </p>
              </div>
              <span
                className={cn(
                  "shrink-0 rounded-lg px-3 py-1.5 font-mono text-lg font-semibold tabular-nums",
                  data.actionCentre.financialClearanceAttention > 0
                    ? "bg-rose-500/15 text-rose-100"
                    : "bg-white/[0.04] text-slate-500",
                )}
              >
                {data.actionCentre.financialClearanceAttention}
              </span>
            </Link>
          </DashboardCard>
        </div>

        <OperationsCrmPipelineSnapshot base={base} showCrmNav={showCrmNav} data={data} />
      </div>
    </div>
  );
}
