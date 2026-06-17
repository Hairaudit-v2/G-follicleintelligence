import { cn } from "@/lib/utils";
import type { FiSuperReleaseApplicationStatus } from "@/src/lib/financialOs/financialSuperReleaseCore";

const STATUS_TONE: Record<FiSuperReleaseApplicationStatus, string> = {
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
