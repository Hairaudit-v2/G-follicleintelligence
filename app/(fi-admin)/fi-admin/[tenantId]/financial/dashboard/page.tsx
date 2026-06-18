import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";

import { cn } from "@/lib/utils";
import { FinancialOsDashboardDepositForm } from "@/src/components/fi/financial/FinancialOsDashboardDepositForm";
import {
  FinancialOsAutomationNotice,
  FinancialOsMetricTile,
  FinancialOsSectionCard,
  financialOsClasses,
} from "@/src/components/fi-admin/financial-os/financialOsUi";
import { InfoNotice } from "@/src/components/fi-admin/dashboard-ui";
import { assertFiTenantPortalAccess } from "@/src/lib/fiOs/fiOsPortalGate.server";
import { loadFinancialOsDashboardMetrics } from "@/src/lib/financialOs/financialDashboardLoader.server";
import { getPaymentRecordMutationCapability } from "@/src/lib/payments/paymentRecordAccess.server";
import { readFiPaymentsEnabled } from "@/src/lib/payments/fiPaymentEnv.server";

export const metadata: Metadata = {
  title: "FinancialOS · Dashboard",
  robots: { index: false, follow: false },
};

export const dynamic = "force-dynamic";

function fmtMoney(cents: number, currency: string): string {
  const v = cents / 100;
  return `${currency} ${v.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
}

function pct(n: number | null): string {
  if (n == null || !Number.isFinite(n)) return "—";
  return `${(n * 100).toFixed(1)}%`;
}

export default async function FinancialOsDashboardPage({ params }: { params: Promise<{ tenantId: string }> }) {
  const { tenantId } = await params;
  const tid = tenantId?.trim();
  if (!tid) notFound();
  await assertFiTenantPortalAccess(tid);
  const metrics = await loadFinancialOsDashboardMetrics(tid);
  const { canMutate } = await getPaymentRecordMutationCapability(tid);
  const paymentsEnabled = readFiPaymentsEnabled();
  const base = `/fi-admin/${tid}/financial`;

  return (
    <div className={cn(financialOsClasses.pageSection, financialOsClasses.dashboardGrid)}>
      <FinancialOsSectionCard title="Payment metrics" kicker="Revenue">
        <dl className={financialOsClasses.metricGrid}>
          <FinancialOsMetricTile
            label="Outstanding revenue"
            value={fmtMoney(metrics.outstandingRevenueCents, metrics.currency)}
            foot={`${metrics.outstandingInvoiceCount} open invoices (issued / partial / overdue)`}
          />
          <FinancialOsMetricTile
            label="Upcoming (30d)"
            value={`${metrics.upcomingPaymentRequestCount} payment links · ${metrics.upcomingInstallmentCount} installment dates`}
          />
          <FinancialOsMetricTile label="Failed gateway payments (60d)" value={metrics.failedPaymentCount} />
          <FinancialOsMetricTile
            label="Deposit conversion (90d consultation quotes)"
            value={pct(metrics.depositConversionRate)}
            foot="Share of new consultation-quote invoices with any payment recorded."
          />
          <FinancialOsMetricTile
            label="Monthly revenue forecast"
            value={
              metrics.monthlyRevenueForecastCents != null ? fmtMoney(metrics.monthlyRevenueForecastCents, metrics.currency) : "—"
            }
            foot="Average succeeded gateway totals over the prior three full months."
          />
        </dl>
      </FinancialOsSectionCard>

      <FinancialOsSectionCard
        title="Payment pathways"
        kicker="Settlement"
        description={
          <>
            Settlement intent recorded on <code className={financialOsClasses.code}>fi_payment_pathways</code> — see{" "}
            <Link href={`${base}/payment-pathways`} className={financialOsClasses.link}>
              Payment Pathways
            </Link>{" "}
            for detail and management.
          </>
        }
      >
        <dl className={financialOsClasses.metricGrid}>
          <FinancialOsMetricTile
            label="By type"
            value={
              <div className={financialOsClasses.metricList}>
                {Object.entries(metrics.paymentPathways.countsByType).map(([type, count]) => (
                  <div key={type} className="flex justify-between gap-2">
                    <span>{type}</span>
                    <span className="font-mono text-slate-400">{count}</span>
                  </div>
                ))}
              </div>
            }
          />
          <FinancialOsMetricTile
            label="By status"
            value={
              <div className={financialOsClasses.metricList}>
                {Object.entries(metrics.paymentPathways.countsByStatus)
                  .filter(([, count]) => count > 0)
                  .map(([status, count]) => (
                    <div key={status} className="flex justify-between gap-2">
                      <span>{status}</span>
                      <span className="font-mono text-slate-400">{count}</span>
                    </div>
                  ))}
              </div>
            }
          />
          <FinancialOsMetricTile
            label="Patient-selected (30d)"
            value={metrics.paymentPathways.patientSelectedLast30DaysCount}
            foot="Pathways chosen via secure pay link."
          />
          <FinancialOsMetricTile
            label="Expected settlement (next 30 days)"
            value={metrics.paymentPathways.expectedSettlementNext30DaysCount}
          />
          <FinancialOsMetricTile label="Pathway attention" value={metrics.paymentPathways.attentionCount} />
        </dl>
      </FinancialOsSectionCard>

      <FinancialOsSectionCard
        title="Pathway operations inbox"
        kicker="Operations"
        description={
          <>
            Open operational tasks for non-standard payment pathways — see{" "}
            <Link href={`${base}/pathway-inbox`} className={financialOsClasses.link}>
              Pathway inbox
            </Link>
            .
          </>
        }
      >
        <dl className={financialOsClasses.metricGrid}>
          <FinancialOsMetricTile label="Open pathway tasks" value={metrics.pathwayInbox.openCount} />
          <FinancialOsMetricTile label="Urgent pathway tasks" value={metrics.pathwayInbox.urgentCount} />
          <FinancialOsMetricTile label="Waiting patient tasks" value={metrics.pathwayInbox.waitingPatientCount} />
          <FinancialOsMetricTile label="Overdue tasks" value={metrics.pathwayInbox.overdueCount} />
        </dl>
      </FinancialOsSectionCard>

      <FinancialOsSectionCard
        title="Financing applications"
        kicker="Finance"
        description={
          <>
            Provider-ready financing workflow — see{" "}
            <Link href={`${base}/finance-applications`} className={financialOsClasses.link}>
              Finance Applications
            </Link>{" "}
            and{" "}
            <Link href={`${base}/providers`} className={financialOsClasses.link}>
              Providers
            </Link>
            .
          </>
        }
      >
        <dl className={financialOsClasses.metricGrid}>
          <FinancialOsMetricTile label="Applications submitted" value={metrics.financeApplications.submittedCount} />
          <FinancialOsMetricTile label="Applications approved" value={metrics.financeApplications.approvedCount} />
          <FinancialOsMetricTile label="Pending documents" value={metrics.financeApplications.pendingDocsCount} />
          <FinancialOsMetricTile label="Settlement pending" value={metrics.financeApplications.settlementPendingCount} />
          <FinancialOsMetricTile
            label="Average approval time"
            value={
              metrics.financeApplications.averageApprovalDays != null
                ? `${metrics.financeApplications.averageApprovalDays} days`
                : "—"
            }
          />
          <FinancialOsMetricTile label="Applications requiring attention" value={metrics.financeApplications.attentionCount} />
        </dl>
        {metrics.financeApplications.mostUsedProvider ? (
          <p className="mt-4 text-xs text-slate-400">
            Most used provider:{" "}
            <span className="font-semibold text-slate-200">{metrics.financeApplications.mostUsedProvider.providerName}</span> (
            {metrics.financeApplications.mostUsedProvider.count} applications)
          </p>
        ) : null}
        {metrics.financeApplications.providerConversionRates.length ? (
          <div className={`${financialOsClasses.subPanel} mt-4`}>
            <p className="text-xs font-semibold text-slate-300">Provider conversion rates</p>
            <ul className="mt-2 space-y-1 text-[11px] text-slate-300">
              {metrics.financeApplications.providerConversionRates.slice(0, 5).map((p) => (
                <li key={p.providerId} className="flex justify-between gap-2">
                  <span>{p.providerName}</span>
                  <span className="font-mono text-slate-400">
                    {p.conversionRate != null ? `${(p.conversionRate * 100).toFixed(1)}%` : "—"}
                  </span>
                </li>
              ))}
            </ul>
          </div>
        ) : null}
      </FinancialOsSectionCard>

      <FinancialOsSectionCard
        title="Super release applications"
        kicker="Super"
        description={
          <>
            Medically justified superannuation release workflow — see{" "}
            <Link href={`${base}/super-release`} className={financialOsClasses.link}>
              Super Release
            </Link>
            .
          </>
        }
      >
        <dl className={financialOsClasses.metricGrid}>
          <FinancialOsMetricTile label="Open applications" value={metrics.superRelease.openCount} />
          <FinancialOsMetricTile label="Clinical letters pending" value={metrics.superRelease.clinicalLettersPendingCount} />
          <FinancialOsMetricTile label="Awaiting documents" value={metrics.superRelease.awaitingDocumentsCount} />
          <FinancialOsMetricTile label="Submitted applications" value={metrics.superRelease.submittedCount} />
          <FinancialOsMetricTile label="Funds release pending" value={metrics.superRelease.fundsReleasePendingCount} />
          <FinancialOsMetricTile
            label="Average approval time"
            value={
              metrics.superRelease.averageApprovalDays != null ? `${metrics.superRelease.averageApprovalDays} days` : "—"
            }
          />
          <FinancialOsMetricTile label="Applications requiring attention" value={metrics.superRelease.attentionCount} />
        </dl>
      </FinancialOsSectionCard>

      <FinancialOsSectionCard
        title="International transfer applications"
        kicker="International"
        description={
          <>
            Cross-border bank transfer workflow for overseas patients — see{" "}
            <Link href={`${base}/international-transfers`} className={financialOsClasses.link}>
              International Transfers
            </Link>
            .
          </>
        }
      >
        <dl className={financialOsClasses.metricGrid}>
          <FinancialOsMetricTile label="Open applications" value={metrics.internationalTransfer.openCount} />
          <FinancialOsMetricTile label="Awaiting transfer" value={metrics.internationalTransfer.awaitingTransferCount} />
          <FinancialOsMetricTile label="Proof received" value={metrics.internationalTransfer.proofReceivedCount} />
          <FinancialOsMetricTile label="Settlement pending" value={metrics.internationalTransfer.settlementPendingCount} />
          <FinancialOsMetricTile label="Variance review" value={metrics.internationalTransfer.varianceReviewCount} />
          <FinancialOsMetricTile label="Settled this month" value={metrics.internationalTransfer.settledThisMonthCount} />
          <FinancialOsMetricTile
            label="Average settlement days"
            value={
              metrics.internationalTransfer.averageSettlementDays != null
                ? `${metrics.internationalTransfer.averageSettlementDays} days`
                : "—"
            }
          />
          <FinancialOsMetricTile
            label="Total settlement variance"
            value={
              metrics.internationalTransfer.totalSettlementVarianceCents !== 0
                ? `$${(metrics.internationalTransfer.totalSettlementVarianceCents / 100).toLocaleString(undefined, { minimumFractionDigits: 2 })}`
                : "—"
            }
          />
          <FinancialOsMetricTile label="Applications requiring attention" value={metrics.internationalTransfer.attentionCount} />
        </dl>
      </FinancialOsSectionCard>

      <FinancialOsSectionCard
        title="Financial clearance (Phase 4)"
        kicker="Surgery readiness"
        description="Unified advisory clearance for surgery bookings in the next 14 days — aggregates invoices, pathways, finance, super release, international transfer, installments, and deposit state. Does not block SurgeryOS or change payment recording."
      >
        <dl className={financialOsClasses.metricGrid}>
          <FinancialOsMetricTile label="Financially cleared" value={metrics.financialClearance.financiallyClearedSurgeries} />
          <FinancialOsMetricTile label="Attention required" value={metrics.financialClearance.attentionRequired} />
          <FinancialOsMetricTile label="Pathway pending" value={metrics.financialClearance.pathwayPending} />
          <FinancialOsMetricTile label="Deposit ready" value={metrics.financialClearance.depositReady} />
          <FinancialOsMetricTile label="Paid in full" value={metrics.financialClearance.paidInFull} />
          <FinancialOsMetricTile label="Not ready" value={metrics.financialClearance.notReady} />
          <FinancialOsMetricTile
            label="Clearance rate (14d)"
            value={pct(metrics.financialClearance.clearanceRateNext14Days)}
            foot={`${metrics.financialClearance.totalUpcomingSurgeries} upcoming surgeries`}
          />
        </dl>
      </FinancialOsSectionCard>

      <div className={financialOsClasses.dashboardGridWide}>
        <FinancialOsAutomationNotice>
        <p>
          Schedule authenticated calls to{" "}
          <code className={financialOsClasses.code}>POST /api/cron/financial-os/automation?job=deposit_overdue</code> (and{" "}
          <code className={financialOsClasses.code}>balance_due_reminders</code>, <code className={financialOsClasses.code}>failed_payment_recovery</code>,{" "}
          <code className={financialOsClasses.code}>payment_escalation_alerts</code>) with Bearer <code className={financialOsClasses.code}>CRON_SECRET</code> or{" "}
          <code className={financialOsClasses.code}>FINANCIAL_OS_CRON_SECRET</code>. Supports <code className={financialOsClasses.code}>dry_run=1</code>,{" "}
          <code className={financialOsClasses.code}>tenantId</code>, and <code className={financialOsClasses.code}>date=YYYY-MM-DD</code>.
        </p>
        <p>
          Optional Phase 4 snapshot cron: <code className={financialOsClasses.code}>POST /api/cron/financial-os/clearance-snapshots</code> with the same Bearer
          secrets. Supports <code className={financialOsClasses.code}>dry_run=1</code>, <code className={financialOsClasses.code}>tenantId</code>,{" "}
          <code className={financialOsClasses.code}>date=YYYY-MM-DD</code>, <code className={financialOsClasses.code}>horizonDays</code>, and{" "}
          <code className={financialOsClasses.code}>limit</code>.
        </p>
        <p className="text-slate-500">
          Balance reminders reuse invoice <code className={financialOsClasses.code}>automation_hints</code> offsets (same semantics as{" "}
          <code className={financialOsClasses.code}>/api/cron/fi-payments/reminders</code>).
        </p>
      </FinancialOsAutomationNotice>
      </div>

      <FinancialOsSectionCard
        className={financialOsClasses.dashboardGridWide}
        title="Consultation quote → deposit"
        kicker="Deposits"
        description={
          <>
            Creates a RevenueOS payment request for a consultation quote invoice and sets the linked booking&apos;s{" "}
            <code className={financialOsClasses.code}>financial_os_status</code> to <code className={financialOsClasses.code}>deposit_pending</code> when a
            consultation booking link exists. Does not alter ConsultationOS quote acceptance.
          </>
        }
      >
        {!paymentsEnabled ? (
          <InfoNotice variant="warning" className="mb-4">
            Stripe checkout is disabled (<code className={financialOsClasses.code}>FI_PAYMENTS_ENABLED</code>) — you can still create draft payment requests
            with &quot;Send checkout&quot; off.
          </InfoNotice>
        ) : null}
        <FinancialOsDashboardDepositForm tenantId={tid} canMutate={canMutate} />
      </FinancialOsSectionCard>
    </div>
  );
}
