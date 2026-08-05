/**
 * Team planning identity projection (FI-TEAM-COHESION-B1.8B).
 * Planning may combine roster / compliance / onboarding signals —
 * it must not reproduce those domain policies.
 * Recruitment candidates and vacancies are not StaffIdentity.
 */

import type {
  StaffIdentityIntegrity,
  StaffReadinessStatus,
} from "@/src/lib/team/identity/types";

export type PlanningIdentityAttentionReason =
  | "identity_link_incomplete"
  | "scheduling_record_missing"
  | "lifecycle_record_missing"
  | "identity_requires_reconciliation"
  | "cross_tenant_mismatch"
  | "identity_invalid"
  | "not_schedulable"
  | "clinical_readiness_blocked"
  | "future_capacity_only";

export type PlanningCapacityStatus = "available" | "limited" | "unavailable";

export type PlanningStaffIdentitySummary = {
  personId: string;
  staffId: string | null;
  staffMemberId: string | null;
  userId: string | null;
  displayName: string;
  integrity: StaffIdentityIntegrity;
};

/**
 * Confirmed staff planning projection.
 * Candidates / vacancies use separate non-staff types.
 */
export type PlanningStaffEntry = {
  identity: PlanningStaffIdentitySummary;

  availability: {
    schedulable: boolean;
    clinicIds: string[];
  };

  readiness: {
    rosterReady: boolean;
    clinicalReady: boolean;
    status: StaffReadinessStatus;
    blockers: string[];
  };

  planning: {
    eligibleRoleIds: string[];
    procedureCapabilities: string[];
    capacityStatus: PlanningCapacityStatus;
  };

  attentionReasons: PlanningIdentityAttentionReason[];

  actions: {
    canAssignToProcedure: boolean;
    canAddToPlan: boolean;
    canResolveIdentity: boolean;
  };
};

/** Non-staff planning demand — never forced into StaffIdentity. */
export type PlanningRecruitmentCandidateRef = {
  candidateId: string;
  displayName: string;
  pipelineStage: string;
  roleRequirementId: string | null;
};

/** Unfilled role demand — not a person. */
export type PlanningVacancyRef = {
  roleRequirementId: string;
  roleLabel: string;
  openCount: number;
};

export type PlanningProjectionFacts = {
  rosterReady: boolean;
  clinicalReady: boolean;
  clinicalBlockers?: string[];
  eligibleRoleIds?: string[];
  procedureCapabilities?: string[];
  /** Domain already decided schedulability (roster eligibility). */
  domainSchedulable: boolean;
};

export const PLANNING_IDENTITY_ATTENTION_LABELS: Record<
  PlanningIdentityAttentionReason,
  string
> = {
  identity_link_incomplete: "Identity link incomplete",
  scheduling_record_missing: "Scheduling record missing",
  lifecycle_record_missing: "Lifecycle record missing",
  identity_requires_reconciliation: "Identity requires reconciliation",
  cross_tenant_mismatch: "Cross-tenant identity mismatch",
  identity_invalid: "Identity invalid",
  not_schedulable: "Not schedulable for procedures",
  clinical_readiness_blocked: "Clinical readiness blocked",
  future_capacity_only: "Future capacity only — not currently schedulable",
};

export const PLANNING_IDENTITY_KPI_SOURCE_SNAPSHOT = {
  procedureCapacity: {
    currentSource: "workforcePlanningEngine / procedureStaffingOptimizer",
    canonicalReplacement: "unchanged capacity math; identity batch for staff subjects",
    definitionChanges: false,
  },
  recruitmentPipeline: {
    currentSource: "listRecruitmentCandidates / role requirements",
    canonicalReplacement: "PlanningRecruitmentCandidateRef (non-staff)",
    definitionChanges: false,
  },
  staffingShortages: {
    currentSource: "predictStaffingShortages",
    canonicalReplacement: "unchanged shortage policy",
    definitionChanges: false,
  },
} as const;
