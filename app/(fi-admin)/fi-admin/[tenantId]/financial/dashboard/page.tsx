import type { Metadata } from "next";
import { notFound } from "next/navigation";

import { FinancialOsDashboardDepositForm } from "@/src/components/fi/financial/FinancialOsDashboardDepositForm";
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

  return (
    <div className="space-y-8">
      <section>
        <h2 className="text-sm font-semibold text-slate-900">Metrics</h2>
        <dl className="mt-3 grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
          <div className="rounded border border-slate-200 bg-white p-3">
            <dt className="text-xs text-slate-500">Outstanding revenue</dt>
            <dd className="text-sm font-semibold text-slate-900">{fmtMoney(metrics.outstandingRevenueCents, metrics.currency)}</dd>
            <dd className="text-[11px] text-slate-500">{metrics.outstandingInvoiceCount} open invoices (issued / partial / overdue)</dd>
          </div>
          <div className="rounded border border-slate-200 bg-white p-3">
            <dt className="text-xs text-slate-500">Upcoming (30d)</dt>
            <dd className="text-sm font-semibold text-slate-900">
              {metrics.upcomingPaymentRequestCount} payment links · {metrics.upcomingInstallmentCount} installment dates
            </dd>
          </div>
          <div className="rounded border border-slate-200 bg-white p-3">
            <dt className="text-xs text-slate-500">Failed gateway payments (60d)</dt>
            <dd className="text-sm font-semibold text-slate-900">{metrics.failedPaymentCount}</dd>
          </div>
          <div className="rounded border border-slate-200 bg-white p-3">
            <dt className="text-xs text-slate-500">Deposit conversion (90d consultation quotes)</dt>
            <dd className="text-sm font-semibold text-slate-900">{pct(metrics.depositConversionRate)}</dd>
            <dd className="text-[11px] text-slate-500">Share of new consultation-quote invoices with any payment recorded.</dd>
          </div>
          <div className="rounded border border-slate-200 bg-white p-3">
            <dt className="text-xs text-slate-500">Monthly revenue forecast</dt>
            <dd className="text-sm font-semibold text-slate-900">
              {metrics.monthlyRevenueForecastCents != null ? fmtMoney(metrics.monthlyRevenueForecastCents, metrics.currency) : "—"}
            </dd>
            <dd className="text-[11px] text-slate-500">Average succeeded gateway totals over the prior three full months.</dd>
          </div>
        </dl>
      </section>

      <section>
        <h2 className="text-sm font-semibold text-slate-900">Payment pathways</h2>
        <p className="mt-1 max-w-2xl text-xs text-slate-600">
          Settlement intent recorded on <code className="rounded bg-slate-100 px-1">fi_payment_pathways</code> — see{" "}
          <code className="rounded bg-slate-100 px-1">Payment Pathways</code> for detail and management.
        </p>
        <dl className="mt-3 grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
          <div className="rounded border border-slate-200 bg-white p-3">
            <dt className="text-xs text-slate-500">By type</dt>
            <dd className="mt-1 space-y-0.5 text-[11px] text-slate-700">
              {Object.entries(metrics.paymentPathways.countsByType).map(([type, count]) => (
                <div key={type} className="flex justify-between gap-2">
                  <span>{type}</span>
                  <span className="font-mono">{count}</span>
                </div>
              ))}
            </dd>
          </div>
          <div className="rounded border border-slate-200 bg-white p-3">
            <dt className="text-xs text-slate-500">By status</dt>
            <dd className="mt-1 space-y-0.5 text-[11px] text-slate-700">
              {Object.entries(metrics.paymentPathways.countsByStatus)
                .filter(([, count]) => count > 0)
                .map(([status, count]) => (
                  <div key={status} className="flex justify-between gap-2">
                    <span>{status}</span>
                    <span className="font-mono">{count}</span>
                  </div>
                ))}
            </dd>
          </div>
          <div className="rounded border border-slate-200 bg-white p-3">
            <dt className="text-xs text-slate-500">Expected settlement (next 30 days)</dt>
            <dd className="text-sm font-semibold text-slate-900">{metrics.paymentPathways.expectedSettlementNext30DaysCount}</dd>
            <dt className="mt-2 text-xs text-slate-500">Pathway attention</dt>
            <dd className="text-sm font-semibold text-slate-900">{metrics.paymentPathways.attentionCount}</dd>
          </div>
        </dl>
      </section>

      <section className="rounded border border-slate-200 bg-slate-50/80 p-4 text-xs text-slate-700">
        <h2 className="text-sm font-semibold text-slate-900">Automation cron</h2>
        <p className="mt-2">
          Schedule authenticated calls to{" "}
          <code className="rounded bg-white px-1">POST /api/cron/financial-os/automation?job=deposit_overdue</code> (and{" "}
          <code className="rounded bg-white px-1">balance_due_reminders</code>, <code className="rounded bg-white px-1">failed_payment_recovery</code>,{" "}
          <code className="rounded bg-white px-1">payment_escalation_alerts</code>) with Bearer <code className="rounded bg-white px-1">CRON_SECRET</code> or{" "}
          <code className="rounded bg-white px-1">FINANCIAL_OS_CRON_SECRET</code>. Supports <code className="rounded bg-white px-1">dry_run=1</code>,{" "}
          <code className="rounded bg-white px-1">tenantId</code>, and <code className="rounded bg-white px-1">date=YYYY-MM-DD</code>.
        </p>
        <p className="mt-2 text-slate-600">
          Balance reminders reuse invoice <code className="rounded bg-white px-1">automation_hints</code> offsets (same semantics as{" "}
          <code className="rounded bg-white px-1">/api/cron/fi-payments/reminders</code>).
        </p>
      </section>

      <section>
        <h2 className="text-sm font-semibold text-slate-900">Consultation quote → deposit</h2>
        <p className="mt-1 max-w-2xl text-xs text-slate-600">
          Creates a RevenueOS payment request for a consultation quote invoice and sets the linked booking&apos;s{" "}
          <code className="rounded bg-slate-100 px-1">financial_os_status</code> to <code className="rounded bg-slate-100 px-1">deposit_pending</code> when a
          consultation booking link exists. Does not alter ConsultationOS quote acceptance.
        </p>
        {!paymentsEnabled ? (
          <p className="mt-2 text-xs text-amber-800">
            Stripe checkout is disabled (<code className="rounded bg-amber-100 px-1">FI_PAYMENTS_ENABLED</code>) — you can still create draft payment requests
            with &quot;Send checkout&quot; off.
          </p>
        ) : null}
        <div className="mt-3">
          <FinancialOsDashboardDepositForm tenantId={tid} canMutate={canMutate} />
        </div>
      </section>
    </div>
  );
}
