/**
 * Compliance-domain projection of Team staff identity (FI-TEAM-COHESION-B1.5).
 * Compliance owns credential / certification presentation; identity owns linkage truth.
 */

import type {
  StaffIdentityIntegrity,
  StaffReadinessStatus,
} from "@/src/lib/team/identity/types";

export type StaffComplianceAttentionReason =
  | "identity_link_incomplete"
  | "scheduling_record_missing"
  | "lifecycle_record_missing"
  | "identity_requires_reconciliation"
  | "cross_tenant_mismatch"
  | "identity_invalid"
  | "credentials_expired"
  | "credentials_expiring_soon"
  | "certifications_incomplete";

export type StaffComplianceIdentitySummary = {
  /** Alias of StaffIdentity.personKey for compliance consumers. */
  personId: string;
  staffId: string | null;
  staffMemberId: string | null;
  userId: string | null;
  integrity: StaffIdentityIntegrity;
};

/**
 * Compliance-specific staff row. Lifecycle-only identities are first-class here.
 * Does not invent credential history for scheduling-only subjects without records.
 */
export type StaffComplianceEntry = {
  identity: StaffComplianceIdentitySummary;

  credentials: {
    total: number;
    verified: number;
    expiringSoon: number;
    expired: number;
    rejected: number;
    pendingReview: number;
  };

  certifications: {
    current: number;
    expired: number;
    incomplete: number;
  };

  readiness: {
    status: StaffReadinessStatus;
    complianceBlockers: string[];
  };

  attentionReasons: StaffComplianceAttentionReason[];

  actions: {
    canUploadCredential: boolean;
    canVerifyCredential: boolean;
    canRejectCredential: boolean;
    canRequestReplacement: boolean;
    canResolveIdentity: boolean;
  };
};

export const STAFF_COMPLIANCE_ATTENTION_LABELS: Record<StaffComplianceAttentionReason, string> = {
  identity_link_incomplete: "Identity link incomplete",
  scheduling_record_missing: "Scheduling record missing",
  lifecycle_record_missing: "Lifecycle record missing",
  identity_requires_reconciliation: "Identity requires reconciliation",
  cross_tenant_mismatch: "Cross-tenant identity mismatch",
  identity_invalid: "Identity invalid",
  credentials_expired: "Credentials expired",
  credentials_expiring_soon: "Credentials expiring soon",
  certifications_incomplete: "Certifications incomplete",
};
