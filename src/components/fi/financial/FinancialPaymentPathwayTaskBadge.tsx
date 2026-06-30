import {
  financialOsStatusBadgeBase,
  financialOsStatusBadgeTones,
  resolveFinancialOsRecordStatusTone,
} from "@/src/components/fi-admin/financial-os/financialOsStatusBadgeStyles";
import type {
  FiPaymentPathwayTaskPriority,
  FiPaymentPathwayTaskStatus,
} from "@/src/lib/financialOs/financialPaymentPathwayInboxCore";

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
  const { status, priority, variant = "dark" } = props;
  const isUrgent = priority === "urgent";
  const isHigh = priority === "high";
  const statusTone = resolveFinancialOsRecordStatusTone(status);

  const toneDark =
    isUrgent || isHigh
      ? isUrgent
        ? financialOsStatusBadgeTones.danger
        : financialOsStatusBadgeTones.warning
      : financialOsStatusBadgeTones[statusTone];

  const toneLight = isUrgent
    ? "border-rose-500/20 bg-rose-500/10 text-rose-300"
    : isHigh
      ? "border-amber-400/20 bg-amber-400/10 text-amber-200"
      : "border-white/[0.08] bg-white/[0.03] text-slate-300";

  const tone = variant === "dark" ? toneDark : toneLight;
  const base =
    variant === "dark"
      ? financialOsStatusBadgeBase
      : "inline-flex items-center gap-1.5 rounded-md border px-2 py-0.5 text-[0.65rem] font-semibold uppercase tracking-wide";

  return (
    <span className={`${base} ${tone}`}>
      <span>{pathwayTaskStatusLabel(status)}</span>
      {priority !== "normal" ? (
        <span className="opacity-80">· {pathwayTaskPriorityLabel(priority)}</span>
      ) : null}
    </span>
  );
}
