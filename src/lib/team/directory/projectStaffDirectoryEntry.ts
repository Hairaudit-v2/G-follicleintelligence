/**
 * Pure projection: StaffIdentity → StaffDirectoryEntry (+ attention reasons).
 */

import type { StaffIdentity } from "@/src/lib/team/identity/types";
import type {
  StaffDirectoryAttentionReason,
  StaffDirectoryEntry,
} from "@/src/lib/team/directory/types";

export function deriveStaffDirectoryAttentionReasons(
  identity: StaffIdentity
): StaffDirectoryAttentionReason[] {
  const reasons: StaffDirectoryAttentionReason[] = [];
  const { linkStatus } = identity.integrity;

  if (linkStatus === "cross_tenant_mismatch") {
    reasons.push("cross_tenant_mismatch");
  } else if (linkStatus === "invalid") {
    reasons.push("identity_invalid");
  } else if (linkStatus === "ambiguous") {
    reasons.push("identity_requires_reconciliation");
  } else if (linkStatus === "scheduling_only") {
    reasons.push("lifecycle_record_missing");
    reasons.push("identity_link_incomplete");
  } else if (linkStatus === "lifecycle_only") {
    reasons.push("scheduling_record_missing");
    reasons.push("identity_link_incomplete");
  }

  return reasons;
}

export function projectStaffDirectoryEntry(identity: StaffIdentity): StaffDirectoryEntry {
  return {
    identity: {
      personId: identity.personKey,
      staffId: identity.staffId,
      staffMemberId: identity.staffMemberId,
      integrity: identity.integrity,
    },
    displayName: identity.displayName,
    email: identity.email,
    employmentStatus: identity.employmentStatus,
    accessStatus: identity.accessStatus,
    readinessStatus: identity.readinessStatus,
    clinicIds: identity.clinicIds,
    primaryClinicId: identity.primaryClinicId,
    roleLabels: identity.roles,
    attentionReasons: deriveStaffDirectoryAttentionReasons(identity),
    archivedAt: identity.archivedAt,
    hrLinked: identity.hrLinked,
  };
}

/**
 * Map batch identities onto the legacy directory lifecycle signal shape
 * used by enrichStaffDirectoryRows (behaviour-neutral for valid linked staff).
 */
export function toStaffDirectoryLifecycleSignal(identity: StaffIdentity | null): {
  employmentStatus: string | null;
  archivedAt: string | null;
  hrLinked: boolean;
} | null {
  if (!identity) return null;
  return {
    employmentStatus: identity.employmentStatus,
    archivedAt: identity.archivedAt,
    hrLinked: identity.hrLinked,
  };
}
