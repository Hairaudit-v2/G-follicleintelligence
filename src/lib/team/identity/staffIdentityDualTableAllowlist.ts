/**
 * Frozen allowlist of files that already reference both `fi_staff` and
 * `fi_staff_members` outside `src/lib/team/identity` (B0/B1 debt).
 *
 * New files must not appear here without an explicit Team cohesion register update.
 * Snapshot: FI-TEAM-COHESION-B1.2 — access centre loader removed from allowlist.
 *
 * Allowlist before B1.2: 24
 * Access entries removed: 1 (`src/lib/workforce/staffAccessCentre.server.ts`)
 * Allowlist after: 23
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
  "src/lib/workforce-os/staffCanonicalLifecycle.ts",
  "src/lib/workforce-os/staffIdentityReadinessAudit.server.ts",
  "src/lib/workforce-os/staffLifecycle.server.ts",
  "src/lib/workforce/identityReconciliation.server.ts",
  "src/lib/workforce/onboarding/onboardingInvitation.server.ts",
  "src/lib/workforce/onboarding/onboardingPage.server.ts",
  "src/lib/workforce/staffAccessAccept.server.ts",
  "src/lib/workforce/staffAccessPinLayer.server.ts",
  "src/lib/workforce/staffHrTaskMapCore.ts",
  "src/lib/workforce/staffLifecycleCopy.ts",
  "src/lib/workforce/staffOffboarding.server.ts",
  "src/lib/workforce/staffTenantLinkRepair.server.ts",
] as const;

export const STAFF_IDENTITY_DUAL_TABLE_ALLOWLIST_SET: ReadonlySet<string> = new Set(
  STAFF_IDENTITY_DUAL_TABLE_ALLOWLIST
);
