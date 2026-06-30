"use client";

import Link from "next/link";

import { cn } from "@/lib/utils";
import { fiOsChromeClasses } from "@/src/components/fi-os/fiOsChromeTokens";
import {
  DashboardCard,
  InfoNotice,
  SectionHeader,
  StatCard,
} from "@/src/components/fi-admin/dashboard-ui";
import { FinancialOsAccountsReceivablePanel } from "@/src/components/fi-admin/financial-os/FinancialOsAccountsReceivablePanel";
import { FinancialOsExecutiveFinancePulse } from "@/src/components/fi-admin/financial-os/FinancialOsExecutiveFinancePulse";
import { FinancialOsRevenueAttributionFilters } from "@/src/components/fi-admin/financial-os/FinancialOsRevenueAttributionFilters";
import { FinancialOsSurgeryEconomicsFilters } from "@/src/components/fi-admin/financial-os/FinancialOsSurgeryEconomicsFilters";
import {
  FinancialOsTable,
  FinancialOsTh,
  financialOsClasses,
} from "@/src/components/fi-admin/financial-os/financialOsUi";
import {
  financialOsStatusBadgeBase,
  financialOsStatusBadgeTones,
} from "@/src/components/fi-admin/financial-os/financialOsStatusBadgeStyles";
import type { FinancialOsCommandCentrePayload } from "@/src/lib/financialOs/financialOsCommandCentreLoader.server";
import type { FinancialOsCommandCentreAlertStrip } from "@/src/lib/financialOs/financialOsCommandCentreAlertsCore";
import {
  financialDiagnosticCounts,
  fmtFinancialMoney,
  fmtFinancialWhen,
} from "@/src/lib/fiAdmin/financialPresentation";

function txKindLabel(kind: string): string {
  return kind.replace(/_/g, " ");
}

function FinancialOsOperatorAlertStrip({ alerts }: { alerts: FinancialOsCommandCentreAlertStrip }) {
  const hasAlerts =
    alerts.needsReviewCount > 0 ||
    alerts.overdueInvoices.count > 0 ||
    alerts.failedGatewayPayments.count > 0 ||
    alerts.depositDeadlines48h.count > 0;

  if (!hasAlerts) {
    return (
      <InfoNotice variant="success" title="No operator alerts">
        <p className="text-sm">Reconciliation and collection signals are clear for this tenant.</p>
      </InfoNotice>
    );
  }

  const sections = [
    {
      key: "unmatched",
      title: "Unmatched payments",
      items: alerts.unmatchedPayments.items,
      tone: "critical" as const,
    },
    {
      key: "overdue",
      title: "Overdue invoices",
      items: alerts.overdueInvoices.items,
      tone: "warning" as const,
    },
    {
      key: "failed",
      title: "Failed gateway payments",
      items: alerts.failedGatewayPayments.items,
      tone: "warning" as const,
    },
    {
      key: "deposit",
      title: "Deposit deadlines (48h)",
      items: alerts.depositDeadlines48h.items,
      tone: "warning" as const,
    },
  ].filter((s) => s.items.length > 0);

  return (
    <div className="space-y-3">
      {alerts.needsReviewCount > 0 ? (
        <InfoNotice variant="danger" title={`${alerts.needsReviewCount} payment(s) need review`}>
          <p className="text-sm">
            Unmatched provider amounts were detected — invoices were not auto-settled.
          </p>
        </InfoNotice>
      ) : null}
      <div className="grid gap-3 lg:grid-cols-2">
        {sections.map((section) => (
          <div key={section.key} className={financialOsClasses.subPanel}>
            <p className="text-xs font-semibold uppercase tracking-[0.12em] text-slate-400">
              {section.title}
            </p>
            <ul className="mt-2 space-y-1.5 text-xs text-slate-300">
              {section.items.slice(0, 8).map((item) => (
                <li key={item.id} className="flex items-start justify-between gap-2">
                  <span>
                    {item.label}
                    <span className="ml-1 font-mono text-[10px] text-slate-500">
                      ({item.id.slice(0, 8)}…)
                    </span>
                  </span>
                  <span
                    className={`shrink-0 ${financialOsStatusBadgeBase} ${
                      item.severity === "critical"
                        ? financialOsStatusBadgeTones.danger
                        : financialOsStatusBadgeTones.warning
                    }`}
                  >
                    {item.severity}
                  </span>
                </li>
              ))}
            </ul>
            {section.items.some((i) => i.detail) ? (
              <p className="mt-2 text-[11px] text-slate-500">{section.items[0]?.detail}</p>
            ) : null}
          </div>
        ))}
      </div>
    </div>
  );
}

export function FinancialOsSystemDiagnostics({
  data,
  surgeryEconomicsFilterOptions,
  revenueAttributionFilterOptions,
  showDiagnosticsExpanded = false,
}: {
  data: FinancialOsCommandCentrePayload;
  surgeryEconomicsFilterOptions?: {
    procedureTypes: string[];
    surgeonOptions: Array<{ value: string; label: string }>;
    clinicOptions: Array<{ value: string; label: string }>;
  };
  revenueAttributionFilterOptions?: {
    sources: string[];
    campaigns: string[];
    consultantOptions: Array<{ value: string; label: string }>;
    clinicOptions: Array<{ value: string; label: string }>;
    procedureTypes: string[];
  };
  showDiagnosticsExpanded?: boolean;
}) {
  const counts = financialDiagnosticCounts(data);
  const base = `/fi-admin/${data.tenantId}`;

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
              For platform operators only. These checks support financial integrity and payment
              processing without affecting day-to-day clinic finance workflow.
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
            title="Data volume"
            description="Row counts loaded for this command centre snapshot."
            className="mb-3"
          />
          <div className="grid grid-cols-2 gap-3 sm:grid-cols-4 lg:grid-cols-7">
            <StatCard label="Ledger rows" value={counts.ledgerTransactionCount} />
            <StatCard label="Open invoices" value={counts.openInvoiceCount} />
            <StatCard label="Review queue" value={counts.alertReviewCount} />
            <StatCard label="AR cases" value={counts.arCaseCount} />
            <StatCard label="Profitability snapshots" value={counts.profitabilitySnapshotCount} />
            <StatCard label="Attribution rows" value={counts.attributionEventCount} />
            <StatCard label="Executive insights" value={counts.executiveInsightCount} />
          </div>
        </DashboardCard>

        <FinancialOsExecutiveFinancePulse data={data.executiveFinance} />

        <DashboardCard className="border-white/[0.06] bg-[#0c1220]/40 p-4 sm:p-5">
          <SectionHeader
            title="Operational alerts"
            description="Reconciliation, gateway, and deposit deadline signals."
            className="mb-3"
          />
          <FinancialOsOperatorAlertStrip alerts={data.alerts} />
        </DashboardCard>

        <FinancialOsAccountsReceivablePanel
          tenantId={data.tenantId}
          currency={data.currency}
          metrics={data.accountsReceivable.metrics}
          rows={data.accountsReceivable.rows}
        />

        <DashboardCard className="border-white/[0.06] bg-[#0c1220]/40 p-4 sm:p-5">
          <SectionHeader
            title="Surgery economics"
            description="Profitability snapshots from cost models, graft counts, and surgery invoice revenue."
            className="mb-3"
          />
          {surgeryEconomicsFilterOptions ? (
            <FinancialOsSurgeryEconomicsFilters
              tenantId={data.tenantId}
              procedureTypes={surgeryEconomicsFilterOptions.procedureTypes}
              surgeonOptions={surgeryEconomicsFilterOptions.surgeonOptions}
              clinicOptions={surgeryEconomicsFilterOptions.clinicOptions}
            />
          ) : null}
          <dl className={cn(financialOsClasses.metricGrid, "mt-4")}>
            <div className={financialOsClasses.metricTile}>
              <dt className={financialOsClasses.metricLabel}>Average surgery margin</dt>
              <dd className={financialOsClasses.metricValue}>
                {data.surgeryEconomics.metrics.average_margin_percentage.toFixed(1)}%
              </dd>
            </div>
            <div className={financialOsClasses.metricTile}>
              <dt className={financialOsClasses.metricLabel}>Revenue per graft</dt>
              <dd className={financialOsClasses.metricValue}>
                {data.surgeryEconomics.metrics.average_revenue_per_graft_cents != null
                  ? fmtFinancialMoney(
                      data.surgeryEconomics.metrics.average_revenue_per_graft_cents,
                      data.surgeryEconomics.currency
                    )
                  : "—"}
              </dd>
            </div>
            <div className={financialOsClasses.metricTile}>
              <dt className={financialOsClasses.metricLabel}>Cost per graft</dt>
              <dd className={financialOsClasses.metricValue}>
                {data.surgeryEconomics.metrics.average_cost_per_graft_cents != null
                  ? fmtFinancialMoney(
                      data.surgeryEconomics.metrics.average_cost_per_graft_cents,
                      data.surgeryEconomics.currency
                    )
                  : "—"}
              </dd>
            </div>
          </dl>
          <div className="mt-4">
            <FinancialOsTable
              isEmpty={data.surgeryEconomics.recentSnapshots.length === 0}
              emptyMessage="No surgery profitability snapshots yet."
              head={
                <>
                  <FinancialOsTh>Patient</FinancialOsTh>
                  <FinancialOsTh>Procedure</FinancialOsTh>
                  <FinancialOsTh>Revenue</FinancialOsTh>
                  <FinancialOsTh>Total cost</FinancialOsTh>
                  <FinancialOsTh>Gross profit</FinancialOsTh>
                  <FinancialOsTh>Margin</FinancialOsTh>
                  <FinancialOsTh>Snapshot ID</FinancialOsTh>
                </>
              }
            >
              {data.surgeryEconomics.recentSnapshots.map((row) => (
                <tr
                  key={row.id ?? `${row.case_id}-${row.calculated_at}`}
                  className={financialOsClasses.tableRow}
                >
                  <td className={financialOsClasses.tableCellStrong}>{row.patient_label ?? "—"}</td>
                  <td className={financialOsClasses.tableCell}>{row.procedure_type}</td>
                  <td className={financialOsClasses.tableCellMono}>
                    {fmtFinancialMoney(row.revenue_cents, data.surgeryEconomics.currency)}
                  </td>
                  <td className={financialOsClasses.tableCellMono}>
                    {fmtFinancialMoney(row.total_cost_cents, data.surgeryEconomics.currency)}
                  </td>
                  <td className={financialOsClasses.tableCellStrong}>
                    {fmtFinancialMoney(row.gross_profit_cents, data.surgeryEconomics.currency)}
                  </td>
                  <td className={financialOsClasses.tableCell}>
                    {row.gross_margin_percentage.toFixed(1)}%
                  </td>
                  <td className={financialOsClasses.tableCellMono}>
                    {row.id?.slice(0, 8) ?? "—"}…
                  </td>
                </tr>
              ))}
            </FinancialOsTable>
          </div>
        </DashboardCard>

        <DashboardCard className="border-white/[0.06] bg-[#0c1220]/40 p-4 sm:p-5">
          <SectionHeader
            title="Revenue attribution"
            description="LeadFlow-sourced revenue, gross profit, and attribution breakdown."
            className="mb-3"
          />
          {revenueAttributionFilterOptions ? (
            <FinancialOsRevenueAttributionFilters
              tenantId={data.tenantId}
              sources={revenueAttributionFilterOptions.sources}
              campaigns={revenueAttributionFilterOptions.campaigns}
              consultantOptions={revenueAttributionFilterOptions.consultantOptions}
              clinicOptions={revenueAttributionFilterOptions.clinicOptions}
              procedureTypes={revenueAttributionFilterOptions.procedureTypes}
            />
          ) : null}
          <div className="mt-4">
            <FinancialOsTable
              isEmpty={data.revenueAttribution.rows.length === 0}
              emptyMessage="No revenue attribution events yet."
              head={
                <>
                  <FinancialOsTh>Source</FinancialOsTh>
                  <FinancialOsTh>Campaign</FinancialOsTh>
                  <FinancialOsTh>Leads</FinancialOsTh>
                  <FinancialOsTh>Consults</FinancialOsTh>
                  <FinancialOsTh>Invoices</FinancialOsTh>
                  <FinancialOsTh>Collected</FinancialOsTh>
                  <FinancialOsTh>Margin</FinancialOsTh>
                  <FinancialOsTh>Confidence</FinancialOsTh>
                </>
              }
            >
              {data.revenueAttribution.rows.map((row) => (
                <tr key={`${row.source}-${row.campaign}`} className={financialOsClasses.tableRow}>
                  <td className={financialOsClasses.tableCellStrong}>
                    {row.source.replace(/_/g, " ")}
                  </td>
                  <td className={financialOsClasses.tableCell}>{row.campaign}</td>
                  <td className={financialOsClasses.tableCellMono}>{row.leads}</td>
                  <td className={financialOsClasses.tableCellMono}>{row.consults}</td>
                  <td className={financialOsClasses.tableCellMono}>{row.invoices}</td>
                  <td className={financialOsClasses.tableCellMono}>
                    {fmtFinancialMoney(
                      row.collected_revenue_cents,
                      data.revenueAttribution.currency
                    )}
                  </td>
                  <td className={financialOsClasses.tableCell}>
                    {row.margin_percentage != null ? `${row.margin_percentage.toFixed(1)}%` : "—"}
                  </td>
                  <td className={financialOsClasses.tableCell}>{row.confidence}</td>
                </tr>
              ))}
            </FinancialOsTable>
          </div>
        </DashboardCard>

        <div className={financialOsClasses.dashboardGrid}>
          <DashboardCard className="border-white/[0.06] bg-[#0c1220]/40 p-4 sm:p-5">
            <SectionHeader
              title="Recent ledger transactions"
              description="Append-only entries from fi_financial_transactions."
              className="mb-3"
            />
            <FinancialOsTable
              isEmpty={data.recentTransactions.length === 0}
              emptyMessage="No ledger transactions yet."
              head={
                <>
                  <FinancialOsTh>When</FinancialOsTh>
                  <FinancialOsTh>Kind</FinancialOsTh>
                  <FinancialOsTh>Module</FinancialOsTh>
                  <FinancialOsTh>Amount</FinancialOsTh>
                  <FinancialOsTh>Transaction ID</FinancialOsTh>
                </>
              }
            >
              {data.recentTransactions.map((tx) => (
                <tr key={tx.id} className={financialOsClasses.tableRow}>
                  <td className={financialOsClasses.tableCellMono}>
                    {fmtFinancialWhen(tx.created_at)}
                  </td>
                  <td className={financialOsClasses.tableCell}>
                    {txKindLabel(tx.transaction_kind)}
                  </td>
                  <td className={financialOsClasses.tableCellMono}>{tx.source_module}</td>
                  <td className={financialOsClasses.tableCellStrong}>
                    {tx.direction === "debit" ? "−" : "+"}
                    {fmtFinancialMoney(tx.amount_cents, tx.currency)}
                  </td>
                  <td className={financialOsClasses.tableCellMono}>{tx.id.slice(0, 8)}…</td>
                </tr>
              ))}
            </FinancialOsTable>
          </DashboardCard>

          <DashboardCard className="border-white/[0.06] bg-[#0c1220]/40 p-4 sm:p-5">
            <SectionHeader
              title="Open invoices"
              description="Sent / awaiting payment / partial / overdue balances."
              className="mb-3"
            />
            <FinancialOsTable
              isEmpty={data.recentOpenInvoices.length === 0}
              emptyMessage="No open invoice balances."
              head={
                <>
                  <FinancialOsTh>Invoice</FinancialOsTh>
                  <FinancialOsTh>Status</FinancialOsTh>
                  <FinancialOsTh>Due</FinancialOsTh>
                  <FinancialOsTh>Balance</FinancialOsTh>
                  <FinancialOsTh>Invoice ID</FinancialOsTh>
                </>
              }
            >
              {data.recentOpenInvoices.map((inv) => (
                <tr key={inv.id} className={financialOsClasses.tableRow}>
                  <td className={financialOsClasses.tableCellStrong}>
                    <div>{inv.title ?? inv.invoice_kind}</div>
                    <div className={financialOsClasses.mutedMeta}>{inv.invoice_kind}</div>
                  </td>
                  <td className={financialOsClasses.tableCell}>
                    <span
                      className={`${financialOsStatusBadgeBase} ${
                        inv.status === "overdue"
                          ? financialOsStatusBadgeTones.warning
                          : financialOsStatusBadgeTones.neutral
                      }`}
                    >
                      {inv.status.replace(/_/g, " ")}
                    </span>
                  </td>
                  <td className={financialOsClasses.tableCellMono}>
                    {inv.due_date ?? "—"}
                    {inv.days_overdue > 0 ? (
                      <span className="ml-1 text-amber-300/90">+{inv.days_overdue}d</span>
                    ) : null}
                  </td>
                  <td className={financialOsClasses.tableCellStrong}>
                    {fmtFinancialMoney(inv.remaining_balance_cents, inv.currency)}
                  </td>
                  <td className={financialOsClasses.tableCellMono}>{inv.id.slice(0, 8)}…</td>
                </tr>
              ))}
            </FinancialOsTable>
          </DashboardCard>
        </div>

        <DashboardCard className="border-white/[0.06] bg-[#0c1220]/40 p-4 sm:p-5">
          <SectionHeader
            title="Module integrations"
            description="Cross-OS financial event wiring."
            className="mb-3"
          />
          <ul className="grid gap-2 text-sm text-slate-300 sm:grid-cols-3">
            <li className={financialOsClasses.subPanel}>
              <span className="font-semibold text-slate-100">ConsultationOS</span>
              <p className="mt-1 text-xs text-slate-400">
                Consultation quotes create invoices and ledger entries via RevenueOS.
              </p>
            </li>
            <li className={financialOsClasses.subPanel}>
              <span className="font-semibold text-slate-100">SurgeryOS</span>
              <p className="mt-1 text-xs text-slate-400">
                Deposit and balance invoices use procedure-scoped deposit rules.
              </p>
            </li>
            <li className={financialOsClasses.subPanel}>
              <span className="font-semibold text-slate-100">LeadFlow</span>
              <p className="mt-1 text-xs text-slate-400">
                Payment events append CRM activity and anchor ledger rows on lead_id.
              </p>
            </li>
          </ul>
          <div className="mt-4 flex flex-wrap gap-2">
            <Link
              href={`${base}/financial/dashboard`}
              className={cn(
                fiOsChromeClasses.toolbarControlSurface,
                "px-3 py-1.5 text-xs font-semibold text-slate-200"
              )}
            >
              Full FinancialOS module
            </Link>
            <Link
              href={`${base}/settings/payments`}
              className={cn(
                fiOsChromeClasses.toolbarControlSurface,
                "px-3 py-1.5 text-xs font-semibold text-slate-200"
              )}
            >
              Payment provider settings
            </Link>
          </div>
        </DashboardCard>
      </div>
    </details>
  );
}
