/**
 * Frozen allowlist of files that already reference both `fi_staff` and
 * `fi_staff_members` outside `src/lib/team/identity` (B0/B1 debt).
 *
 * New files must not appear here without an explicit Team cohesion register update.
 * Snapshot: FI-TEAM-COHESION-B1.5 — compliance HR task-map classifier removed.
 *
 * Allowlist before B1.5: 21
 * Compliance entries removed: 1 (`src/lib/workforce/staffHrTaskMapCore.ts`)
 * Allowlist after: 20
 *
 * Credentials aggregation (`credentialsPage.server.ts`) now uses
 * `resolveStaffIdentities({ by: "staffMemberId" })` with a bounded credentials batch.
 * The HR task map core was allowlisted for dual-table identifier tokens in lifecycle
 * copy; with compliance on identity, those comments were rewritten to domain language
 * and the entry retired.
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
  "src/lib/workforce/staffLifecycleCopy.ts",
  "src/lib/workforce/staffOffboarding.server.ts",
  "src/lib/workforce/staffTenantLinkRepair.server.ts",
] as const;

export const STAFF_IDENTITY_DUAL_TABLE_ALLOWLIST_SET: ReadonlySet<string> = new Set(
  STAFF_IDENTITY_DUAL_TABLE_ALLOWLIST
);
