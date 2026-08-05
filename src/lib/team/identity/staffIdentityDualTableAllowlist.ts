/**
 * Frozen allowlist of files that already reference both `fi_staff` and
 * `fi_staff_members` outside `src/lib/team/identity` (B0/B1 debt).
 *
 * New files must not appear here without an explicit Team cohesion register update.
 * Snapshot: FI-TEAM-COHESION-B2.1b — Identity server consolidation.
 *
 * Allowlist before B2.1b: 16
 * Entries removed: 1 (`src/lib/workforce-os/staffIdentityReadinessAudit.server.ts`
 *   moved into `team/identity`, which is exempt from the dual-table debt scan)
 * Allowlist after: 15
 *
 * Paths use forward slashes relative to repo root.
 */
export const STAFF_IDENTITY_DUAL_TABLE_ALLOWLIST = [
  "src/lib/crm/crmAssignableOwners.server.ts",
  "src/lib/crm/leadDetailsUpdate.ts",
  "src/lib/fiOs/todayStaffPersonHydration.server.ts",
  "src/lib/fiOs/workspaceAccessResolver.server.ts",
  "src/lib/fiOs/workspaceAccessResolverCore.ts",
  "src/lib/staffAccess/staffAccess.server.ts",
  "src/lib/staffImport/iiohrStaffDepartureAlignment.server.ts",
  "src/lib/workforce-os/hrReconciliation.server.ts",
  "src/lib/workforce-os/projectionHealth.server.ts",
  "src/lib/workforce-os/staffLifecycle.server.ts",
  "src/lib/workforce/onboarding/onboardingInvitation.server.ts",
  "src/lib/workforce/staffAccessAccept.server.ts",
  "src/lib/workforce/staffAccessPinLayer.server.ts",
  "src/lib/workforce/staffOffboarding.server.ts",
  "src/lib/workforce/staffTenantLinkRepair.server.ts",
] as const;

export const STAFF_IDENTITY_DUAL_TABLE_ALLOWLIST_SET: ReadonlySet<string> = new Set(
  STAFF_IDENTITY_DUAL_TABLE_ALLOWLIST
);
