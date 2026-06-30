/**
 * ReceptionOS Phase 5 — end-of-day closeout checklist model (pure).
 */

import type { ReceptionOsSeverity } from "@/src/lib/receptionOs/receptionOsBoardModel";
import type {
  ReceptionOsActionAlert,
  ReceptionOsBoardPayload,
  ReceptionOsDepositItem,
  ReceptionOsSurgeryItem,
  ReceptionOsTaskItem,
} from "@/src/lib/receptionOs/receptionOsBoardModel.types";
import type { ReceptionCommunicationDeliverySummary } from "@/src/lib/receptionOs/receptionCommunicationDelivery.types";
import { OPEN_RECEPTION_TASK_STATUSES } from "@/src/lib/receptionOs/receptionTaskPolicy";

export const RECEPTION_CLOSEOUT_ITEM_KINDS = [
  "unresolved_critical_task",
  "unresolved_blocked_task",
  "unpaid_deposit_due_today",
  "incomplete_surgery_readiness",
  "consultation_no_next_action",
  "communication_failed",
  "tomorrow_first_patient_readiness",
] as const;

export type ReceptionCloseoutItemKind = (typeof RECEPTION_CLOSEOUT_ITEM_KINDS)[number];

export type ReceptionCloseoutChecklistItem = {
  itemKind: ReceptionCloseoutItemKind;
  severity: ReceptionOsSeverity | null;
  status: string | null;
  title: string;
  detail: string | null;
  sourceRefId: string | null;
  href: string | null;
  metadata?: Record<string, unknown>;
};

export type ReceptionCloseoutSnapshot = {
  operatingDate: string;
  riskSummary: string;
  itemCounts: Record<ReceptionOsSeverity | "total" | "failed_communications", number>;
  checklist: ReceptionCloseoutChecklistItem[];
  failedCommunications: ReceptionCommunicationDeliverySummary[];
  canCloseDay: boolean;
  existingCloseoutId: string | null;
  existingCloseoutNotes: string | null;
  closedAt: string | null;
};

export type TomorrowFirstPatientReadiness = {
  bookingId: string;
  patientLabel: string;
  appointmentTime: string;
  readinessLabel: string;
  href: string | null;
};

function depositDueToday(deposit: ReceptionOsDepositItem, todayYmd: string): boolean {
  if (!deposit.dueDate) return false;
  return deposit.dueDate.slice(0, 10) === todayYmd && deposit.amountPaid < deposit.amountExpected;
}

function surgeryIncomplete(item: ReceptionOsSurgeryItem): boolean {
  const status = item.readinessStatus.trim().toLowerCase();
  if (status.includes("complete") || status.includes("ready")) return false;
  if (item.readinessPercent != null && item.readinessPercent >= 100) return false;
  return !item.paymentComplete || !item.consentComplete || item.severity !== "info";
}

function buildTaskItems(tasks: readonly ReceptionOsTaskItem[]): ReceptionCloseoutChecklistItem[] {
  const items: ReceptionCloseoutChecklistItem[] = [];
  for (const task of tasks) {
    if (!OPEN_RECEPTION_TASK_STATUSES.includes(task.status)) continue;
    if (task.severity !== "critical" && task.severity !== "blocked") continue;
    items.push({
      itemKind:
        task.severity === "blocked" ? "unresolved_blocked_task" : "unresolved_critical_task",
      severity: task.severity,
      status: task.status,
      title: task.title,
      detail: task.description,
      sourceRefId: task.id,
      href: null,
      metadata: { source_type: task.sourceType },
    });
  }
  return items;
}

function buildDepositItems(
  deposits: readonly ReceptionOsDepositItem[],
  todayYmd: string
): ReceptionCloseoutChecklistItem[] {
  return deposits
    .filter((d) => depositDueToday(d, todayYmd))
    .map((d) => ({
      itemKind: "unpaid_deposit_due_today" as const,
      severity: d.severity,
      status: d.statusLabel,
      title: `Deposit due today — ${d.patientLabel}`,
      detail: `${d.currency} ${d.amountPaid}/${d.amountExpected}`,
      sourceRefId: d.id,
      href: d.hrefs.patient ?? d.hrefs.lead ?? d.hrefs.case,
      metadata: { due_date: d.dueDate },
    }));
}

function buildSurgeryItems(
  surgeries: readonly ReceptionOsSurgeryItem[]
): ReceptionCloseoutChecklistItem[] {
  return surgeries.filter(surgeryIncomplete).map((s) => ({
    itemKind: "incomplete_surgery_readiness" as const,
    severity: s.severity,
    status: s.readinessStatus,
    title: `Surgery readiness — ${s.patientLabel}`,
    detail: `${s.surgeryDate} · ${s.readinessPercent ?? 0}% ready`,
    sourceRefId: s.bookingId,
    href: s.hrefs.case ?? s.hrefs.patient ?? s.hrefs.calendar,
    metadata: {
      payment_complete: s.paymentComplete,
      consent_complete: s.consentComplete,
    },
  }));
}

function buildConsultationFollowUpItems(
  alerts: readonly ReceptionOsActionAlert[]
): ReceptionCloseoutChecklistItem[] {
  return alerts
    .filter((a) => a.kind === "no_follow_up_after_consultation")
    .map((a) => ({
      itemKind: "consultation_no_next_action" as const,
      severity: a.severity,
      status: "open",
      title: a.title,
      detail: a.detail,
      sourceRefId: a.id,
      href: a.href ?? a.hrefs?.consultation ?? a.hrefs?.lead ?? a.hrefs?.patient ?? null,
    }));
}

function buildFailedCommunicationItems(
  failed: readonly ReceptionCommunicationDeliverySummary[],
  base: string
): ReceptionCloseoutChecklistItem[] {
  return failed.map((f) => ({
    itemKind: "communication_failed" as const,
    severity: "critical" as ReceptionOsSeverity,
    status: f.deliveryStatus,
    title: `Failed ${f.channel} — ${f.templateKey ?? "message"}`,
    detail: f.errorMessage ?? "Delivery failed",
    sourceRefId: f.id,
    href: f.leadId
      ? `${base}/crm/leads/${f.leadId}`
      : f.patientId
        ? `${base}/patients/${f.patientId}`
        : null,
    metadata: {
      provider: f.provider,
      to_address: f.toAddress,
      external_message_id: f.externalMessageId,
    },
  }));
}

function buildTomorrowPatientItem(
  tomorrow: TomorrowFirstPatientReadiness | null
): ReceptionCloseoutChecklistItem[] {
  if (!tomorrow) return [];
  return [
    {
      itemKind: "tomorrow_first_patient_readiness",
      severity: "warning",
      status: tomorrow.readinessLabel,
      title: `Tomorrow first patient — ${tomorrow.patientLabel}`,
      detail: `${tomorrow.appointmentTime} · ${tomorrow.readinessLabel}`,
      sourceRefId: tomorrow.bookingId,
      href: tomorrow.href,
    },
  ];
}

function countSeverities(
  items: readonly ReceptionCloseoutChecklistItem[]
): Record<ReceptionOsSeverity | "total" | "failed_communications", number> {
  const out = {
    info: 0,
    warning: 0,
    critical: 0,
    blocked: 0,
    total: items.length,
    failed_communications: 0,
  };
  for (const item of items) {
    if (item.itemKind === "communication_failed") out.failed_communications += 1;
    if (item.severity && item.severity in out) out[item.severity] += 1;
  }
  return out;
}

function buildRiskSummary(itemCounts: ReturnType<typeof countSeverities>): string {
  if (itemCounts.blocked > 0) {
    return `${itemCounts.blocked} blocked item${itemCounts.blocked === 1 ? "" : "s"} require manager attention before tomorrow.`;
  }
  if (itemCounts.critical > 0 || itemCounts.failed_communications > 0) {
    return `${itemCounts.critical} critical and ${itemCounts.failed_communications} failed communication${itemCounts.failed_communications === 1 ? "" : "s"} flagged for closeout.`;
  }
  if (itemCounts.warning > 0) {
    return `${itemCounts.warning} warning item${itemCounts.warning === 1 ? "" : "s"} remain open — review before closing the day.`;
  }
  return "No unresolved critical risks detected for end-of-day closeout.";
}

export function buildReceptionCloseoutSnapshot(input: {
  board: Pick<
    ReceptionOsBoardPayload,
    "tenantId" | "operationalDay" | "outstandingDeposits" | "upcomingSurgeries" | "actionAlerts"
  >;
  tasks: readonly ReceptionOsTaskItem[];
  failedCommunications: readonly ReceptionCommunicationDeliverySummary[];
  tomorrowFirstPatient: TomorrowFirstPatientReadiness | null;
  canCloseDay: boolean;
  existingCloseout?: { id: string; notes: string | null; closedAt: string } | null;
}): ReceptionCloseoutSnapshot {
  const base = `/fi-admin/${input.board.tenantId}`;
  const todayYmd = input.board.operationalDay.todayYmd;

  const checklist = [
    ...buildTaskItems(input.tasks),
    ...buildDepositItems(input.board.outstandingDeposits, todayYmd),
    ...buildSurgeryItems(input.board.upcomingSurgeries),
    ...buildConsultationFollowUpItems(input.board.actionAlerts),
    ...buildFailedCommunicationItems(input.failedCommunications, base),
    ...buildTomorrowPatientItem(input.tomorrowFirstPatient),
  ];

  const itemCounts = countSeverities(checklist);

  return {
    operatingDate: todayYmd,
    riskSummary: buildRiskSummary(itemCounts),
    itemCounts,
    checklist,
    failedCommunications: [...input.failedCommunications],
    canCloseDay: input.canCloseDay,
    existingCloseoutId: input.existingCloseout?.id ?? null,
    existingCloseoutNotes: input.existingCloseout?.notes ?? null,
    closedAt: input.existingCloseout?.closedAt ?? null,
  };
}
