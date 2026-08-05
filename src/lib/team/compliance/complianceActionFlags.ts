/**
 * Identity-aware action gates for compliance projections.
 * Lifecycle-only remains mutation-eligible when domain policy allows;
 * ambiguous / invalid / cross-tenant suppress unsafe actions.
 */

import type { StaffIdentity } from "@/src/lib/team/identity/types";

export function isComplianceIdentityTargetUncertain(identity: StaffIdentity): boolean {
  const { linkStatus } = identity.integrity;
  return (
    linkStatus === "ambiguous" ||
    linkStatus === "cross_tenant_mismatch" ||
    linkStatus === "invalid"
  );
}

export type ComplianceDomainActionFacts = {
  canUpload: boolean;
  canVerify: boolean;
  canReject: boolean;
  canRequestReplacement: boolean;
};

export type StaffComplianceActionFlags = {
  canUploadCredential: boolean;
  canVerifyCredential: boolean;
  canRejectCredential: boolean;
  canRequestReplacement: boolean;
  canResolveIdentity: boolean;
};

export function deriveStaffComplianceActionFlags(
  identity: StaffIdentity,
  facts: ComplianceDomainActionFacts
): StaffComplianceActionFlags {
  const uncertain = isComplianceIdentityTargetUncertain(identity);
  const hasLifecycle = Boolean(identity.staffMemberId?.trim());

  // Scheduling-only without lifecycle: no credential mutations (no history subject).
  if (!hasLifecycle) {
    return {
      canUploadCredential: false,
      canVerifyCredential: false,
      canRejectCredential: false,
      canRequestReplacement: false,
      canResolveIdentity: uncertain || identity.integrity.linkStatus === "scheduling_only",
    };
  }

  if (uncertain) {
    return {
      canUploadCredential: false,
      canVerifyCredential: false,
      canRejectCredential: false,
      canRequestReplacement: false,
      canResolveIdentity: true,
    };
  }

  return {
    canUploadCredential: facts.canUpload,
    canVerifyCredential: facts.canVerify,
    canRejectCredential: facts.canReject,
    canRequestReplacement: facts.canRequestReplacement,
    canResolveIdentity: false,
  };
}
