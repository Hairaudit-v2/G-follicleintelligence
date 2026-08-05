/**
 * Constants for Team staff identity (FI-TEAM-COHESION-B1).
 */

import type {
  StaffAccessStatus,
  StaffIdentityLinkStatus,
  StaffReadinessStatus,
} from "@/src/lib/team/identity/types";

export const STAFF_IDENTITY_LINK_STATUSES = [
  "linked",
  "scheduling_only",
  "lifecycle_only",
  "ambiguous",
  "cross_tenant_mismatch",
  "invalid",
] as const satisfies readonly StaffIdentityLinkStatus[];

export const STAFF_ACCESS_STATUSES = [
  "login_active",
  "invite_pending",
  "no_login",
  "suspended",
  "revoked",
  "unknown",
] as const satisfies readonly StaffAccessStatus[];

export const STAFF_READINESS_STATUSES = [
  "ready",
  "watch",
  "blocked",
  "unknown",
] as const satisfies readonly StaffReadinessStatus[];

/** personKey prefixes — do not parse casually; use helpers in staffIdentityKeys. */
export const STAFF_PERSON_KEY_PREFIX = {
  staffMember: "sm",
  staff: "fs",
  user: "uid",
  invalid: "invalid",
} as const;

/**
 * Link statuses that must never be treated as a silently usable linked person.
 * Callers may still inspect the returned identity for diagnostics.
 */
export const STAFF_IDENTITY_UNUSABLE_LINK_STATUSES: ReadonlySet<StaffIdentityLinkStatus> = new Set([
  "cross_tenant_mismatch",
  "invalid",
]);
