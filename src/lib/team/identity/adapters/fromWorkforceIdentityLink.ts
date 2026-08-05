/**
 * Compatibility adapters from legacy identity helpers into StaffIdentity.
 */

import type { StaffIdentity } from "@/src/lib/team/identity/types";

/** Minimal external link shape — avoids importing identity-links server module into pure API. */
export type ExternalStaffIdentityLinkRef = {
  sourceSystem: string;
};

/**
 * Summarise external workforce identity links onto a StaffIdentity (metadata only).
 * Does not change linkStatus — external source_ids are not the fi_staff ↔ members join.
 */
export function annotateStaffIdentityWithExternalLinks(
  identity: StaffIdentity,
  links: ExternalStaffIdentityLinkRef[]
): StaffIdentity {
  if (!links.length) return identity;
  const sourceSystems = links.map((l) => l.sourceSystem).filter(Boolean);
  return {
    ...identity,
    capabilities: Array.from(
      new Set([...identity.capabilities, ...sourceSystems.map((s) => `ext:${s}`)])
    ),
  };
}

/**
 * Map a StaffIdentity onto the legacy resolveStaffMemberContext shape.
 * Returns null when no lifecycle member id exists (preserves scheduling-only → null behaviour).
 */
export function toResolvedStaffMemberContext(identity: StaffIdentity | null): {
  staffMemberId: string;
  fiStaffId: string | null;
  employmentStatus: string;
  fullName: string | null;
} | null {
  if (!identity?.staffMemberId) return null;
  if (
    identity.integrity.linkStatus === "cross_tenant_mismatch" ||
    identity.integrity.linkStatus === "invalid"
  ) {
    return null;
  }
  return {
    staffMemberId: identity.staffMemberId,
    fiStaffId: identity.staffId,
    employmentStatus: identity.employmentStatus,
    fullName: identity.displayName || null,
  };
}
