import Link from "next/link";
import { ShieldCheck } from "lucide-react";

import { DashboardActionCentre } from "@/src/components/fi-admin/dashboard/DashboardActionCentre";
import { DashboardClinicToday } from "@/src/components/fi-admin/dashboard/DashboardClinicToday";
import { DashboardTodayAgenda } from "@/src/components/fi-admin/dashboard/DashboardTodayAgenda";
import { DashboardCard, SectionHeader, StatCard } from "@/src/components/fi-admin/dashboard-ui";
import { OperationsCrmPipelineSnapshot } from "@/src/components/fi-admin/operations/OperationsCrmPipelineSnapshot";
import { OperationsTodayPatientFlow } from "@/src/components/fi-admin/operations/OperationsTodayPatientFlow";
import { countDistinctLeadBookingsOnOperationalDay } from "@/src/components/fi-admin/operations/operationsAgendaDayStats";
import { cn } from "@/lib/utils";
import { agendaBucketCountsForOperationalDay } from "@/src/lib/fiAdmin/operationsCentrePresentation";
import type { TenantOperationalDashboard } from "@/src/lib/fiOs/tenantOperationalDashboardLoader.server";

function DiagnosticAttentionLink(props: {
  href: string;
  title: string;
  description: string;
  count: number;
  alert?: boolean;
}) {
  const { href, title, description, count, alert = count > 0 } = props;
  return (
    <Link
      href={href}
      className={cn(
        "flex items-center justify-between gap-3 rounded-xl border px-4 py-3 transition",
        alert
          ? "border-amber-500/25 bg-amber-500/[0.06] hover:border-amber-400/40"
          : "border-white/[0.08] bg-white/[0.03] hover:border-[#22C1FF]/30"
      )}
    >
      <div className="min-w-0">
        <p className="text-sm font-semibold text-[#F8FAFC]">{title}</p>
        <p className="mt-0.5 text-xs text-[#94A3B8]">{description}</p>
      </div>
      <span className="shrink-0 rounded-lg bg-white/[0.04] px-3 py-1 font-mono text-lg font-semibold tabular-nums text-[#94A3B8]">
        {count}
      </span>
    </Link>
  );
}

export function OperationsSystemDiagnostics({
  data,
  showCrmNav,
  showDiagnosticsExpanded = false,
}: {
  data: TenantOperationalDashboard;
  showCrmNav: boolean;
  showDiagnosticsExpanded?: boolean;
}) {
  const base = `/fi-admin/${data.tenantId}`;
  const crmHref = showCrmNav ? `${base}/crm` : `${base}/calendar`;
  const bucketCounts = agendaBucketCountsForOperationalDay(data);
  const leadBookingsToday = countDistinctLeadBookingsOnOperationalDay(
    data.agendaByBucket,
    data.operationalDay.todayYmd,
    data.operationalDay.calendarTimezone
  );
  const ac = data.actionCentre;

  return (
    <details
      className="rounded-2xl border border-white/[0.08] bg-[#0c1220]/60 backdrop-blur-sm"
      open={showDiagnosticsExpanded}
    >
      <summary className="cursor-pointer list-none px-5 py-4 sm:px-6 sm:py-5 [&::-webkit-details-marker]:hidden">
        <div className="flex items-start justify-between gap-4">
          <div>
            <p className="text-xs font-semibold uppercase tracking-[0.18em] text-[#64748B]">
              Operators
            </p>
            <h2 className="mt-1 text-lg font-semibold text-[#F8FAFC]">System diagnostics</h2>
            <p className="mt-1 max-w-3xl text-sm text-[#94A3B8]">
              For platform operators only. These checks support platform integrity and do not affect
              day-to-day clinic coordination.
            </p>
          </div>
          <span className="shrink-0 text-xs font-medium text-[#22C1FF]/80">
            {showDiagnosticsExpanded ? "Collapse" : "Expand"}
          </span>
        </div>
      </summary>

      <div className="space-y-6 border-t border-white/[0.06] px-5 py-5 sm:px-6 sm:py-6">
        <DashboardCard className="border-white/[0.06] bg-[#0c1220]/40 p-4 sm:p-5">
          <SectionHeader
            title="Operational day"
            description="Loader window and agenda bucket counts for this tenant."
            className="mb-3"
          />
          <p className="text-xs text-[#94A3B8]">
            Day: <span className="font-mono text-[#CBD5E1]">{data.operationalDay.todayYmd}</span> ·
            TZ:{" "}
            <span className="font-mono text-[#CBD5E1]">{data.operationalDay.calendarTimezone}</span>
          </p>
          <div className="mt-3 grid grid-cols-2 gap-3 sm:grid-cols-4">
            <StatCard label="Consult" value={bucketCounts.consult} />
            <StatCard label="Surgery" value={bucketCounts.surgery} />
            <StatCard label="Follow-up" value={bucketCounts.follow_up} />
            <StatCard label="Other" value={bucketCounts.other} />
          </div>
        </DashboardCard>

        <DashboardCard className="border-white/[0.06] bg-[#0c1220]/40 p-4 sm:p-5">
          <SectionHeader
            title="Front desk counts"
            description="Same operational dashboard payload as tenant home."
            className="mb-3"
          />
          <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-5">
            <StatCard label="Lead bookings today" value={leadBookingsToday} />
            <StatCard label="New leads today" value={data.quickStats.newLeadsToday} />
            <StatCard label="Consultations today" value={data.clinicToday.consultations} />
            <StatCard label="Surgeries today" value={data.clinicToday.surgeries} />
            <StatCard label="Tasks due" value={data.launchControl.openTasks} />
          </div>
        </DashboardCard>

        <DashboardCard className="border-white/[0.06] bg-[#0c1220]/40 p-4 sm:p-5">
          <SectionHeader
            title="Recorded payment status"
            description="Internal payment row counts."
            className="mb-3"
          />
          <div className="grid grid-cols-2 gap-3 sm:grid-cols-3">
            <StatCard label="Deposits due" value={data.paymentCommercialKpis.depositsDueCount} />
            <StatCard
              label="Deposits paid today"
              value={data.paymentCommercialKpis.depositsPaidTodayCount}
            />
            <StatCard
              label="Overdue payments"
              value={data.paymentCommercialKpis.overduePaymentsCount}
            />
          </div>
        </DashboardCard>

        <div className="space-y-4">
          <DashboardActionCentre base={base} actionCentre={ac} showCrmNav={showCrmNav} />
          <DashboardClinicToday base={base} clinicToday={data.clinicToday} />
          <OperationsTodayPatientFlow base={base} data={data} />
        </div>

        <DashboardTodayAgenda
          tenantId={data.tenantId}
          agendaRange={data.agendaRange}
          agendaByBucket={data.agendaByBucket}
          variant="launch"
        />

        <OperationsCrmPipelineSnapshot base={base} showCrmNav={showCrmNav} data={data} />

        <DashboardCard className="border-white/[0.06] bg-[#0c1220]/40 p-4 sm:p-5">
          <SectionHeader
            title="FinancialOS attention counts"
            description="14-day surgery window and pathway SLAs — open FinancialOS for full workflow."
            className="mb-3"
          />
          <div className="space-y-2">
            <DiagnosticAttentionLink
              href={`${base}/surgery-readiness`}
              title="Surgery readiness alerts"
              description="Surgery bookings without linked cases."
              count={ac.surgeryReadinessAlerts}
            />
            <DiagnosticAttentionLink
              href={`${base}/financial/invoices`}
              title="Surgery payment attention"
              description="Payment follow-up for upcoming surgeries."
              count={ac.surgeryFinancialPaymentAttention}
            />
            <DiagnosticAttentionLink
              href={`${base}/financial/pathway-inbox`}
              title="Pathway workflow tasks"
              description="Non-standard payment pathway inbox."
              count={ac.financialPathwayTasksAttention}
            />
            <DiagnosticAttentionLink
              href={`${base}/financial/finance-applications`}
              title="Finance applications"
              description="Medical finance application SLAs."
              count={ac.financeApplicationsAttention}
            />
            <DiagnosticAttentionLink
              href={`${base}/financial/super-release`}
              title="Super release applications"
              description="Super release workflow SLAs."
              count={ac.superReleaseApplicationsAttention}
            />
            <DiagnosticAttentionLink
              href={`${base}/financial/international-transfers`}
              title="International transfers"
              description="International transfer workflow SLAs."
              count={ac.internationalTransferApplicationsAttention}
            />
            <DiagnosticAttentionLink
              href={`${base}/financial/dashboard`}
              title="Financial clearance"
              description="Unified clearance engine attention."
              count={ac.financialClearanceAttention}
            />
          </div>
          <p className="mt-3">
            <Link
              href={`${base}/financial/dashboard`}
              className="text-sm font-semibold text-[#22C1FF] hover:underline"
            >
              Open FinancialOS →
            </Link>
            {" · "}
            <Link href={crmHref} className="text-sm font-semibold text-[#22C1FF] hover:underline">
              Open LeadFlow →
            </Link>
          </p>
        </DashboardCard>

        <p className="flex items-center gap-2 text-xs text-[#64748B]">
          <ShieldCheck className="h-3.5 w-3.5 shrink-0 text-[#22C1FF]/70" aria-hidden />
          Diagnostics are read-only observability — day-of clinic coordination is unaffected.
        </p>
      </div>
    </details>
  );
}
