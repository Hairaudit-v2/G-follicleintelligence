/** Credential types (display names per Sprint 3 spec). */
export const STAFF_CREDENTIAL_TYPES = [
  "AHPRA Registration",
  "Medical License",
  "Nursing Registration",
  "Surgical Certification",
  "Laser Certification",
  "Injectables Certification",
  "CPR Certification",
  "First Aid Certification",
  "Radiation License",
  "Pharmacy Authority",
] as const;

export type StaffCredentialType = (typeof STAFF_CREDENTIAL_TYPES)[number] | string;

export const STAFF_CREDENTIAL_STATUSES = [
  "active",
  "expiring_soon",
  "expired",
  "suspended",
  "revoked",
] as const;

export type StaffCredentialStatus = (typeof STAFF_CREDENTIAL_STATUSES)[number];

export const STAFF_CERTIFICATION_EXAMPLES = [
  "FUE Extraction Certification",
  "DFI Implant Certification",
  "PRP Protocol Certification",
  "Exosome Protocol Certification",
  "Hairline Design Certification",
  "Sterile Surgical Protocol Certification",
  "Emergency Response Certification",
] as const;

export const COMPLIANCE_ALERT_SEVERITIES = ["low", "medium", "high", "critical"] as const;
export type ComplianceAlertSeverity = (typeof COMPLIANCE_ALERT_SEVERITIES)[number];

export const CLINICAL_ELIGIBILITY_STATUSES = [
  "eligible",
  "restricted",
  "non_clinical",
  "expired_credentials",
  "training_incomplete",
  "compliance_blocked",
  "inactive",
] as const;

export type ClinicalEligibilityStatus = (typeof CLINICAL_ELIGIBILITY_STATUSES)[number];

export type StaffCredentialRecord = {
  id: string;
  staffMemberId: string;
  credentialType: string;
  credentialKey: string;
  displayName: string;
  issuingBody: string | null;
  credentialNumber: string | null;
  issuedAt: string | null;
  expiresAt: string | null;
  status: StaffCredentialStatus;
  reminderSent: boolean;
  blocksClinicalWork: boolean;
};

export type StaffCertificationRecord = {
  id: string;
  staffMemberId: string;
  certificationName: string;
  certificationKey: string;
  certificationType: string | null;
  issuingOrganization: string | null;
  issuedAt: string | null;
  expiresAt: string | null;
  competencyScore: number | null;
  verified: boolean;
  isExpired: boolean;
  isExpiringSoon: boolean;
};

export type ComplianceAlertRecord = {
  id: string;
  staffMemberId: string;
  alertType: string;
  severity: ComplianceAlertSeverity;
  message: string | null;
  resolved: boolean;
  createdAt: string;
};

/** @deprecated Use StaffCredentialRecord — kept for transitional imports. */
export type StaffCredentialSnapshot = {
  id: string;
  credentialKey: string;
  credentialType: string;
  displayName: string;
  expiresAt: string | null;
  status: StaffCredentialStatus;
  blocksClinicalWork: boolean;
  verificationStatus: string;
};

/** @deprecated Use StaffCertificationRecord. */
export type StaffCertificationSnapshot = {
  id: string;
  certificationKey: string;
  certificationType: string;
  displayName: string;
  expiresAt: string | null;
  status: string;
};