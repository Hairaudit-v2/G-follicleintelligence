/**
 * Public Team identity API — pure types and helpers.
 *
 * Server resolvers: `@/src/lib/team/identity/server`
 * Do not import from `@/src/lib/team/identity/internal/**` outside this package.
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
