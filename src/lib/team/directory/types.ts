/**
 * Directory-domain projection of Team staff identity (FI-TEAM-COHESION-B1.1).
 * Directory owns search/filter/sort/presentation; identity owns linkage truth.
 */

import type {
  StaffAccessStatus,
  StaffEmploymentStatus,
  StaffIdentityIntegrity,
  StaffReadinessStatus,
} from "@/src/lib/team/identity/types";

export type StaffDirectoryAttentionReason =
  | "identity_link_incomplete"
  | "scheduling_record_missing"
  | "lifecycle_record_missing"
  | "identity_requires_reconciliation"
  | "cross_tenant_mismatch"
  | "identity_invalid";

export type StaffDirectoryIdentityRef = {
  /** Alias of StaffIdentity.personKey for directory consumers. */
  personId: string;
  staffId: string | null;
  staffMemberId: string | null;
  integrity: StaffIdentityIntegrity;
};

/**
 * Directory-specific staff row. Does not leak the full StaffIdentity object into UI.
 */
export type StaffDirectoryEntry = {
  identity: StaffDirectoryIdentityRef;

  displayName: string;
  email: string | null;
  employmentStatus: StaffEmploymentStatus;
  accessStatus: StaffAccessStatus;
  readinessStatus: StaffReadinessStatus;

  clinicIds: string[];
  primaryClinicId: string | null;

  roleLabels: string[];
  attentionReasons: StaffDirectoryAttentionReason[];

  archivedAt: string | null;
  hrLinked: boolean;
};

export const STAFF_DIRECTORY_ATTENTION_LABELS: Record<StaffDirectoryAttentionReason, string> = {
  identity_link_incomplete: "Identity link incomplete",
  scheduling_record_missing: "Scheduling record missing",
  lifecycle_record_missing: "Lifecycle record missing",
  identity_requires_reconciliation: "Identity requires reconciliation",
  cross_tenant_mismatch: "Cross-tenant identity mismatch",
  identity_invalid: "Identity invalid",
};
