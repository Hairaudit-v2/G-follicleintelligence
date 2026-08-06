/**
 * Public Team identity API — pure types and helpers.
 *
 * Server resolvers: `@/src/lib/team/identity/server`
 * Do not import from `@/src/lib/team/identity/internal/**` outside this package.
 *
 * B2.1a–B2.1b: canonical lifecycle / readiness pure modules and identity
 * server loaders (links, audit, tenant overview) live under this package.
 * Prefer this barrel for pure symbols; use `./server` for privileged loaders.
 * Audit route-gate stays at `./staffIdentityAuditAccess.server` (not on `./server`).
 */

export type {
  StaffAccessStatus,
  StaffEmploymentStatus,
  StaffIdentity,
  StaffIdentityIntegrity,
  StaffIdentityIntegrityWarning,
  StaffIdentityIntegrityWarningCode,
  StaffIdentityLinkStatus,
  StaffIdentityUnresolved,
  StaffIdentityUnresolvedReason,
  StaffReadinessStatus,
  ResolveStaffIdentitiesInput,
  ResolveStaffIdentitiesResult,
  ResolveStaffIdentityInput,
} from "@/src/lib/team/identity/types";

export {
  STAFF_ACCESS_STATUSES,
  STAFF_IDENTITY_LINK_STATUSES,
  STAFF_IDENTITY_UNUSABLE_LINK_STATUSES,
  STAFF_PERSON_KEY_PREFIX,
  STAFF_READINESS_STATUSES,
} from "@/src/lib/team/identity/constants";

export {
  buildStaffPersonKey,
  isInvalidStaffPersonKey,
  type StaffPersonKeyParts,
} from "@/src/lib/team/identity/staffIdentityKeys";

export {
  classifyStaffIdentityIntegrity,
  isStaffIdentityLinkUsable,
  type ClassifyStaffIdentityIntegrityInput,
} from "@/src/lib/team/identity/staffIdentityIntegrity";

export {
  deriveStaffAccessStatus,
  deriveStaffReadinessStatus,
  type DeriveStaffAccessStatusInput,
  type DeriveStaffReadinessStatusInput,
} from "@/src/lib/team/identity/staffIdentityReadiness";

export {
  buildStaffIdentityAuditEvent,
  summariseStaffIdentityWarnings,
  type StaffIdentityAuditEvent,
} from "@/src/lib/team/identity/staffIdentityAudit";

export {
  annotateStaffIdentityWithExternalLinks,
  toResolvedStaffMemberContext,
  toStaffProfileHubIdentityGate,
  type StaffProfileHubIdentityGate,
} from "@/src/lib/team/identity/adapters";

/** Canonical employment lifecycle types / constants (B2.1a). */
export {
  IIOHR_MANAGED_IDENTITY_SOURCES,
  OFFBOARDING_CENTRE_EMPLOYMENT_STATUSES,
  OPERATIONALLY_INELIGIBLE_EMPLOYMENT_STATUSES,
  SCHEDULING_EXCLUDED_EMPLOYMENT_STATUSES,
  STAFF_EMPLOYMENT_STATUSES,
  STAFF_IDENTITY_SOURCES,
  STAFF_LIFECYCLE_AUDIT_EVENTS,
  type StaffIdentitySource,
  type StaffLifecycleAuditEventType,
  type StaffMemberLifecycleRow,
} from "@/src/lib/team/identity/staffLifecycleTypes";

/** Leaf employment-status predicates (cycle-safe). */
export {
  isOperationallyIneligible,
  isSchedulingExcluded,
  parseStaffEmploymentStatus,
  shouldDeactivateOnEmploymentChange,
} from "@/src/lib/team/identity/staffEmploymentStatusPredicates";

/** Canonical status combiner for directory / roster / command-centre signals. */
export {
  resolveCanonicalStaffLifecycleStatus,
  type CanonicalStaffLifecycleStatus,
  type StaffLifecycleSignal,
} from "@/src/lib/team/identity/staffCanonicalLifecycle";

/**
 * HR readiness contracts (B2.3b) — staleness thresholds + neutral readiness types.
 * Notification badges / portal selection: `@/src/lib/team/notifications`.
 */
export {
  STAFF_HR_SYNC_STALE_DAYS,
  HR_READINESS_SOURCE_SYSTEM_PRIORITY,
  buildStaffHrReadinessLinkedSummary,
  buildStaffHrReadinessNoLinkSummary,
  computeStaffHrOutstandingTaskCount,
  isHrSyncStale,
  pickStaffHrReadinessFromSourceRows,
  resolveHrOnboardingStatus,
  type BuildStaffHrReadinessLinkedInput,
  type StaffHrOnboardingStatus,
  type StaffHrReadinessSourceRow,
  type StaffHrReadinessSummary,
} from "@/src/lib/team/identity/readiness/hrReadinessContracts";
