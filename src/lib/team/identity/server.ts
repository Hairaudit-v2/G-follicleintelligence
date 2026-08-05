/**
 * Server entry for Team staff identity resolution.
 * Import from here — not from `internal/` or individual *.server modules —
 * unless you are inside `src/lib/team/identity`.
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
