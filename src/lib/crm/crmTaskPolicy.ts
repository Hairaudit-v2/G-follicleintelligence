/**
 * Pure CRM task rules (Stage 2I) — safe from client and server.
 */

/** Status while a task is not completed (`completed_at` is null). */
export const CRM_TASK_ACTIVE_STATUS_VALUES = ["open", "in_progress", "blocked"] as const;
export type CrmTaskActiveStatus = (typeof CRM_TASK_ACTIVE_STATUS_VALUES)[number];

/** Stored when `completeCrmTask` runs. */
export const CRM_TASK_STATUS_DONE = "done" as const;

export const CRM_TASK_TYPE_VALUES = ["follow_up", "call", "meeting", "email", "other"] as const;
export type CrmTaskType = (typeof CRM_TASK_TYPE_VALUES)[number];

export function isCrmTaskActiveStatus(s: string): s is CrmTaskActiveStatus {
  return (CRM_TASK_ACTIVE_STATUS_VALUES as readonly string[]).includes(s);
}

export function isCrmTaskType(s: string): s is CrmTaskType {
  return (CRM_TASK_TYPE_VALUES as readonly string[]).includes(s);
}

/** Allowed on create / update (not terminal). */
export function assertCrmTaskStatusAllowedForWrite(status: string): void {
  if (!isCrmTaskActiveStatus(status)) {
    throw new Error(`Invalid task status. Use one of: ${CRM_TASK_ACTIVE_STATUS_VALUES.join(", ")}.`);
  }
}

export function assertCrmTaskTypeAllowed(taskType: string): void {
  if (!isCrmTaskType(taskType)) {
    throw new Error(`Invalid task type. Use one of: ${CRM_TASK_TYPE_VALUES.join(", ")}.`);
  }
}

/** `complete` / `reopen` bodies must not carry mutation fields (adminKey only). */
export const CRM_TASK_COMPLETE_REOPEN_ALLOWED_KEYS = new Set(["adminKey"]);

export function assertCompleteReopenBodyHasNoExtraKeys(body: Record<string, unknown>): void {
  for (const k of Object.keys(body)) {
    if (!CRM_TASK_COMPLETE_REOPEN_ALLOWED_KEYS.has(k)) {
      throw new Error(`Unexpected field "${k}" on complete/reopen request.`);
    }
  }
}
