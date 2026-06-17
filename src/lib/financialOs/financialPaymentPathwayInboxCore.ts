/**
 * Pure FinancialOS payment pathway inbox logic (Phase 2C) — safe for unit tests without DB.
 */

import type { FiPaymentPathwayType } from "@/src/lib/financialOs/financialPaymentPathwayCore";

export type FiPaymentPathwayTaskType =
  | "finance_review"
  | "super_release_review"
  | "international_transfer_review"
  | "installment_review"
  | "manual_payment_review"
  | "follow_up_required";

export type FiPaymentPathwayTaskStatus =
  | "open"
  | "in_progress"
  | "waiting_patient"
  | "waiting_provider"
  | "completed"
  | "cancelled";

export type FiPaymentPathwayTaskPriority = "low" | "normal" | "high" | "urgent";

export type FiPaymentPathwayTaskRow = {
  id: string;
  task_type: FiPaymentPathwayTaskType;
  status: FiPaymentPathwayTaskStatus;
  priority: FiPaymentPathwayTaskPriority;
  assigned_to: string | null;
  due_date: string | null;
  created_at: string;
  updated_at: string;
};

export const OPEN_PATHWAY_TASK_STATUSES: readonly FiPaymentPathwayTaskStatus[] = [
  "open",
  "in_progress",
  "waiting_patient",
  "waiting_provider",
];

export const RESOLVED_PATHWAY_TASK_STATUSES: readonly FiPaymentPathwayTaskStatus[] = ["completed", "cancelled"];

const PATHWAY_TYPE_TO_TASK_TYPE: Partial<Record<FiPaymentPathwayType, FiPaymentPathwayTaskType>> = {
  medical_finance: "finance_review",
  super_release: "super_release_review",
  international_transfer: "international_transfer_review",
  installment_plan: "installment_review",
  manual: "manual_payment_review",
};

function ymd(s: string | null | undefined): string | null {
  const t = s?.trim();
  if (!t) return null;
  return t.length >= 10 ? t.slice(0, 10) : t;
}

function daysBetween(fromYmd: string, toYmd: string): number {
  const a = Date.parse(`${fromYmd}T00:00:00Z`);
  const b = Date.parse(`${toYmd}T00:00:00Z`);
  return Math.round((b - a) / 86_400_000);
}

function daysSinceIso(iso: string, todayYmd: string): number {
  const d = ymd(iso);
  if (!d) return 0;
  return daysBetween(d, todayYmd);
}

/**
 * Maps pathway type to auto-created inbox task type. Returns null for pay_in_full and deposit_balance.
 */
export function mapPathwayTypeToTaskType(pathwayType: FiPaymentPathwayType): FiPaymentPathwayTaskType | null {
  return PATHWAY_TYPE_TO_TASK_TYPE[pathwayType] ?? null;
}

export function isOpenPathwayTaskStatus(status: FiPaymentPathwayTaskStatus): boolean {
  return OPEN_PATHWAY_TASK_STATUSES.includes(status);
}

export function isUnresolvedOpenPathwayTaskStatus(status: FiPaymentPathwayTaskStatus): boolean {
  return isOpenPathwayTaskStatus(status);
}

export function filterUnresolvedOpenPathwayTasks(tasks: FiPaymentPathwayTaskRow[]): FiPaymentPathwayTaskRow[] {
  return tasks.filter((t) => isUnresolvedOpenPathwayTaskStatus(t.status));
}

export type PathwayTaskAttentionSummary = {
  task_attention_required: boolean;
  task_attention_reason: string | null;
  unresolved_open_task_count: number;
};

/**
 * Derives surgery / booking attention from unresolved open pathway inbox tasks.
 */
export function buildPathwayTaskAttentionSummary(tasks: FiPaymentPathwayTaskRow[]): PathwayTaskAttentionSummary {
  const unresolved = filterUnresolvedOpenPathwayTasks(tasks);
  if (!unresolved.length) {
    return {
      task_attention_required: false,
      task_attention_reason: null,
      unresolved_open_task_count: 0,
    };
  }
  const urgent = unresolved.some((t) => t.priority === "urgent");
  const reason = urgent
    ? "Awaiting financial workflow completion (urgent pathway task)"
    : "Awaiting financial workflow completion";
  return {
    task_attention_required: true,
    task_attention_reason: reason,
    unresolved_open_task_count: unresolved.length,
  };
}

export type ComputeTaskEscalationPriorityInput = {
  todayYmd: string;
  task: FiPaymentPathwayTaskRow;
  /** Pathway expected settlement date (YYYY-MM-DD), if known. */
  expectedSettlementDateYmd: string | null;
  /** Surgery date for linked booking (YYYY-MM-DD), if known. */
  surgeryDateYmd: string | null;
};

/**
 * Escalation rules for cron:
 * - open > 3 days → high
 * - waiting_patient > 7 days → urgent
 * - expected settlement date missed → urgent
 * - surgery within 7 days and unresolved task → urgent
 */
export function computeTaskEscalationPriority(input: ComputeTaskEscalationPriorityInput): FiPaymentPathwayTaskPriority | null {
  const { todayYmd, task, expectedSettlementDateYmd, surgeryDateYmd } = input;

  if (!isUnresolvedOpenPathwayTaskStatus(task.status)) return null;

  const expected = ymd(expectedSettlementDateYmd);
  const surgery = ymd(surgeryDateYmd);

  if (expected && expected < todayYmd) return "urgent";

  if (surgery) {
    const daysToSurgery = daysBetween(todayYmd, surgery);
    if (daysToSurgery >= 0 && daysToSurgery <= 7) return "urgent";
  }

  if (task.status === "waiting_patient" && daysSinceIso(task.updated_at, todayYmd) > 7) return "urgent";

  if (task.status === "open" && daysSinceIso(task.created_at, todayYmd) > 3) return "high";

  return null;
}

export type PathwayInboxDashboardCounts = {
  openCount: number;
  urgentCount: number;
  waitingPatientCount: number;
  overdueCount: number;
};

export function aggregatePathwayInboxDashboardCounts(
  tasks: Array<FiPaymentPathwayTaskRow & { due_date?: string | null }>,
  todayYmd: string
): PathwayInboxDashboardCounts {
  let openCount = 0;
  let urgentCount = 0;
  let waitingPatientCount = 0;
  let overdueCount = 0;

  for (const task of tasks) {
    if (!isUnresolvedOpenPathwayTaskStatus(task.status)) continue;
    openCount += 1;
    if (task.priority === "urgent") urgentCount += 1;
    if (task.status === "waiting_patient") waitingPatientCount += 1;
    const due = ymd(task.due_date);
    if (due && due < todayYmd) overdueCount += 1;
  }

  return { openCount, urgentCount, waitingPatientCount, overdueCount };
}
