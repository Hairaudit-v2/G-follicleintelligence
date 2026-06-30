"use client";

import { cn } from "@/lib/utils";
import type { PaymentPathwayAttentionSummary } from "@/src/lib/financialOs/financialPaymentPathwayCore";

const PATHWAY_TYPE_LABELS: Record<string, string> = {
  pay_in_full: "Pay in full",
  deposit_balance: "Deposit + balance",
  installment_plan: "Installment plan",
  medical_finance: "Medical finance",
  super_release: "Super release",
  international_transfer: "International transfer",
  manual: "Manual / other",
};

const PATHWAY_STATUS_LABELS: Record<string, string> = {
  draft: "Draft",
  selected: "Selected",
  pending_patient_action: "Pending patient",
  pending_clinic_action: "Pending clinic",
  pending_provider: "Pending provider",
  approved: "Approved",
  rejected: "Rejected",
  settlement_pending: "Settlement pending",
  settled: "Settled",
  cancelled: "Cancelled",
};

export function pathwayTypeLabel(type: string | null): string {
  if (!type) return "—";
  return PATHWAY_TYPE_LABELS[type] ?? type;
}

export function pathwayStatusLabel(status: string | null): string {
  if (!status) return "—";
  return PATHWAY_STATUS_LABELS[status] ?? status;
}

/**
 * Compact pathway chip for boards (Tomorrow, Procedure Day, Surgery Readiness, Operations Centre,
 * case FinancialOS summary). Surfaces attention only — never blocks the surgery flow it sits on.
 */
export function FinancialPaymentPathwayBadge(props: {
  summary: PaymentPathwayAttentionSummary;
  variant?: "dark" | "light";
}) {
  const { summary, variant = "dark" } = props;

  if (!summary.hasActivePathway) {
    return (
      <span
        className={cn(
          "inline-flex w-fit items-center rounded-md border px-2 py-0.5 text-[0.62rem] font-medium uppercase tracking-wide",
          variant === "dark"
            ? "border-white/[0.08] bg-white/[0.03] text-slate-500"
            : "border-white/[0.08] bg-white/[0.03] text-gray-500"
        )}
      >
        No pathway selected
      </span>
    );
  }

  const toneDark = summary.pathway_attention_required
    ? "border-rose-500/40 bg-rose-500/10 text-rose-100"
    : summary.pathway_status === "settled"
      ? "border-emerald-500/25 bg-emerald-500/[0.08] text-emerald-100"
      : "border-cyan-500/25 bg-cyan-500/[0.06] text-cyan-100";

  const toneLight = summary.pathway_attention_required
    ? "border-rose-500/20 bg-rose-500/10 text-rose-300"
    : summary.pathway_status === "settled"
      ? "border-emerald-500/20 bg-emerald-500/10 text-emerald-300"
      : "border-cyan-500/20 bg-cyan-500/10 text-cyan-200";

  return (
    <span
      title={summary.pathway_attention_reason ?? undefined}
      className={cn(
        "inline-flex w-fit items-center gap-1 rounded-md border px-2 py-0.5 text-[0.62rem] font-semibold uppercase tracking-wide",
        variant === "dark" ? toneDark : toneLight
      )}
    >
      {pathwayTypeLabel(summary.pathway_type)} · {pathwayStatusLabel(summary.pathway_status)}
      {summary.pathway_attention_required ? " · Attention" : ""}
    </span>
  );
}
