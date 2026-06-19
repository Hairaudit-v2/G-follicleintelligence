"use client";

import Link from "next/link";

import {
  FinancialOsMetricTile,
  FinancialOsSectionCard,
  FinancialOsTable,
  FinancialOsTh,
  financialOsClasses,
} from "@/src/components/fi-admin/financial-os/financialOsUi";
import { FinancialOsRecordStatusBadge } from "@/src/components/fi-admin/financial-os/FinancialOsRecordStatusBadge";
import type { AccountsReceivableDashboardMetrics } from "@/src/lib/financialOs/financialAccountsReceivableCore";
import type { AccountsReceivableWorkQueueRow } from "@/src/lib/financialOs/financialAccountsReceivable.server";
import {
  FI_AR_RECEIVABLE_TYPE_LABELS,
  FI_AR_RISK_LABELS,
  FI_AR_STATUS_LABELS,
} from "@/src/lib/financialOs/financialAccountsReceivableCore";

function fmtMoney(cents: number, currency: string): string {
  return `${currency} ${(cents / 100).toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
}

function fmtWhen(iso: string | null): string {
  if (!iso) return "—";
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return iso;
  return d.toLocaleString(undefined, { month: "short", day: "numeric", hour: "2-digit", minute: "2-digit" });
}

function riskStatus(risk: string): string {
  if (risk === "critical") return "critical";
  if (risk === "high") return "overdue";
  if (risk === "medium") return "awaiting_payment";
  return "draft";
}

export function FinancialOsAccountsReceivablePanel(props: {
  tenantId: string;
  currency: string;
  metrics: AccountsReceivableDashboardMetrics;
  rows: AccountsReceivableWorkQueueRow[];
}) {
  const { tenantId, currency, metrics, rows } = props;
  const queueHref = `/fi-admin/${tenantId}/financial-os/accounts-receivable`;
  const openRows = rows.filter((r) => r.outstanding_amount_cents > 0 && r.status !== "resolved" && r.status !== "written_off");

  return (
    <FinancialOsSectionCard
      title="Accounts receivable"
      kicker="Collections"
      description={
        <>
          Identify, prioritise, and recover outstanding revenue across invoices, deposits, and balances.{" "}
          <Link href={queueHref} className={financialOsClasses.textButton}>
            Open work queue →
          </Link>
        </>
      }
    >
      <dl className={financialOsClasses.metricGrid}>
        <FinancialOsMetricTile
          label="Total outstanding"
          value={fmtMoney(metrics.totalOutstandingCents, currency)}
          foot={`${metrics.openCaseCount} open AR cases`}
        />
        <FinancialOsMetricTile
          label="Overdue revenue"
          value={fmtMoney(metrics.overdueRevenueCents, currency)}
          foot="Outstanding with days overdue > 0"
        />
        <FinancialOsMetricTile
          label="Critical AR cases"
          value={String(metrics.criticalCaseCount)}
          foot="Risk level critical"
        />
        <FinancialOsMetricTile
          label="Deposits at risk"
          value={fmtMoney(metrics.depositsAtRiskCents, currency)}
          foot="Open surgery deposit receivables"
        />
        <FinancialOsMetricTile
          label="Average days overdue"
          value={metrics.averageDaysOverdue > 0 ? `${metrics.averageDaysOverdue} days` : "—"}
          foot="Mean across overdue open cases"
        />
      </dl>

      <div className="mt-4">
        <p className="mb-2 text-xs font-semibold uppercase tracking-[0.12em] text-slate-500">Priority AR cases</p>
        <FinancialOsTable
          isEmpty={openRows.length === 0}
          emptyMessage="No open accounts receivable cases. Overdue invoices will auto-open cases via FinancialOS automation."
          head={
            <>
              <FinancialOsTh>Patient</FinancialOsTh>
              <FinancialOsTh>Type</FinancialOsTh>
              <FinancialOsTh>Invoice</FinancialOsTh>
              <FinancialOsTh>Outstanding</FinancialOsTh>
              <FinancialOsTh>Days overdue</FinancialOsTh>
              <FinancialOsTh>Risk</FinancialOsTh>
              <FinancialOsTh>Status</FinancialOsTh>
              <FinancialOsTh>Next action</FinancialOsTh>
              <FinancialOsTh>Owner</FinancialOsTh>
            </>
          }
        >
          {openRows.slice(0, 8).map((row) => (
            <tr key={row.id} className={financialOsClasses.tableRow}>
              <td className={financialOsClasses.tableCellStrong}>{row.patient_label ?? "—"}</td>
              <td className={financialOsClasses.tableCell}>{FI_AR_RECEIVABLE_TYPE_LABELS[row.receivable_type]}</td>
              <td className={financialOsClasses.tableCell}>{row.invoice_label ?? "—"}</td>
              <td className={financialOsClasses.tableCellMono}>{fmtMoney(row.outstanding_amount_cents, currency)}</td>
              <td className={financialOsClasses.tableCellMono}>{row.days_overdue > 0 ? row.days_overdue : "—"}</td>
              <td className={financialOsClasses.tableCell}>
                <FinancialOsRecordStatusBadge status={riskStatus(row.risk_level)} label={FI_AR_RISK_LABELS[row.risk_level]} />
              </td>
              <td className={financialOsClasses.tableCell}>
                <FinancialOsRecordStatusBadge status={row.status} label={FI_AR_STATUS_LABELS[row.status]} />
              </td>
              <td className={financialOsClasses.tableCell}>{fmtWhen(row.next_action_at)}</td>
              <td className={financialOsClasses.tableCell}>{row.owner_label ?? "Unassigned"}</td>
            </tr>
          ))}
        </FinancialOsTable>
      </div>
    </FinancialOsSectionCard>
  );
}
