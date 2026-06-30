"use client";

import Link from "next/link";

import { cn } from "@/lib/utils";
import {
  FINANCIAL_SURGERY_PIPELINE_UNAVAILABLE_COPY,
  AWAITING_FINANCIAL_WORKFLOW_COPY,
  type FinancialSurgeryPipelineStatus,
} from "@/src/lib/financialOs/financialSurgeryPipelineStatusCore";

function formatMoney(cents: number, currency: string): string {
  const n = cents / 100;
  try {
    return new Intl.NumberFormat("en-AU", {
      style: "currency",
      currency: currency || "AUD",
    }).format(n);
  } catch {
    return `${currency} ${n.toFixed(2)}`;
  }
}

export function FinancialSurgeryPipelineInline(props: {
  tenantId: string;
  caseId: string | null;
  status: FinancialSurgeryPipelineStatus;
  /** Dark SurgeryOS / ClinicOS boards vs light case detail. */
  variant?: "dark" | "light";
  /** Single-line chip + micro links (boards). */
  compact?: boolean;
}) {
  const { tenantId, caseId, status, variant = "dark", compact = true } = props;
  const base = `/fi-admin/${tenantId}/financial`;
  const muted = !status.financialDataAvailable;

  const toneDark = status.payment_attention_required
    ? "border-rose-500/40 bg-rose-500/10 text-rose-100"
    : muted
      ? "border-white/[0.08] bg-white/[0.03] text-slate-500"
      : status.summary_label === "Paid in full"
        ? "border-emerald-500/25 bg-emerald-500/[0.08] text-emerald-100"
        : "border-cyan-500/25 bg-cyan-500/[0.06] text-cyan-100";

  const toneLight = status.payment_attention_required
    ? "border-rose-500/20 bg-rose-500/10 text-rose-300"
    : muted
      ? "border-white/[0.08] bg-white/[0.03] text-slate-400"
      : status.summary_label === "Paid in full"
        ? "border-emerald-500/20 bg-emerald-500/10 text-emerald-300"
        : "border-cyan-500/20 bg-cyan-500/10 text-cyan-200";

  const tone = variant === "dark" ? toneDark : toneLight;
  const linkCls =
    variant === "dark"
      ? "text-cyan-400/95 hover:text-cyan-300"
      : "text-blue-300 hover:text-blue-300 hover:underline";

  const label = muted ? FINANCIAL_SURGERY_PIPELINE_UNAVAILABLE_COPY : status.summary_label;

  if (compact) {
    return (
      <div className="mt-2 flex max-w-full flex-col gap-1.5 sm:flex-row sm:flex-wrap sm:items-center sm:gap-x-3">
        <span
          className={cn(
            "inline-flex w-fit max-w-full rounded-md border px-2 py-0.5 text-[0.65rem] font-semibold uppercase tracking-wide",
            tone
          )}
        >
          {label}
        </span>
        {!muted ? (
          <span className="flex flex-wrap gap-x-3 text-[0.62rem] font-medium">
            {status.task_attention_required ? (
              <span className={variant === "dark" ? "text-amber-300" : "text-amber-300"}>
                {AWAITING_FINANCIAL_WORKFLOW_COPY}
              </span>
            ) : null}
            {status.financeApplicationAttention.finance_attention_labels.map((label) => (
              <span
                key={label}
                className={variant === "dark" ? "text-orange-300" : "text-orange-300"}
              >
                {label}
              </span>
            ))}
            {status.superReleaseApplicationAttention.super_release_attention_labels.map((label) => (
              <span
                key={label}
                className={variant === "dark" ? "text-orange-300" : "text-orange-300"}
              >
                {label}
              </span>
            ))}
            {status.internationalTransferApplicationAttention.international_transfer_attention_labels.map(
              (label) => (
                <span
                  key={label}
                  className={variant === "dark" ? "text-orange-300" : "text-orange-300"}
                >
                  {label}
                </span>
              )
            )}
            <Link href={`${base}/invoices`} className={linkCls}>
              Invoices
            </Link>
            <Link href={`${base}/payment-requests`} className={linkCls}>
              Payment requests
            </Link>
            <Link href={`${base}/pathway-inbox`} className={linkCls}>
              Pathway inbox
            </Link>
            <Link href={`${base}/finance-applications`} className={linkCls}>
              Finance apps
            </Link>
            <Link href={`${base}/super-release`} className={linkCls}>
              Super release
            </Link>
            <Link href={`${base}/international-transfers`} className={linkCls}>
              Intl transfers
            </Link>
            {caseId ? (
              <Link
                href={`/fi-admin/${tenantId}/cases/${encodeURIComponent(caseId)}`}
                className={linkCls}
              >
                Case
              </Link>
            ) : null}
          </span>
        ) : null}
      </div>
    );
  }

  return (
    <div
      className={cn(
        "rounded-lg border p-3 text-sm",
        variant === "dark"
          ? "border-white/[0.08] bg-white/[0.03]"
          : "border-white/[0.08] bg-white/[0.03]"
      )}
    >
      <div className="flex flex-wrap items-center justify-between gap-2">
        <span className={cn("rounded-md border px-2 py-0.5 text-xs font-semibold", tone)}>
          {label}
        </span>
        {!muted ? (
          <span className="flex flex-wrap gap-x-3 text-xs">
            <Link href={`${base}/invoices`} className={linkCls}>
              Invoices
            </Link>
            <Link href={`${base}/payment-requests`} className={linkCls}>
              Payment requests
            </Link>
            {caseId ? (
              <Link
                href={`/fi-admin/${tenantId}/cases/${encodeURIComponent(caseId)}`}
                className={linkCls}
              >
                Case
              </Link>
            ) : null}
          </span>
        ) : null}
      </div>
      {!muted ? (
        <dl className="mt-2 grid grid-cols-2 gap-x-3 gap-y-1 text-xs text-slate-400 sm:grid-cols-4">
          <div>
            <dt className="text-gray-500">Paid</dt>
            <dd className="font-mono text-slate-100">
              {formatMoney(status.amount_paid_cents, status.currency)}
            </dd>
          </div>
          <div>
            <dt className="text-gray-500">Balance due</dt>
            <dd className="font-mono text-slate-100">
              {formatMoney(status.balance_due_cents, status.currency)}
            </dd>
          </div>
          <div>
            <dt className="text-gray-500">Next due</dt>
            <dd className="font-mono text-slate-100">{status.next_payment_due_date ?? "—"}</dd>
          </div>
          <div>
            <dt className="text-gray-500">Latest pay link</dt>
            <dd className="truncate text-slate-100">
              {status.latest_payment_request_status ?? "—"}
            </dd>
          </div>
        </dl>
      ) : null}
    </div>
  );
}
