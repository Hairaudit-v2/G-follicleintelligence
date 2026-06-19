"use client";

import Link from "next/link";

import { cn } from "@/lib/utils";
import { fiOsChromeClasses } from "@/src/components/fi-os/fiOsChromeTokens";
import {
  FinancialOsMetricTile,
  FinancialOsSectionCard,
  FinancialOsTable,
  FinancialOsTh,
  financialOsClasses,
} from "@/src/components/fi-admin/financial-os/financialOsUi";
import type { FinancialOsCommandCentrePayload } from "@/src/lib/financialOs/financialOsCommandCentreLoader.server";
import type { FinancialOsCommandCentreAlertStrip } from "@/src/lib/financialOs/financialOsCommandCentreAlertsCore";
import { FinancialOsSurgeryEconomicsFilters } from "@/src/components/fi-admin/financial-os/FinancialOsSurgeryEconomicsFilters";
import { FinancialOsRevenueAttributionFilters } from "@/src/components/fi-admin/financial-os/FinancialOsRevenueAttributionFilters";
import { financialOsStatusBadgeBase, financialOsStatusBadgeTones } from "@/src/components/fi-admin/financial-os/financialOsStatusBadgeStyles";
import { FinancialOsAccountsReceivablePanel } from "@/src/components/fi-admin/financial-os/FinancialOsAccountsReceivablePanel";
import { FinancialOsExecutiveFinancePulse } from "@/src/components/fi-admin/financial-os/FinancialOsExecutiveFinancePulse";
import { InfoNotice } from "@/src/components/fi-admin/dashboard-ui";

function fmtMoney(cents: number, currency: string): string {
  return `${currency} ${(cents / 100).toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
}

function fmtWhen(iso: string): string {
  if (!iso) return "—";
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return iso;
  return d.toLocaleString(undefined, { month: "short", day: "numeric", hour: "2-digit", minute: "2-digit" });
}

function txKindLabel(kind: string): string {
  return kind.replace(/_/g, " ");
}

function FinancialOsAlertStrip({ alerts }: { alerts: FinancialOsCommandCentreAlertStrip }) {
  const hasAlerts =
    alerts.needsReviewCount > 0 ||
    alerts.overdueInvoices.count > 0 ||
    alerts.failedGatewayPayments.count > 0 ||
    alerts.depositDeadlines48h.count > 0;

  if (!hasAlerts) {
    return (
      <InfoNotice variant="success" title="No operational alerts">
        <p className="text-sm">Ledger, reconciliation, and collection signals are clear for this tenant.</p>
      </InfoNotice>
    );
  }

  const sections = [
    { key: "unmatched", title: "Needs review", items: alerts.unmatchedPayments.items, tone: "critical" as const },
    { key: "overdue", title: "Overdue invoices", items: alerts.overdueInvoices.items, tone: "warning" as const },
    { key: "failed", title: "Failed gateway payments", items: alerts.failedGatewayPayments.items, tone: "warning" as const },
    { key: "deposit", title: "Deposit deadlines (48h)", items: alerts.depositDeadlines48h.items, tone: "warning" as const },
  ].filter((s) => s.items.length > 0);

  return (
    <div className="space-y-3">
      {alerts.needsReviewCount > 0 ? (
        <InfoNotice variant="danger" title={`${alerts.needsReviewCount} payment(s) need review`}>
          <p className="text-sm">Unmatched provider amounts were detected — invoices were not auto-settled.</p>
        </InfoNotice>
      ) : null}
      <div className="grid gap-3 lg:grid-cols-2">
        {sections.map((section) => (
          <div key={section.key} className={financialOsClasses.subPanel}>
            <p className="text-xs font-semibold uppercase tracking-[0.12em] text-slate-400">{section.title}</p>
            <ul className="mt-2 space-y-1.5 text-xs text-slate-300">
              {section.items.slice(0, 5).map((item) => (
                <li key={item.id} className="flex items-start justify-between gap-2">
                  <span>{item.label}</span>
                  <span
                    className={`shrink-0 ${financialOsStatusBadgeBase} ${
                      item.severity === "critical" ? financialOsStatusBadgeTones.danger : financialOsStatusBadgeTones.warning
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

export function FinancialOsCommandCentreDashboard(props: {
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
}) {
  const { data, surgeryEconomicsFilterOptions, revenueAttributionFilterOptions } = props;
  const base = `/fi-admin/${data.tenantId}`;
  const financialModule = `${base}/financial`;

  return (
    <div className={financialOsClasses.pageShell}>
      <header className="flex flex-col gap-2 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <p className="text-[0.62rem] font-semibold uppercase tracking-[0.18em] text-cyan-400/80">FinancialOS</p>
          <h1 className="text-xl font-semibold text-slate-50 sm:text-2xl">Financial command centre</h1>
          <p className="mt-1 text-sm text-slate-400">
            Master ledger, invoice lifecycle, and reconciliation — {data.todayYmd}
          </p>
        </div>
        <div className="flex flex-wrap gap-2">
          <Link href={`${base}/financial-os/cost-models`} className={cn(fiOsChromeClasses.toolbarControlSurface, "px-3 py-1.5 text-xs font-semibold text-slate-200")}>
            Cost models
          </Link>
          <Link href={`${financialModule}/dashboard`} className={cn(fiOsChromeClasses.toolbarControlSurface, "px-3 py-1.5 text-xs font-semibold text-slate-200")}>
            Full FinancialOS module
          </Link>
          <Link href={`${base}/financial-os/executive`} className={cn(fiOsChromeClasses.toolbarControlSurface, "px-3 py-1.5 text-xs font-semibold text-slate-200")}>
            Executive finance
          </Link>
          <Link href={`${base}/financial-os/accounts-receivable`} className={cn(fiOsChromeClasses.toolbarControlSurface, "px-3 py-1.5 text-xs font-semibold text-slate-200")}>
            Accounts receivable
          </Link>
          <Link href={`${financialModule}/invoices`} className={cn(fiOsChromeClasses.toolbarControlSurface, "px-3 py-1.5 text-xs font-semibold text-cyan-100/95")}>
            Invoices
          </Link>
        </div>
      </header>

      <FinancialOsExecutiveFinancePulse data={data.executiveFinance} />

      <FinancialOsSectionCard title="Operational alerts" kicker="Pilot">
        <FinancialOsAlertStrip alerts={data.alerts} />
      </FinancialOsSectionCard>

      <FinancialOsSectionCard title="Today" kicker="Revenue">
        <dl className={financialOsClasses.metricGrid}>
          <FinancialOsMetricTile label="Revenue today" value={fmtMoney(data.revenueTodayCents, data.currency)} foot="Ledger credits: payments, deposits, balances" />
          <FinancialOsMetricTile
            label="Outstanding invoices"
            value={fmtMoney(data.outstandingInvoices.totalCents, data.currency)}
            foot={`${data.outstandingInvoices.count} open invoices`}
          />
          <FinancialOsMetricTile
            label="Deposits awaiting payment"
            value={fmtMoney(data.depositsAwaitingPayment.totalCents, data.currency)}
            foot={`${data.depositsAwaitingPayment.count} surgery deposit invoices`}
          />
          <FinancialOsMetricTile
            label="Overdue invoices"
            value={fmtMoney(data.overdueInvoices.totalCents, data.currency)}
            foot={`${data.overdueInvoices.count} past due`}
          />
        </dl>
      </FinancialOsSectionCard>

      <FinancialOsAccountsReceivablePanel
        tenantId={data.tenantId}
        currency={data.currency}
        metrics={data.accountsReceivable.metrics}
        rows={data.accountsReceivable.rows}
      />

      <FinancialOsSectionCard
        title="Surgery economics"
        kicker="SurgeryOS"
        description="Profitability snapshots from cost models, graft counts, and surgery invoice revenue."
      >
        {surgeryEconomicsFilterOptions ? (
          <FinancialOsSurgeryEconomicsFilters
            tenantId={data.tenantId}
            procedureTypes={surgeryEconomicsFilterOptions.procedureTypes}
            surgeonOptions={surgeryEconomicsFilterOptions.surgeonOptions}
            clinicOptions={surgeryEconomicsFilterOptions.clinicOptions}
          />
        ) : null}
        <dl className={financialOsClasses.metricGrid}>
          <FinancialOsMetricTile
            label="Average surgery margin"
            value={`${data.surgeryEconomics.metrics.average_margin_percentage.toFixed(1)}%`}
            foot="Mean gross margin across recent snapshots"
          />
          <FinancialOsMetricTile
            label="Revenue per graft"
            value={
              data.surgeryEconomics.metrics.average_revenue_per_graft_cents != null
                ? fmtMoney(data.surgeryEconomics.metrics.average_revenue_per_graft_cents, data.surgeryEconomics.currency)
                : "—"
            }
            foot="Average when graft count is recorded"
          />
          <FinancialOsMetricTile
            label="Cost per graft"
            value={
              data.surgeryEconomics.metrics.average_cost_per_graft_cents != null
                ? fmtMoney(data.surgeryEconomics.metrics.average_cost_per_graft_cents, data.surgeryEconomics.currency)
                : "—"
            }
            foot="Average total cost per graft"
          />
          <FinancialOsMetricTile
            label="Outstanding surgery balances"
            value={fmtMoney(data.surgeryEconomics.metrics.outstanding_surgery_balances_cents, data.surgeryEconomics.currency)}
            foot="Sum of outstanding on snapshot cases"
          />
          <FinancialOsMetricTile
            label="Most profitable procedure"
            value={data.surgeryEconomics.metrics.most_profitable_procedure_type?.toUpperCase() ?? "—"}
            foot="Highest average margin by procedure type"
          />
        </dl>

        <div className="mt-4">
          <p className="mb-2 text-xs font-semibold uppercase tracking-[0.12em] text-slate-500">Recent surgery profitability snapshots</p>
          <FinancialOsTable
            isEmpty={data.surgeryEconomics.recentSnapshots.length === 0}
            emptyMessage="No surgery profitability snapshots yet. Snapshots are written when surgery economics is calculated for a case."
            head={
              <>
                <FinancialOsTh>Patient</FinancialOsTh>
                <FinancialOsTh>Procedure</FinancialOsTh>
                <FinancialOsTh>Revenue</FinancialOsTh>
                <FinancialOsTh>Total cost</FinancialOsTh>
                <FinancialOsTh>Gross profit</FinancialOsTh>
                <FinancialOsTh>Margin</FinancialOsTh>
                <FinancialOsTh>Grafts</FinancialOsTh>
                <FinancialOsTh>Rev/graft</FinancialOsTh>
              </>
            }
          >
            {data.surgeryEconomics.recentSnapshots.map((row) => (
              <tr key={row.id ?? `${row.case_id}-${row.calculated_at}`} className={financialOsClasses.tableRow}>
                <td className={financialOsClasses.tableCellStrong}>{row.patient_label ?? "—"}</td>
                <td className={financialOsClasses.tableCell}>{row.procedure_type}</td>
                <td className={financialOsClasses.tableCellMono}>{fmtMoney(row.revenue_cents, data.surgeryEconomics.currency)}</td>
                <td className={financialOsClasses.tableCellMono}>{fmtMoney(row.total_cost_cents, data.surgeryEconomics.currency)}</td>
                <td className={financialOsClasses.tableCellStrong}>{fmtMoney(row.gross_profit_cents, data.surgeryEconomics.currency)}</td>
                <td className={financialOsClasses.tableCell}>{row.gross_margin_percentage.toFixed(1)}%</td>
                <td className={financialOsClasses.tableCellMono}>{row.graft_count ?? "—"}</td>
                <td className={financialOsClasses.tableCellMono}>
                  {row.revenue_per_graft_cents != null ? fmtMoney(row.revenue_per_graft_cents, data.surgeryEconomics.currency) : "—"}
                </td>
              </tr>
            ))}
          </FinancialOsTable>
        </div>
      </FinancialOsSectionCard>

      <FinancialOsSectionCard
        title="Revenue attribution"
        kicker="LeadFlow"
        description="Connect payments and surgery profitability to lead source, campaign, consultant, and clinic."
      >
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
        <dl className={financialOsClasses.metricGrid}>
          <FinancialOsMetricTile
            label="Best converting source"
            value={data.revenueAttribution.metrics.best_converting_source?.source.replace(/_/g, " ") ?? "—"}
            foot={
              data.revenueAttribution.metrics.best_converting_source
                ? `${data.revenueAttribution.metrics.best_converting_source.conversion_rate}% lead → consult`
                : "Needs leads and consults in range"
            }
          />
          <FinancialOsMetricTile
            label="Highest margin source"
            value={data.revenueAttribution.metrics.highest_margin_source?.source.replace(/_/g, " ") ?? "—"}
            foot={
              data.revenueAttribution.metrics.highest_margin_source
                ? `${data.revenueAttribution.metrics.highest_margin_source.margin_percentage.toFixed(1)}% gross margin`
                : "Needs attributed gross profit"
            }
          />
          <FinancialOsMetricTile
            label="Unknown attribution"
            value={`${data.revenueAttribution.metrics.unknown_attribution_percentage.toFixed(1)}%`}
            foot="Share of collected revenue without resolved source"
          />
          <FinancialOsMetricTile
            label="Top source revenue"
            value={
              data.revenueAttribution.metrics.revenue_by_source[0]
                ? fmtMoney(data.revenueAttribution.metrics.revenue_by_source[0].cents, data.revenueAttribution.currency)
                : "—"
            }
            foot={data.revenueAttribution.metrics.revenue_by_source[0]?.source.replace(/_/g, " ") ?? "No events yet"}
          />
        </dl>

        <div className="mt-4 grid gap-4 lg:grid-cols-2">
          <div className={financialOsClasses.subPanel}>
            <p className="text-xs font-semibold uppercase tracking-[0.12em] text-slate-500">Revenue by source</p>
            <ul className="mt-2 space-y-1 text-xs text-slate-300">
              {data.revenueAttribution.metrics.revenue_by_source.length === 0 ? (
                <li className="text-slate-500">No attribution events in range.</li>
              ) : (
                data.revenueAttribution.metrics.revenue_by_source.map((row) => (
                  <li key={row.source} className="flex justify-between gap-2">
                    <span>{row.source.replace(/_/g, " ")}</span>
                    <span className="font-mono text-slate-100">{fmtMoney(row.cents, data.revenueAttribution.currency)}</span>
                  </li>
                ))
              )}
            </ul>
          </div>
          <div className={financialOsClasses.subPanel}>
            <p className="text-xs font-semibold uppercase tracking-[0.12em] text-slate-500">Gross profit by source</p>
            <ul className="mt-2 space-y-1 text-xs text-slate-300">
              {data.revenueAttribution.metrics.gross_profit_by_source.length === 0 ? (
                <li className="text-slate-500">Gross profit appears after surgery snapshots.</li>
              ) : (
                data.revenueAttribution.metrics.gross_profit_by_source.map((row) => (
                  <li key={row.source} className="flex justify-between gap-2">
                    <span>{row.source.replace(/_/g, " ")}</span>
                    <span className="font-mono text-slate-100">{fmtMoney(row.cents, data.revenueAttribution.currency)}</span>
                  </li>
                ))
              )}
            </ul>
          </div>
        </div>

        <div className="mt-4">
          <p className="mb-2 text-xs font-semibold uppercase tracking-[0.12em] text-slate-500">Attribution breakdown</p>
          <FinancialOsTable
            isEmpty={data.revenueAttribution.rows.length === 0}
            emptyMessage="No revenue attribution events yet. Events are recorded on payment, invoice settlement, and surgery profitability snapshots."
            head={
              <>
                <FinancialOsTh>Source</FinancialOsTh>
                <FinancialOsTh>Campaign</FinancialOsTh>
                <FinancialOsTh>Leads</FinancialOsTh>
                <FinancialOsTh>Consults</FinancialOsTh>
                <FinancialOsTh>Invoices</FinancialOsTh>
                <FinancialOsTh>Collected</FinancialOsTh>
                <FinancialOsTh>Gross profit</FinancialOsTh>
                <FinancialOsTh>Margin</FinancialOsTh>
                <FinancialOsTh>Confidence</FinancialOsTh>
              </>
            }
          >
            {data.revenueAttribution.rows.map((row) => (
              <tr key={`${row.source}-${row.campaign}`} className={financialOsClasses.tableRow}>
                <td className={financialOsClasses.tableCellStrong}>{row.source.replace(/_/g, " ")}</td>
                <td className={financialOsClasses.tableCell}>{row.campaign}</td>
                <td className={financialOsClasses.tableCellMono}>{row.leads}</td>
                <td className={financialOsClasses.tableCellMono}>{row.consults}</td>
                <td className={financialOsClasses.tableCellMono}>{row.invoices}</td>
                <td className={financialOsClasses.tableCellMono}>{fmtMoney(row.collected_revenue_cents, data.revenueAttribution.currency)}</td>
                <td className={financialOsClasses.tableCellMono}>{fmtMoney(row.gross_profit_cents, data.revenueAttribution.currency)}</td>
                <td className={financialOsClasses.tableCell}>{row.margin_percentage != null ? `${row.margin_percentage.toFixed(1)}%` : "—"}</td>
                <td className={financialOsClasses.tableCell}>{row.confidence}</td>
              </tr>
            ))}
          </FinancialOsTable>
        </div>
      </FinancialOsSectionCard>

      <div className={financialOsClasses.dashboardGrid}>
        <FinancialOsSectionCard title="Recent transactions" kicker="Ledger" description="Append-only entries from fi_financial_transactions.">
          <FinancialOsTable
            isEmpty={data.recentTransactions.length === 0}
            emptyMessage="No ledger transactions yet."
            head={
              <>
                <FinancialOsTh>When</FinancialOsTh>
                <FinancialOsTh>Kind</FinancialOsTh>
                <FinancialOsTh>Module</FinancialOsTh>
                <FinancialOsTh>Amount</FinancialOsTh>
              </>
            }
          >
            {data.recentTransactions.map((tx) => (
              <tr key={tx.id} className={financialOsClasses.tableRow}>
                <td className={financialOsClasses.tableCellMono}>{fmtWhen(tx.created_at)}</td>
                <td className={financialOsClasses.tableCell}>{txKindLabel(tx.transaction_kind)}</td>
                <td className={financialOsClasses.tableCellMono}>{tx.source_module}</td>
                <td className={financialOsClasses.tableCellStrong}>
                  {tx.direction === "debit" ? "−" : "+"}
                  {fmtMoney(tx.amount_cents, tx.currency)}
                </td>
              </tr>
            ))}
          </FinancialOsTable>
        </FinancialOsSectionCard>

        <FinancialOsSectionCard title="Open invoices" kicker="Collection" description="Sent / awaiting payment / partial / overdue balances.">
          <FinancialOsTable
            isEmpty={data.recentOpenInvoices.length === 0}
            emptyMessage="No open invoice balances."
            head={
              <>
                <FinancialOsTh>Invoice</FinancialOsTh>
                <FinancialOsTh>Status</FinancialOsTh>
                <FinancialOsTh>Due</FinancialOsTh>
                <FinancialOsTh>Balance</FinancialOsTh>
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
                      inv.status === "overdue" ? financialOsStatusBadgeTones.warning : financialOsStatusBadgeTones.neutral
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
                <td className={financialOsClasses.tableCellStrong}>{fmtMoney(inv.remaining_balance_cents, inv.currency)}</td>
              </tr>
            ))}
          </FinancialOsTable>
        </FinancialOsSectionCard>
      </div>

      <FinancialOsSectionCard title="Module integrations" kicker="Cross-OS">
        <ul className="grid gap-2 text-sm text-slate-300 sm:grid-cols-3">
          <li className={financialOsClasses.subPanel}>
            <span className="font-semibold text-slate-100">ConsultationOS</span>
            <p className="mt-1 text-xs text-slate-400">Consultation quotes create invoices and ledger entries via RevenueOS.</p>
          </li>
          <li className={financialOsClasses.subPanel}>
            <span className="font-semibold text-slate-100">SurgeryOS</span>
            <p className="mt-1 text-xs text-slate-400">Deposit and balance invoices use procedure-scoped deposit rules.</p>
          </li>
          <li className={financialOsClasses.subPanel}>
            <span className="font-semibold text-slate-100">LeadFlow</span>
            <p className="mt-1 text-xs text-slate-400">Payment events append CRM activity and anchor ledger rows on lead_id.</p>
          </li>
        </ul>
      </FinancialOsSectionCard>
    </div>
  );
}
