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
  draft: "bg-slate-100 text-slate-700",
  eligibility_review: "bg-violet-50 text-violet-900",
  documents_pending: "bg-amber-50 text-amber-900",
  clinical_letter_required: "bg-purple-50 text-purple-900",
  ready_for_submission: "bg-sky-50 text-sky-900",
  submitted: "bg-sky-50 text-sky-900",
  under_review: "bg-indigo-50 text-indigo-900",
  approved: "bg-emerald-50 text-emerald-900",
  rejected: "bg-rose-50 text-rose-900",
  release_pending: "bg-orange-50 text-orange-900",
  funds_released: "bg-emerald-100 text-emerald-950",
  cancelled: "bg-slate-200 text-slate-700",
};

export function FinancialSuperReleaseStatusBadge(props: {
  status: FiSuperReleaseApplicationStatus;
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
