"use client";

import { cn } from "@/lib/utils";
import {
  FINANCIAL_CLEARANCE_STATE_LABELS,
  type FinancialClearanceState,
} from "@/src/lib/financialOs/financialClearanceCore";

const STATUS_TONE: Record<FinancialClearanceState, string> = {
  unavailable: "bg-slate-200 text-slate-700",
  not_ready: "bg-slate-100 text-slate-800",
  deposit_ready: "bg-sky-50 text-sky-900",
  pathway_pending: "bg-indigo-50 text-indigo-900",
  attention_required: "bg-rose-100 text-rose-950",
  financially_cleared: "bg-emerald-100 text-emerald-950",
  paid_in_full: "bg-emerald-200 text-emerald-950",
};

const STATUS_TONE_DARK: Record<FinancialClearanceState, string> = {
  unavailable: "border-white/[0.08] bg-white/[0.03] text-slate-500",
  not_ready: "border-slate-500/30 bg-slate-500/10 text-slate-300",
  deposit_ready: "border-sky-500/30 bg-sky-500/10 text-sky-100",
  pathway_pending: "border-indigo-500/30 bg-indigo-500/10 text-indigo-100",
  attention_required: "border-rose-500/40 bg-rose-500/10 text-rose-100",
  financially_cleared: "border-emerald-500/30 bg-emerald-500/10 text-emerald-100",
  paid_in_full: "border-emerald-500/40 bg-emerald-500/15 text-emerald-100",
};

export function FinancialClearanceBadge(props: {
  state: FinancialClearanceState;
  label?: string;
  variant?: "light" | "dark";
  className?: string;
  showSafeIndicator?: boolean;
  financiallySafeToProceed?: boolean;
}) {
  const { state, variant = "light", className, showSafeIndicator = false, financiallySafeToProceed = false } = props;
  const label = props.label ?? FINANCIAL_CLEARANCE_STATE_LABELS[state];
  const tone = variant === "dark" ? STATUS_TONE_DARK[state] : STATUS_TONE[state];

  return (
    <span className="inline-flex flex-wrap items-center gap-1.5">
      <span
        className={cn(
          "inline-flex rounded-md border px-2 py-0.5 text-[0.65rem] font-semibold uppercase tracking-wide",
          variant === "light" && "border-transparent",
          tone,
          className
        )}
      >
        {label}
      </span>
      {showSafeIndicator ? (
        <span
          className={cn(
            "rounded px-1.5 py-0.5 text-[0.6rem] font-semibold uppercase tracking-wide",
            financiallySafeToProceed
              ? variant === "dark"
                ? "text-emerald-300"
                : "text-emerald-800"
              : variant === "dark"
                ? "text-amber-300"
                : "text-amber-800"
          )}
        >
          {financiallySafeToProceed ? "Safe to proceed" : "Review before day"}
        </span>
      ) : null}
    </span>
  );
}
