import type { FiPaymentPathwayTaskPriority, FiPaymentPathwayTaskStatus } from "@/src/lib/financialOs/financialPaymentPathwayInboxCore";

const STATUS_LABELS: Record<FiPaymentPathwayTaskStatus, string> = {
  open: "Open",
  in_progress: "In progress",
  waiting_patient: "Waiting patient",
  waiting_provider: "Waiting provider",
  completed: "Completed",
  cancelled: "Cancelled",
};

const PRIORITY_LABELS: Record<FiPaymentPathwayTaskPriority, string> = {
  low: "Low",
  normal: "Normal",
  high: "High",
  urgent: "Urgent",
};

export function pathwayTaskStatusLabel(status: string): string {
  return STATUS_LABELS[status as FiPaymentPathwayTaskStatus] ?? status;
}

export function pathwayTaskPriorityLabel(priority: string): string {
  return PRIORITY_LABELS[priority as FiPaymentPathwayTaskPriority] ?? priority;
}

export function pathwayTaskTypeLabel(taskType: string): string {
  return taskType.replace(/_/g, " ");
}

export function FinancialPaymentPathwayTaskBadge(props: {
  status: string;
  priority: string;
  variant?: "dark" | "light";
}) {
  const { status, priority, variant = "light" } = props;
  const isUrgent = priority === "urgent";
  const isHigh = priority === "high";

  const toneDark = isUrgent
    ? "border-rose-500/40 bg-rose-500/10 text-rose-100"
    : isHigh
      ? "border-amber-500/40 bg-amber-500/10 text-amber-100"
      : "border-white/[0.08] bg-white/[0.03] text-slate-300";

  const toneLight = isUrgent
    ? "border-rose-200 bg-rose-50 text-rose-900"
    : isHigh
      ? "border-amber-200 bg-amber-50 text-amber-900"
      : "border-slate-200 bg-slate-50 text-slate-700";

  const tone = variant === "dark" ? toneDark : toneLight;

  return (
    <span className={`inline-flex items-center gap-1.5 rounded-md border px-2 py-0.5 text-[0.65rem] font-semibold uppercase tracking-wide ${tone}`}>
      <span>{pathwayTaskStatusLabel(status)}</span>
      {priority !== "normal" ? <span className="opacity-80">· {pathwayTaskPriorityLabel(priority)}</span> : null}
    </span>
  );
}
