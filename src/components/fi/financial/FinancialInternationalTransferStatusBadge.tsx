import { cn } from "@/lib/utils";
import {
  financialOsStatusBadgeBase,
  financialOsStatusBadgeTones,
} from "@/src/components/fi-admin/financial-os/financialOsStatusBadgeStyles";
import type { FiInternationalTransferStatus } from "@/src/lib/financialOs/financialInternationalTransferCore";

const STATUS_TONE_DARK: Record<FiInternationalTransferStatus, string> = {
  instructions_required: financialOsStatusBadgeTones.violet,
  instructions_sent: financialOsStatusBadgeTones.info,
  awaiting_transfer: financialOsStatusBadgeTones.pending,
  proof_received: financialOsStatusBadgeTones.review,
  under_reconciliation: financialOsStatusBadgeTones.purple,
  settlement_pending: financialOsStatusBadgeTones.warning,
  partially_settled: financialOsStatusBadgeTones.warning,
  settled: financialOsStatusBadgeTones.success,
  variance_review: financialOsStatusBadgeTones.danger,
  rejected: financialOsStatusBadgeTones.danger,
  cancelled: financialOsStatusBadgeTones.cancelled,
};

const STATUS_TONE_LIGHT: Record<FiInternationalTransferStatus, string> = {
  instructions_required: "bg-violet-500/10 text-violet-300",
  instructions_sent: "bg-cyan-500/10 text-cyan-200",
  awaiting_transfer: "bg-amber-400/10 text-amber-200",
  proof_received: "bg-indigo-500/10 text-indigo-300",
  under_reconciliation: "bg-violet-500/10 text-violet-300",
  settlement_pending: "bg-orange-500/10 text-orange-300",
  partially_settled: "bg-yellow-50 text-yellow-900",
  settled: "bg-emerald-500/15 text-emerald-200",
  variance_review: "bg-rose-500/10 text-rose-300",
  rejected: "bg-rose-500/15 text-rose-200",
  cancelled: "bg-white/[0.08] text-slate-300",
};

export function FinancialInternationalTransferStatusBadge(props: {
  status: FiInternationalTransferStatus;
  className?: string;
  variant?: "dark" | "light";
}) {
  const { variant = "dark" } = props;
  const tone = variant === "dark" ? STATUS_TONE_DARK[props.status] : STATUS_TONE_LIGHT[props.status];
  const base =
    variant === "dark"
      ? financialOsStatusBadgeBase
      : "inline-flex rounded px-1.5 py-0.5 text-[10px] font-semibold uppercase tracking-wide";

  return (
    <span className={cn(base, tone, props.className)}>
      {props.status.replace(/_/g, " ")}
    </span>
  );
}
