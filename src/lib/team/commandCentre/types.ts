/**
 * Team Command Centre composition model (FI-TEAM-COHESION-B1.7).
 * Command Centre composes many people; profile composes one.
 * Domain policy stays in identity / access / onboarding / roster / compliance projections.
 */

import type { StaffAccessEntry } from "@/src/lib/team/access/types";
import type { StaffComplianceEntry } from "@/src/lib/team/compliance/types";
import type { StaffDirectoryEntry } from "@/src/lib/team/directory/types";
import type {
  StaffIdentity,
  StaffReadinessStatus,
} from "@/src/lib/team/identity/types";
import type { StaffOnboardingEntry } from "@/src/lib/team/onboarding/types";
import type {
  StaffProfileAttentionReason,
  StaffProfileAttentionSeverity,
  StaffProfileAttentionSource,
} from "@/src/lib/team/profile/types";
import type { RosterStaffEntry } from "@/src/lib/team/roster/types";

/** Slim identity projection used on Command Centre person cards / queue rows. */
export type StaffIdentitySummary = Pick<
  StaffIdentity,
  | "personKey"
  | "staffId"
  | "staffMemberId"
  | "userId"
  | "displayName"
  | "email"
  | "employmentStatus"
  | "accessStatus"
  | "readinessStatus"
  | "archivedAt"
  | "hrLinked"
  | "integrity"
>;

/** Domain Entry aliases — Command Centre does not invent thinner Summary DTOs. */
export type StaffDirectorySummary = StaffDirectoryEntry;
export type StaffAccessSummary = StaffAccessEntry;
export type StaffOnboardingSummary = StaffOnboardingEntry;
export type RosterStaffSummary = RosterStaffEntry;
export type StaffComplianceSummary = StaffComplianceEntry;

export type CommandCentreAttentionSource = StaffProfileAttentionSource;

export type CommandCentrePrimaryAction = {
  label: string;
  href: string;
  source: CommandCentreAttentionSource;
};

/**
 * Person-level Command Centre summary — same domain contracts as the profile hub,
 * composed in batch rather than via per-person profile loads.
 */
export type CommandCentreStaffSummary = {
  identity: StaffIdentitySummary;

  directory: StaffDirectorySummary | null;
  access: StaffAccessSummary | null;
  onboarding: StaffOnboardingSummary | null;
  roster: RosterStaffSummary | null;
  compliance: StaffComplianceSummary | null;

  readinessStatus: StaffReadinessStatus;

  attentionReasons: StaffProfileAttentionReason[];

  primaryAction: CommandCentrePrimaryAction | null;
};

/**
 * Attention queue item — reuses B1.6 profile attention semantics with a named person.
 */
export type TeamAttentionQueueItem = {
  personKey: string;
  displayName: string;

  source: CommandCentreAttentionSource;

  reasonCode: string;
  severity: StaffProfileAttentionSeverity;

  label: string;
  href: string | null;

  actionAllowed: boolean;
};

/**
 * Workforce roll-up KPIs derived from composed person summaries.
 * Behaviour-neutral vs legacy directory/ops definitions (see B1.7 proof).
 */
export type TeamCommandCentreKpis = {
  totalStaff: number;
  activeStaff: number;
  onboardingIncomplete: number;
  accessPending: number;
  credentialIssues: number;
  rosterReady: number;
  identityReconciliation: number;
  attentionRequired: number;
  /** Cross-tenant identities — excluded from normal workforce totals. */
  crossTenantIntegrityIssues: number;
};

export type TeamCommandCentreActionFlags = {
  /** When true, no destructive / repair mutations should be offered at the CC layer. */
  suppressUnsafeActions: boolean;
  canOpenReconciliation: boolean;
};

export type TeamCommandCentreModel = {
  tenantId: string;
  staff: CommandCentreStaffSummary[];
  attentionQueue: TeamAttentionQueueItem[];
  kpis: TeamCommandCentreKpis;
};

export type CommandCentreDomainHrefs = {
  identityAudit: string;
  access: string;
  onboarding: string;
  roster: string;
  compliance: string;
  profileFor: (ids: { staffId: string | null; staffMemberId: string | null }) => string | null;
};
