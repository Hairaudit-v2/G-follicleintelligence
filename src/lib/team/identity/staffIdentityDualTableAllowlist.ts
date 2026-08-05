/**
 * Frozen allowlist of files that already reference both `fi_staff` and
 * `fi_staff_members` outside canonical Team domains (B0/B1 debt).
 *
 * Exempt from this debt scan (domain-owned, not allowlisted):
 * - `src/lib/team/identity/**`
 * - `src/lib/team/access/**` (B2.2b — login invite / PIN mutation servers)
 * - `src/lib/team/onboarding/**` (B2.2c — hire-invite / dual-row provision)
 *
 * New files must not appear here without an explicit Team cohesion register update.
 * Snapshot: FI-TEAM-COHESION-B2.2c — Onboarding consolidation + cycle break.
 *
 * Allowlist before B2.2c: 13
 * Entries removed: 1
 *   - `src/lib/workforce/onboarding/onboardingInvitation.server.ts` → `team/onboarding` (exempt)
 * Allowlist after: 12
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
  "src/lib/workforce/staffOffboarding.server.ts",
  "src/lib/workforce/staffTenantLinkRepair.server.ts",
] as const;

export const STAFF_IDENTITY_DUAL_TABLE_ALLOWLIST_SET: ReadonlySet<string> = new Set(
  STAFF_IDENTITY_DUAL_TABLE_ALLOWLIST
);
