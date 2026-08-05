/**
 * Canonical Team staff identity contract (FI-TEAM-COHESION-B1).
 *
 * Carries both source identifiers without implying they are always present
 * or safely linked. Integrity state is always explicit — callers decide
 * whether a transitional/partial link is acceptable.
 */

import type { StaffEmploymentStatus } from "@/src/lib/team/identity/staffLifecycleTypes";

export type { StaffEmploymentStatus };

/** How `fi_staff` and `fi_staff_members` relate for this identity. */
export type StaffIdentityLinkStatus =
  | "linked"
  | "scheduling_only"
  | "lifecycle_only"
  | "ambiguous"
  | "cross_tenant_mismatch"
  | "invalid";

/**
 * Coarse access / login state composed during identity resolution.
 * Full invite/PIN detail remains owned by the access domain.
 */
export type StaffAccessStatus =
  | "login_active"
  | "invite_pending"
  | "no_login"
  | "suspended"
  | "revoked"
  | "unknown";

/**
 * Coarse readiness band derived from employment + identity integrity.
 * Workforce readiness engines remain authoritative for scored readiness.
 */
export type StaffReadinessStatus = "ready" | "watch" | "blocked" | "unknown";

export type StaffIdentityIntegrityWarningCode =
  | "missing_scheduling_record"
  | "missing_lifecycle_record"
  | "missing_auth_identity"
  | "multiple_lifecycle_candidates"
  | "cross_tenant_link"
  | "broken_staff_fk"
  | "archived_or_merged_lifecycle"
  | "structurally_invalid";

export type StaffIdentityIntegrityWarning = {
  code: StaffIdentityIntegrityWarningCode;
  message: string;
};

export type StaffIdentityIntegrity = {
  linkStatus: StaffIdentityLinkStatus;
  hasSchedulingRecord: boolean;
  hasLifecycleRecord: boolean;
  hasAuthIdentity: boolean;
  warnings: StaffIdentityIntegrityWarning[];
};

/**
 * Canonical staff identity. Prefer resolving via {@link ResolveStaffIdentityInput}
 * rather than constructing ad hoc dual-id objects.
 */
export type StaffIdentity = {
  tenantId: string;

  /** Opaque stable key for maps / batch results. See `buildStaffPersonKey`. */
  personKey: string;

  /** `fi_staff.id` — scheduling / grants projection. */
  staffId: string | null;
  /** `fi_staff_members.id` — HR lifecycle person. */
  staffMemberId: string | null;
  /** Linked auth / `fi_users` id when known (`fi_staff.fi_user_id`). */
  userId: string | null;

  displayName: string;
  email: string | null;

  employmentStatus: StaffEmploymentStatus;
  accessStatus: StaffAccessStatus;
  readinessStatus: StaffReadinessStatus;

  /** `fi_staff_members.archived_at` when a lifecycle row contributes. */
  archivedAt: string | null;
  /** True when lifecycle row shows an IIOHR / Evolved HR link (directory + reconciliation). */
  hrLinked: boolean;

  primaryClinicId: string | null;
  clinicIds: string[];

  roles: string[];
  capabilities: string[];

  integrity: StaffIdentityIntegrity;
};

/** Discriminated single-identity lookup — exactly one identifier per request. */
export type ResolveStaffIdentityInput =
  | {
      tenantId: string;
      by: "staffId";
      staffId: string;
    }
  | {
      tenantId: string;
      by: "staffMemberId";
      staffMemberId: string;
    }
  | {
      tenantId: string;
      by: "userId";
      userId: string;
    };

export type ResolveStaffIdentitiesInput =
  | {
      tenantId: string;
      by: "staffId";
      staffIds: string[];
    }
  | {
      tenantId: string;
      by: "staffMemberId";
      staffMemberIds: string[];
    }
  | {
      tenantId: string;
      by: "userId";
      userIds: string[];
    };

export type StaffIdentityUnresolvedReason =
  | "missing"
  | "ambiguous"
  | "cross_tenant_mismatch"
  | "invalid";

export type StaffIdentityUnresolved = {
  /** Original lookup key (staffId / staffMemberId / userId). */
  key: string;
  reason: StaffIdentityUnresolvedReason;
};

/**
 * Batch resolve result. `byKey` preserves every unique input id.
 * Missing → null entry; ambiguous / mismatch identities are still returned
 * with the corresponding integrity.linkStatus (and listed under unresolved).
 */
export type ResolveStaffIdentitiesResult = {
  byKey: Map<string, StaffIdentity | null>;
  /** Deterministic order matching deduplicated input order. */
  identities: StaffIdentity[];
  unresolved: StaffIdentityUnresolved[];
};
