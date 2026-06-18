/**
 * ReceptionOS Phase 2 — pure task policy (status transitions, permissions, enums).
 */

import type { ReceptionOsSeverity, ReceptionOsViewerRole } from "@/src/lib/receptionOs/receptionOsBoardModel";

export const RECEPTION_TASK_SOURCE_TYPES = [
  "booking",
  "patient",
  "case",
  "lead",
  "payment",
  "consultation",
  "surgery",
  "system",
] as const;
export type ReceptionTaskSourceType = (typeof RECEPTION_TASK_SOURCE_TYPES)[number];

export const RECEPTION_TASK_STATUSES = ["open", "in_progress", "snoozed", "resolved", "dismissed"] as const;
export type ReceptionTaskStatus = (typeof RECEPTION_TASK_STATUSES)[number];

export const RECEPTION_TASK_AUDIT_EVENT_KINDS = [
  "created",
  "assigned",
  "snoozed",
  "status_changed",
  "resolved",
  "dismissed",
  "note_added",
  "communication_sent",
] as const;
export type ReceptionTaskAuditEventKind = (typeof RECEPTION_TASK_AUDIT_EVENT_KINDS)[number];

export const RECEPTION_TASK_ACTIONS = [
  "assign",
  "snooze",
  "mark_in_progress",
  "resolve",
  "dismiss",
  "add_note",
  "create_from_alert",
] as const;
export type ReceptionTaskAction = (typeof RECEPTION_TASK_ACTIONS)[number];

export const OPEN_RECEPTION_TASK_STATUSES: readonly ReceptionTaskStatus[] = ["open", "in_progress", "snoozed"];

export function isReceptionTaskStatus(v: string): v is ReceptionTaskStatus {
  return (RECEPTION_TASK_STATUSES as readonly string[]).includes(v);
}

export function isReceptionTaskSourceType(v: string): v is ReceptionTaskSourceType {
  return (RECEPTION_TASK_SOURCE_TYPES as readonly string[]).includes(v);
}

const ALLOWED_TRANSITIONS: Record<ReceptionTaskStatus, readonly ReceptionTaskStatus[]> = {
  open: ["in_progress", "snoozed", "resolved", "dismissed"],
  in_progress: ["snoozed", "resolved", "dismissed", "open"],
  snoozed: ["open", "in_progress", "resolved", "dismissed"],
  resolved: [],
  dismissed: [],
};

export function canTransitionReceptionTaskStatus(from: ReceptionTaskStatus, to: ReceptionTaskStatus): boolean {
  if (from === to) return true;
  return ALLOWED_TRANSITIONS[from].includes(to);
}

export function assertReceptionTaskStatusTransition(from: ReceptionTaskStatus, to: ReceptionTaskStatus): void {
  if (!canTransitionReceptionTaskStatus(from, to)) {
    throw new Error(`Invalid reception task status transition: ${from} → ${to}.`);
  }
}

/** Role-gated task actions for ReceptionOS operators. */
export function receptionTaskActionAllowed(role: ReceptionOsViewerRole, action: ReceptionTaskAction): boolean {
  if (role === "admin" || role === "clinic_manager") return true;
  if (action === "dismiss") return false;
  if (action === "create_from_alert") return true;
  return ["assign", "snooze", "mark_in_progress", "resolve", "add_note"].includes(action);
}

export function mapAlertKindToSourceType(kind: string): ReceptionTaskSourceType {
  switch (kind) {
    case "missing_deposit":
      return "payment";
    case "no_follow_up_after_consultation":
      return "consultation";
    case "missing_forms":
      return "consultation";
    case "surgery_risk":
      return "surgery";
    default:
      return "system";
  }
}

export function severityFromString(v: string): ReceptionOsSeverity {
  const s = v.trim().toLowerCase();
  if (s === "info" || s === "warning" || s === "critical" || s === "blocked") return s;
  return "warning";
}
