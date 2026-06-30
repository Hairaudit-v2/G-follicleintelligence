"use client";

import Link from "next/link";

import { cn } from "@/lib/utils";
import { FinancialClearanceBadge } from "@/src/components/fi/financial/FinancialClearanceBadge";
import type { FinancialClearanceResult } from "@/src/lib/financialOs/financialClearanceCore";

function formatMoney(cents: number, currency = "AUD"): string {
  const n = cents / 100;
  try {
    return new Intl.NumberFormat("en-AU", { style: "currency", currency }).format(n);
  } catch {
    return `${currency} ${n.toFixed(2)}`;
  }
}

/** Financial clearance summary for case detail and surgery/clinic boards. Use `variant="dark"` on FI OS dark surfaces; `variant="light"` only on light case-detail panels. FinancialOS command-centre pages do not render this component. */
export function FinancialClearancePanel(props: {
  tenantId: string;
  clearance: FinancialClearanceResult;
  currency?: string;
  variant?: "light" | "dark";
  compact?: boolean;
  className?: string;
}) {
  const { tenantId, clearance, currency = "AUD", variant = "light", compact = false, className } = props;
  const base = `/fi-admin/${tenantId}/financial`;
  const muted = clearance.clearance_state === "unavailable";
  const linkCls =
    variant === "dark" ? "text-cyan-400/95 hover:text-cyan-300" : "text-blue-300 hover:text-blue-300 hover:underline";

  if (compact) {
    return (
      <div className={cn("mt-2 flex max-w-full flex-col gap-1.5", className)}>
        <FinancialClearanceBadge
          state={clearance.clearance_state}
          label={clearance.clearance_label}
          variant={variant}
          showSafeIndicator
          financiallySafeToProceed={clearance.financially_safe_to_proceed}
        />
        {!muted ? (
          <p className={cn("text-[0.62rem]", variant === "dark" ? "text-slate-400" : "text-slate-400")}>
            {clearance.clearance_reason}
          </p>
        ) : null}
      </div>
    );
  }

  return (
    <div
      className={cn(
        "rounded-lg border p-3 text-sm",
        variant === "dark" ? "border-white/[0.08] bg-white/[0.03]" : "border-white/[0.08] bg-white/[0.03]",
        className
      )}
    >
      <div className="flex flex-wrap items-start justify-between gap-2">
        <FinancialClearanceBadge
          state={clearance.clearance_state}
          label={clearance.clearance_label}
          variant={variant}
          showSafeIndicator
          financiallySafeToProceed={clearance.financially_safe_to_proceed}
        />
        {!muted ? (
          <span className="flex flex-wrap gap-x-3 text-xs">
            <Link href={`${base}/invoices`} className={linkCls}>
              Invoices
            </Link>
            <Link href={`${base}/payment-pathways`} className={linkCls}>
              Pathways
            </Link>
            <Link href={`${base}/pathway-inbox`} className={linkCls}>
              Pathway inbox
            </Link>
          </span>
        ) : null}
      </div>

      {!muted ? (
        <>
          <p className={cn("mt-2 text-xs", variant === "dark" ? "text-slate-300" : "text-slate-300")}>
            {clearance.clearance_reason}
          </p>
          {clearance.next_required_action ? (
            <p className={cn("mt-1 text-xs font-medium", variant === "dark" ? "text-amber-200" : "text-amber-200")}>
              Next: {clearance.next_required_action}
            </p>
          ) : null}
          <dl className="mt-3 grid grid-cols-2 gap-x-3 gap-y-1 text-xs sm:grid-cols-4">
            <div>
              <dt className={variant === "dark" ? "text-slate-500" : "text-gray-500"}>Paid</dt>
              <dd className={cn("font-mono", variant === "dark" ? "text-slate-100" : "text-slate-100")}>
                {formatMoney(clearance.amount_paid_cents, currency)}
              </dd>
            </div>
            <div>
              <dt className={variant === "dark" ? "text-slate-500" : "text-gray-500"}>Balance due</dt>
              <dd className={cn("font-mono", variant === "dark" ? "text-slate-100" : "text-slate-100")}>
                {formatMoney(clearance.balance_due_cents, currency)}
              </dd>
            </div>
          </dl>
          {clearance.blocking_factors.length ? (
            <div className="mt-3">
              <p className={cn("text-[0.65rem] font-semibold uppercase tracking-wide", variant === "dark" ? "text-rose-200" : "text-rose-300")}>
                Blockers
              </p>
              <ul className={cn("mt-1 list-inside list-disc text-xs", variant === "dark" ? "text-rose-100" : "text-rose-300")}>
                {clearance.blocking_factors.map((f) => (
                  <li key={f}>{f}</li>
                ))}
              </ul>
            </div>
          ) : null}
          {clearance.warning_factors.length ? (
            <div className="mt-2">
              <p className={cn("text-[0.65rem] font-semibold uppercase tracking-wide", variant === "dark" ? "text-amber-200" : "text-amber-300")}>
                Warnings
              </p>
              <ul className={cn("mt-1 list-inside list-disc text-xs", variant === "dark" ? "text-amber-100" : "text-amber-200")}>
                {clearance.warning_factors.map((f) => (
                  <li key={f}>{f}</li>
                ))}
              </ul>
            </div>
          ) : null}
        </>
      ) : null}
    </div>
  );
}
