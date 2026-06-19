"use client";

import Link from "next/link";

import { FinancialOsRecordStatusBadge } from "@/src/components/fi-admin/financial-os/FinancialOsRecordStatusBadge";
import type { CaseAccountsReceivableSummary } from "@/src/lib/financialOs/financialAccountsReceivable.server";
import {
  FI_AR_RECEIVABLE_TYPE_LABELS,
  FI_AR_STATUS_LABELS,
  type FiCaseArDisplayStatus,
} from "@/src/lib/financialOs/financialAccountsReceivableCore";

function displayTone(status: FiCaseArDisplayStatus): string {
  if (status === "high_risk_overdue") return "critical";
  if (status === "payment_plan_active") return "awaiting_payment";
  if (status === "open_ar_case") return "overdue";
  if (status === "resolved") return "paid";
  return "draft";
}

export function FinancialCaseAccountsReceivableCard(props: {
  tenantId: string;
  caseId: string;
  summary: CaseAccountsReceivableSummary;
  currency?: string;
  variant?: "light" | "dark";
}) {
  const { tenantId, caseId, summary, currency = "AUD", variant = "light" } = props;
  const isLight = variant === "light";
  const shell = isLight ? "rounded border border-gray-200 bg-gray-50 p-3" : "rounded-lg border border-white/[0.06] bg-white/[0.02] p-3";
  const titleCls = isLight ? "text-xs font-semibold text-gray-900" : "text-xs font-semibold text-slate-100";
  const metaCls = isLight ? "text-[11px] text-gray-600" : "text-[11px] text-slate-400";
  const queueHref = `/fi-admin/${tenantId}/financial-os/accounts-receivable`;

  if (summary.display_status === "no_ar_issue") {
    return (
      <div className={shell}>
        <div className="flex items-center justify-between gap-2">
          <p className={titleCls}>Accounts receivable</p>
          <FinancialOsRecordStatusBadge status="draft" label={summary.display_label} />
        </div>
        <p className={`mt-1 ${metaCls}`}>No open collections issues for this case.</p>
      </div>
    );
  }

  return (
    <div className={shell}>
      <div className="flex flex-wrap items-center justify-between gap-2">
        <p className={titleCls}>Accounts receivable</p>
        <FinancialOsRecordStatusBadge status={displayTone(summary.display_status)} label={summary.display_label} />
      </div>
      <p className={`mt-1 ${metaCls}`}>
        {summary.open_cases.length} open case(s) · {currency}{" "}
        {(summary.total_outstanding_cents / 100).toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}{" "}
        outstanding
      </p>
      {summary.open_cases.length > 0 ? (
        <ul className={`mt-2 space-y-1 ${metaCls}`}>
          {summary.open_cases.slice(0, 3).map((c) => (
            <li key={c.id} className="flex justify-between gap-2">
              <span>{FI_AR_RECEIVABLE_TYPE_LABELS[c.receivable_type]}</span>
              <span>{FI_AR_STATUS_LABELS[c.status]}</span>
            </li>
          ))}
        </ul>
      ) : null}
      <div className="mt-2">
        <Link
          href={queueHref}
          className={isLight ? "text-xs font-medium text-blue-700 hover:underline" : "text-xs font-medium text-cyan-400/95 hover:text-cyan-300"}
        >
          Open AR work queue →
        </Link>
        {" · "}
        <Link
          href={`/fi-admin/${tenantId}/cases/${caseId}`}
          className={isLight ? "text-xs text-gray-500" : "text-xs text-slate-500"}
        >
          Case financials
        </Link>
      </div>
    </div>
  );
}
