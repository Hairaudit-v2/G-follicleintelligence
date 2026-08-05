/**
 * Roster-domain projection of Team staff identity (FI-TEAM-COHESION-B1.4).
 * Roster owns scheduling visibility / eligibility presentation; identity owns linkage truth.
 */

import type {
  StaffEmploymentStatus,
  StaffIdentityIntegrity,
  StaffReadinessStatus,
} from "@/src/lib/team/identity/types";

export type RosterStaffAttentionReason =
  | "identity_link_incomplete"
  | "scheduling_record_missing"
  | "lifecycle_record_missing"
  | "identity_requires_reconciliation"
  | "cross_tenant_mismatch"
  | "identity_invalid"
  | "employment_blocks_new_assignment";

export type RosterStaffIdentitySummary = {
  /** Alias of StaffIdentity.personKey for roster consumers. */
  personId: string;
  staffId: string | null;
  staffMemberId: string | null;
  userId: string | null;
  integrity: StaffIdentityIntegrity;
};

/**
 * Roster-specific staff row. Requires a scheduling staffId to be a roster resource.
 * Does not invent lifecycle-only people as roster rows.
 */
export type RosterStaffEntry = {
  identity: RosterStaffIdentitySummary;

  scheduling: {
    staffId: string;
    primaryClinicId: string | null;
    clinicIds: string[];
    active: boolean;
  };

  employment: {
    status: StaffEmploymentStatus;
    startDate: string | null;
    endDate: string | null;
  };

  readiness: {
    status: StaffReadinessStatus;
    blockers: string[];
  };

  attentionReasons: RosterStaffAttentionReason[];

  actions: {
    canBeRostered: boolean;
    canEditAssignment: boolean;
    requiresReconciliation: boolean;
  };
};

export const ROSTER_STAFF_ATTENTION_LABELS: Record<RosterStaffAttentionReason, string> = {
  identity_link_incomplete: "Identity link incomplete",
  scheduling_record_missing: "Scheduling record missing",
  lifecycle_record_missing: "Lifecycle record missing",
  identity_requires_reconciliation: "Identity requires reconciliation",
  cross_tenant_mismatch: "Cross-tenant identity mismatch",
  identity_invalid: "Identity invalid",
  employment_blocks_new_assignment: "Employment status blocks new roster assignment",
};
