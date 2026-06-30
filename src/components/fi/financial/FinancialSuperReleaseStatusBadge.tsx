import { cn } from "@/lib/utils";
import {
  financialOsStatusBadgeBase,
  financialOsStatusBadgeTones,
} from "@/src/components/fi-admin/financial-os/financialOsStatusBadgeStyles";
import type { FiSuperReleaseApplicationStatus } from "@/src/lib/financialOs/financialSuperReleaseCore";

const STATUS_TONE_DARK: Record<FiSuperReleaseApplicationStatus, string> = {
  draft: financialOsStatusBadgeTones.neutral,
  eligibility_review: financialOsStatusBadgeTones.violet,
  documents_pending: financialOsStatusBadgeTones.pending,
  clinical_letter_required: financialOsStatusBadgeTones.purple,
  ready_for_submission: financialOsStatusBadgeTones.info,
  submitted: financialOsStatusBadgeTones.info,
  under_review: financialOsStatusBadgeTones.review,
  approved: financialOsStatusBadgeTones.success,
  rejected: financialOsStatusBadgeTones.danger,
  release_pending: financialOsStatusBadgeTones.warning,
  funds_released: financialOsStatusBadgeTones.success,
  cancelled: financialOsStatusBadgeTones.cancelled,
};

const STATUS_TONE_LIGHT: Record<FiSuperReleaseApplicationStatus, string> = {
  draft: "bg-white/[0.06] text-slate-300",
  eligibility_review: "bg-violet-500/10 text-violet-300",
  documents_pending: "bg-amber-400/10 text-amber-200",
  clinical_letter_required: "bg-violet-500/10 text-violet-300",
  ready_for_submission: "bg-cyan-500/10 text-cyan-200",
  submitted: "bg-cyan-500/10 text-cyan-200",
  under_review: "bg-indigo-500/10 text-indigo-300",
  approved: "bg-emerald-500/10 text-emerald-300",
  rejected: "bg-rose-500/10 text-rose-300",
  release_pending: "bg-orange-500/10 text-orange-300",
  funds_released: "bg-emerald-500/15 text-emerald-200",
  cancelled: "bg-white/[0.08] text-slate-300",
};

export function FinancialSuperReleaseStatusBadge(props: {
  status: FiSuperReleaseApplicationStatus;
  className?: string;
  variant?: "dark" | "light";
}) {
  const { variant = "dark" } = props;
  const tone =
    variant === "dark" ? STATUS_TONE_DARK[props.status] : STATUS_TONE_LIGHT[props.status];
  const base =
    variant === "dark"
      ? financialOsStatusBadgeBase
      : "inline-flex rounded px-1.5 py-0.5 text-[10px] font-semibold uppercase tracking-wide";

  return <span className={cn(base, tone, props.className)}>{props.status.replace(/_/g, " ")}</span>;
}
