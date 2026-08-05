/**
 * Server entry for Team staff identity.
 * Prefer this barrel for resolvers, links, audit, and tenant overview loaders.
 * Do not import from `internal/` outside this package.
 * Client code must not import this module — use `@/src/lib/team/identity` for pure types.
 */

import "server-only";

export {
  resolveStaffIdentity,
  type ResolveStaffIdentityOptions,
} from "@/src/lib/team/identity/resolveStaffIdentity.server";

export {
  resolveStaffIdentities,
  type ResolveStaffIdentitiesOptions,
} from "@/src/lib/team/identity/resolveStaffIdentities.server";

export {
  IdentityCrossTenantError,
  IdentityResolutionError,
} from "@/src/lib/team/identity/internal/identityResolutionErrors";

export type {
  StaffIdentity,
  ResolveStaffIdentityInput,
  ResolveStaffIdentitiesInput,
  ResolveStaffIdentitiesResult,
  StaffIdentityUnresolved,
} from "@/src/lib/team/identity/types";

export {
  toResolvedStaffMemberContext,
  toStaffProfileHubIdentityGate,
} from "@/src/lib/team/identity/adapters";

/** Identity links (`fi_staff_source_ids`). */
export {
  getStaffIdentityLinksForStaff,
  getStaffIdentityLinksByExternalId,
  upsertStaffIdentityLink,
  resolveFiStaffIdFromExternalIdentity,
  getPrimaryExternalIdentitySummary,
  linkAcademyProfileToFiStaff,
  type StaffIdentityLinkRow,
  type UpsertStaffIdentityLinkInput,
  type ResolveExternalIdentityInput,
  type FiStaffSourceIdRow,
} from "@/src/lib/team/identity/workforceIdentityLinks.server";

/** Identity readiness audit composition (read-only). */
export {
  runStaffIdentityReadinessAudit,
  runStaffIdentityReadinessAuditForMember,
  summarizeStaffTestingReadiness,
  type StaffIdentityReadinessAuditResult,
  type StaffIdentityReadinessAuditRow,
  type StaffIdentityReadinessAuditSummary,
  type StaffTestingReadinessSummary,
} from "@/src/lib/team/identity/staffIdentityReadinessAudit.server";

/** Identity audit route gate. */
export {
  resolveStaffIdentityAuditAccess,
  assertStaffIdentityAuditAccess,
  type StaffIdentityAuditAccess,
} from "@/src/lib/team/identity/staffIdentityAuditAccess.server";

/** Tenant identity / readiness overview aggregations. */
export {
  buildTenantWorkforceIdentityOverview,
  type TenantWorkforceIdentityOverview,
} from "@/src/lib/team/identity/workforceIdentityTenantOverview.server";

export {
  buildTenantWorkforceReadinessOverview,
  type TenantWorkforceReadinessOverview,
} from "@/src/lib/team/identity/workforceReadinessTenantOverview.server";
