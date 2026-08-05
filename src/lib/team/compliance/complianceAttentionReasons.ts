/**
 * Derive compliance attention from identity + summarised compliance facts.
 * Identity warnings do not overwrite domain compliance blockers.
 */

import type { StaffIdentity } from "@/src/lib/team/identity/types";
import type {
  CertificationSummary,
  CredentialSummary,
} from "@/src/lib/team/compliance/credentialReadinessBridge";
import type { StaffComplianceAttentionReason } from "@/src/lib/team/compliance/types";

export function deriveStaffComplianceAttentionReasons(
  identity: StaffIdentity,
  facts: {
    credentials: CredentialSummary;
    certifications: CertificationSummary;
  }
): StaffComplianceAttentionReason[] {
  const reasons: StaffComplianceAttentionReason[] = [];
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

  if (facts.credentials.expired > 0) reasons.push("credentials_expired");
  if (facts.credentials.expiringSoon > 0) reasons.push("credentials_expiring_soon");
  if (facts.certifications.incomplete > 0) reasons.push("certifications_incomplete");

  return reasons;
}
