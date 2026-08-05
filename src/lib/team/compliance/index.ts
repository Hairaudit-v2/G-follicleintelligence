/**
 * Public Team compliance API — pure types and projection helpers.
 * Server loaders remain in `src/lib/workforce/` until a later domain move;
 * they must import from this index (and identity/server), never from `team/identity/internal`.
 */

export type {
  StaffComplianceAttentionReason,
  StaffComplianceEntry,
  StaffComplianceIdentitySummary,
} from "@/src/lib/team/compliance/types";

export { STAFF_COMPLIANCE_ATTENTION_LABELS } from "@/src/lib/team/compliance/types";

export { deriveStaffComplianceAttentionReasons } from "@/src/lib/team/compliance/complianceAttentionReasons";

export {
  deriveStaffComplianceActionFlags,
  isComplianceIdentityTargetUncertain,
  type ComplianceDomainActionFacts,
  type StaffComplianceActionFlags,
} from "@/src/lib/team/compliance/complianceActionFlags";

export {
  deriveComplianceBlockers,
  summariseCertifications,
  summariseCredentials,
  type CertificationSummary,
  type CredentialSummary,
} from "@/src/lib/team/compliance/credentialReadinessBridge";

export {
  projectStaffComplianceEntry,
  type StaffComplianceProjectionFacts,
} from "@/src/lib/team/compliance/projectStaffComplianceEntry";

export {
  applyStaffComplianceEntryFlags,
  type CredentialsCentreActionFlags,
} from "@/src/lib/team/compliance/toCredentialsCentreRow";
