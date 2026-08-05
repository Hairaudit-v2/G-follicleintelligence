/**
 * Frozen allowlist of files that already reference both `fi_staff` and
 * `fi_staff_members` outside `src/lib/team/identity` (B0/B1 debt).
 *
 * New files must not appear here without an explicit Team cohesion register update.
 * Snapshot: FI-TEAM-COHESION-B1.6 — profile hub composition; staffLifecycleCopy retired.
 *
 * Allowlist before B1.6: 20
 * Profile entries removed: 1 (`src/lib/workforce/staffLifecycleCopy.ts`)
 * Allowlist after: 19
 *
 * Staff profile hub now composes via `src/lib/team/profile` + `resolveStaffIdentity`
 * (discriminated by staffId | staffMemberId). `staffLifecycleCopy` was allowlisted solely
 * for documentation tokens naming both staff tables; comments were rewritten to domain
 * language (scheduling staff id) and the entry retired.
 *
 * Paths use forward slashes relative to repo root.
 */
export const STAFF_IDENTITY_DUAL_TABLE_ALLOWLIST = [
  "src/lib/crm/crmAssignableOwners.server.ts",
  "src/lib/crm/crmAssigneeEligibility.ts",
  "src/lib/crm/leadDetailsUpdate.ts",
  "src/lib/fiOs/fiOsAuthDisplay.server.ts",
  "src/lib/fiOs/todayStaffPersonHydration.server.ts",
  "src/lib/fiOs/workspaceAccessResolver.server.ts",
  "src/lib/fiOs/workspaceAccessResolverCore.ts",
  "src/lib/staffAccess/staffAccess.server.ts",
  "src/lib/staffImport/iiohrStaffDepartureAlignment.server.ts",
  "src/lib/workforce-os/hrReconciliation.server.ts",
  "src/lib/workforce-os/projectionHealth.server.ts",
  "src/lib/workforce-os/staffIdentityReadinessAudit.server.ts",
  "src/lib/workforce-os/staffLifecycle.server.ts",
  "src/lib/workforce/identityReconciliation.server.ts",
  "src/lib/workforce/onboarding/onboardingInvitation.server.ts",
  "src/lib/workforce/staffAccessAccept.server.ts",
  "src/lib/workforce/staffAccessPinLayer.server.ts",
  "src/lib/workforce/staffOffboarding.server.ts",
  "src/lib/workforce/staffTenantLinkRepair.server.ts",
] as const;

export const STAFF_IDENTITY_DUAL_TABLE_ALLOWLIST_SET: ReadonlySet<string> = new Set(
  STAFF_IDENTITY_DUAL_TABLE_ALLOWLIST
);
