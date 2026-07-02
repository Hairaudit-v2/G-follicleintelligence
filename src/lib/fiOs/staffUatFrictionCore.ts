/**
 * Sprint 9 — UAT friction event taxonomy (pure).
 */

export const STAFF_UAT_FRICTION_TYPES = [
  "wizard_step_abandoned",
  "wizard_validation_error",
  "alert_opened_unresolved",
  "navigation_module_bounce",
  "empty_state_no_action",
] as const;

export type StaffUatFrictionType = (typeof STAFF_UAT_FRICTION_TYPES)[number];

export type StaffUatFrictionEvent = {
  frictionType: StaffUatFrictionType;
  route: string;
  role: string;
  screenKey?: string | null;
  detail?: string | null;
  payload?: Record<string, unknown>;
  occurredAt: string;
};

export type StaffUatFeedbackInput = {
  tenantId: string;
  route: string;
  role: string;
  screenKey?: string | null;
  rating: 1 | 2 | 3 | 4 | 5;
  comment?: string | null;
};

export function isStaffUatFrictionType(value: string): value is StaffUatFrictionType {
  return (STAFF_UAT_FRICTION_TYPES as readonly string[]).includes(value);
}

export function normalizeStaffUatRating(value: unknown): 1 | 2 | 3 | 4 | 5 | null {
  const n = Number(value);
  if (!Number.isInteger(n) || n < 1 || n > 5) return null;
  return n as 1 | 2 | 3 | 4 | 5;
}