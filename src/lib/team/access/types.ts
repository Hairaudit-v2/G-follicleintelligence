/**
 * Access-domain projection of Team staff identity (FI-TEAM-COHESION-B1.2).
 * Access owns invite / PIN / suspend / revoke presentation; identity owns linkage truth.
 */

import type { StaffIdentityIntegrity } from "@/src/lib/team/identity/types";

export type StaffAccessAttentionReason =
  | "identity_link_incomplete"
  | "scheduling_record_missing"
  | "lifecycle_record_missing"
  | "identity_requires_reconciliation"
  | "cross_tenant_mismatch"
  | "identity_invalid"
  | "terminated_with_active_access"
  | "missing_auth_identity";

/**
 * Coarse access-surface status for Staff Access Centre rows.
 * Distinct from identity.accessStatus and from login-invite row status.
 */
export type StaffAccessEntryStatus =
  | "not_invited"
  | "invite_pending"
  | "active"
  | "suspended"
  | "revoked";

export type StaffAccessIdentitySummary = {
  /** Alias of StaffIdentity.personKey for access consumers. */
  personId: string;
  staffId: string | null;
  staffMemberId: string | null;
  userId: string | null;
  integrity: StaffIdentityIntegrity;
};

/**
 * Access-specific staff row. Does not leak the full StaffIdentity object into UI.
 * Action flags reflect access-domain rules; identity integrity only gates uncertain targets.
 */
export type StaffAccessEntry = {
  identity: StaffAccessIdentitySummary;

  accessStatus: StaffAccessEntryStatus;

  loginInviteId: string | null;
  loginInviteExpiresAt: string | null;

  canInvite: boolean;
  canResend: boolean;
  canSuspend: boolean;
  canRevoke: boolean;

  attentionReasons: StaffAccessAttentionReason[];
};

export const STAFF_ACCESS_ATTENTION_LABELS: Record<StaffAccessAttentionReason, string> = {
  identity_link_incomplete: "Identity link incomplete",
  scheduling_record_missing: "Scheduling record missing",
  lifecycle_record_missing: "Lifecycle record missing",
  identity_requires_reconciliation: "Identity requires reconciliation",
  cross_tenant_mismatch: "Cross-tenant identity mismatch",
  identity_invalid: "Identity invalid",
  terminated_with_active_access: "Terminated employment with active access",
  missing_auth_identity: "No auth user linked yet",
};
