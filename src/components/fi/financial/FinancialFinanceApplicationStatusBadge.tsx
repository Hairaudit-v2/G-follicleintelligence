import { cn } from "@/lib/utils";
import {
  financialOsStatusBadgeBase,
  financialOsStatusBadgeTones,
} from "@/src/components/fi-admin/financial-os/financialOsStatusBadgeStyles";
import type { FiFinanceApplicationStatus } from "@/src/lib/financialOs/financialFinanceApplicationsCore";

const STATUS_TONE_DARK: Record<FiFinanceApplicationStatus, string> = {
  draft: financialOsStatusBadgeTones.neutral,
  documents_pending: financialOsStatusBadgeTones.pending,
  submitted: financialOsStatusBadgeTones.info,
  under_review: financialOsStatusBadgeTones.review,
  approved: financialOsStatusBadgeTones.success,
  rejected: financialOsStatusBadgeTones.danger,
  settlement_pending: financialOsStatusBadgeTones.warning,
  settled: financialOsStatusBadgeTones.success,
  cancelled: financialOsStatusBadgeTones.cancelled,
};

const STATUS_TONE_LIGHT: Record<FiFinanceApplicationStatus, string> = {
  draft: "bg-white/[0.06] text-slate-300",
  documents_pending: "bg-amber-400/10 text-amber-200",
  submitted: "bg-cyan-500/10 text-cyan-200",
  under_review: "bg-indigo-500/10 text-indigo-300",
  approved: "bg-emerald-500/10 text-emerald-300",
  rejected: "bg-rose-500/10 text-rose-300",
  settlement_pending: "bg-orange-500/10 text-orange-300",
  settled: "bg-emerald-500/15 text-emerald-200",
  cancelled: "bg-white/[0.08] text-slate-300",
};

export function FinancialFinanceApplicationStatusBadge(props: {
  status: FiFinanceApplicationStatus;
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
