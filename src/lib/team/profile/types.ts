/**
 * Staff Profile Hub composition model (FI-TEAM-COHESION-B1.6).
 * Profile owns presentation / prioritisation — not access, onboarding, roster, or compliance policy.
 */

import type { StaffAccessEntry } from "@/src/lib/team/access/types";
import type { StaffComplianceEntry } from "@/src/lib/team/compliance/types";
import type { StaffDirectoryEntry } from "@/src/lib/team/directory/types";
import type {
  StaffAccessStatus,
  StaffEmploymentStatus,
  StaffIdentity,
  StaffReadinessStatus,
} from "@/src/lib/team/identity/types";
import type { StaffOnboardingEntry, StaffOnboardingStatus } from "@/src/lib/team/onboarding/types";
import type { RosterStaffEntry } from "@/src/lib/team/roster/types";

export type StaffProfileAttentionSource =
  | "identity"
  | "access"
  | "onboarding"
  | "roster"
  | "compliance";

export type StaffProfileAttentionSeverity = "info" | "warning" | "blocking";

export type StaffProfileAttentionReason = {
  source: StaffProfileAttentionSource;
  code: string;
  severity: StaffProfileAttentionSeverity;
  label: string;
  href: string | null;
};

export type StaffProfileIdentityActionFlags = {
  canRepairIdentityLink: boolean;
  canCreateSchedulingRecord: boolean;
  /** When true, mutations that need a safe linked target must be suppressed. */
  readOnly: boolean;
};

export type StaffProfileActionFlags = {
  identity: StaffProfileIdentityActionFlags;
};

export type StaffProfileOverviewSummary = {
  displayName: string;
  employmentStatus: StaffEmploymentStatus;
  accessStatus: StaffAccessStatus;
  onboardingStatus: StaffOnboardingStatus | null;
  readinessStatus: StaffReadinessStatus;
  primaryClinicId: string | null;
  clinicIds: string[];
};

/**
 * Canonical person-level composition surface.
 * Domain sections are null when that domain has no applicable projection
 * (e.g. lifecycle-only → no roster entry; scheduling-only → no compliance subject).
 */
export type StaffProfileHubModel = {
  identity: StaffIdentity;

  overview: StaffProfileOverviewSummary;

  directory: StaffDirectoryEntry | null;
  access: StaffAccessEntry | null;
  onboarding: StaffOnboardingEntry | null;
  roster: RosterStaffEntry | null;
  compliance: StaffComplianceEntry | null;

  attentionReasons: StaffProfileAttentionReason[];

  actions: StaffProfileActionFlags;
};

/** Discriminated route / loader contract — no silent ID-type fallback. */
export type LoadStaffProfileHubInput =
  | {
      tenantId: string;
      by: "staffId";
      staffId: string;
    }
  | {
      tenantId: string;
      by: "staffMemberId";
      staffMemberId: string;
    };

export type StaffProfileHubRejectionReason =
  | "not_found"
  | "cross_tenant"
  | "invalid";

export type LoadStaffProfileHubResult =
  | { status: "ok"; profile: StaffProfileHubModel }
  | { status: "rejected"; reason: StaffProfileHubRejectionReason };
