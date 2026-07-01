/**
 * WorkforceOS timesheet approval — pure status transition rules.
 */

import type { TimesheetStatus } from "./wageProfileCore";

export const TIMESHEET_APPROVAL_ACTIONS = [
  "submit",
  "approve",
  "void",
  "revert_to_draft",
] as const;
export type TimesheetApprovalAction = (typeof TIMESHEET_APPROVAL_ACTIONS)[number];

export const TIMESHEET_STATUS_LABELS: Record<TimesheetStatus, string> = {
  draft: "Draft",
  submitted: "Submitted",
  approved: "Approved",
  void: "Void",
};

const TRANSITIONS: Record<TimesheetApprovalAction, Partial<Record<TimesheetStatus, TimesheetStatus>>> = {
  submit: { draft: "submitted" },
  approve: { draft: "approved", submitted: "approved" },
  void: { draft: "void", submitted: "void" },
  revert_to_draft: { submitted: "draft" },
};

/** Returns next status or null when the action is invalid for the current status. */
export function resolveTimesheetTransition(
  current: TimesheetStatus,
  action: TimesheetApprovalAction
): TimesheetStatus | null {
  return TRANSITIONS[action][current] ?? null;
}

export function isTimesheetApprovalAction(value: string): value is TimesheetApprovalAction {
  return (TIMESHEET_APPROVAL_ACTIONS as readonly string[]).includes(value);
}

export function isTimesheetLocked(status: TimesheetStatus): boolean {
  return status === "approved" || status === "void";
}

export function countTimesheetEntriesByStatus(
  entries: Array<{ status: TimesheetStatus }>
): Record<TimesheetStatus, number> {
  return {
    draft: entries.filter((e) => e.status === "draft").length,
    submitted: entries.filter((e) => e.status === "submitted").length,
    approved: entries.filter((e) => e.status === "approved").length,
    void: entries.filter((e) => e.status === "void").length,
  };
}