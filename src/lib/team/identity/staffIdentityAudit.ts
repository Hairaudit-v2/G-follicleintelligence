/**
 * Audit helpers for ambiguous / repaired / unusable identity links.
 * Pure surfaces for logging and diagnostics — not the UAT readiness audit server.
 */

import type {
  StaffIdentity,
  StaffIdentityIntegrityWarning,
  StaffIdentityLinkStatus,
} from "@/src/lib/team/identity/types";
import { STAFF_IDENTITY_UNUSABLE_LINK_STATUSES } from "@/src/lib/team/identity/constants";

export type StaffIdentityAuditEvent = {
  kind: "identity_integrity";
  tenantId: string;
  personKey: string;
  staffId: string | null;
  staffMemberId: string | null;
  linkStatus: StaffIdentityLinkStatus;
  warnings: StaffIdentityIntegrityWarning[];
  requiresAttention: boolean;
};

export function buildStaffIdentityAuditEvent(identity: StaffIdentity): StaffIdentityAuditEvent {
  const requiresAttention =
    STAFF_IDENTITY_UNUSABLE_LINK_STATUSES.has(identity.integrity.linkStatus) ||
    identity.integrity.linkStatus === "ambiguous" ||
    identity.integrity.warnings.some(
      (w) =>
        w.code === "multiple_lifecycle_candidates" ||
        w.code === "cross_tenant_link" ||
        w.code === "broken_staff_fk"
    );

  return {
    kind: "identity_integrity",
    tenantId: identity.tenantId,
    personKey: identity.personKey,
    staffId: identity.staffId,
    staffMemberId: identity.staffMemberId,
    linkStatus: identity.integrity.linkStatus,
    warnings: identity.integrity.warnings,
    requiresAttention,
  };
}

export function summariseStaffIdentityWarnings(
  warnings: StaffIdentityIntegrityWarning[]
): string {
  if (!warnings.length) return "";
  return warnings.map((w) => w.message).join(" ");
}
