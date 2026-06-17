import { cn } from "@/lib/utils";
import type { FiInternationalTransferStatus } from "@/src/lib/financialOs/financialInternationalTransferCore";

const STATUS_TONE: Record<FiInternationalTransferStatus, string> = {
  instructions_required: "bg-violet-50 text-violet-900",
  instructions_sent: "bg-sky-50 text-sky-900",
  awaiting_transfer: "bg-amber-50 text-amber-900",
  proof_received: "bg-indigo-50 text-indigo-900",
  under_reconciliation: "bg-purple-50 text-purple-900",
  settlement_pending: "bg-orange-50 text-orange-900",
  partially_settled: "bg-yellow-50 text-yellow-900",
  settled: "bg-emerald-100 text-emerald-950",
  variance_review: "bg-rose-50 text-rose-900",
  rejected: "bg-rose-100 text-rose-950",
  cancelled: "bg-slate-200 text-slate-700",
};

export function FinancialInternationalTransferStatusBadge(props: {
  status: FiInternationalTransferStatus;
  className?: string;
}) {
  return (
    <span
      className={cn(
        "inline-flex rounded px-1.5 py-0.5 text-[10px] font-semibold uppercase tracking-wide",
        STATUS_TONE[props.status],
        props.className
      )}
    >
      {props.status.replace(/_/g, " ")}
    </span>
  );
}
