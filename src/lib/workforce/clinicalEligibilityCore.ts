/**
 * Clinical workforce eligibility engine (WorkforceOS Sprint 3).
 */

import { isOperationallyIneligible } from "@/src/lib/workforce-os/staffLifecycleCore";
import type { StaffEmploymentStatus } from "@/src/lib/workforce-os/staffLifecycleTypes";
import type {
  ClinicalEligibilityStatus,
  ComplianceAlertRecord,
  StaffCertificationRecord,
  StaffCredentialRecord,
} from "@/src/lib/workforce/workforceClinicalTypes";

export type StaffClinicalEligibilityResult = {
  eligible: boolean;
  status: ClinicalEligibilityStatus;
  score: number;
  blockingReasons: string[];
  warnings: string[];
};

export type ClinicalEligibilityInput = {
  employmentStatus: StaffEmploymentStatus;
  isActive: boolean;
  isClinicalRole: boolean;
  credentials: StaffCredentialRecord[];
  certifications: StaffCertificationRecord[];
  complianceAlerts: ComplianceAlertRecord[];
  trainingComplete: boolean;
  sopAcknowledgementsComplete: boolean;
  managerApproved: boolean;
  rolePermissionsActive: boolean;
  hasExpiredComplianceDocuments: boolean;
  readinessEligible: boolean;
  readinessBlockingIssues: string[];
};

const INACTIVE_STATUSES = new Set([
  "terminated",
  "resigned",
  "contract_ended",
  "contract_expired",
  "merged",
  "offboarded",
]);

function scoreFromInput(input: ClinicalEligibilityInput, penalties: number): number {
  let score = 100;
  score -= penalties;
  if (!input.trainingComplete) score -= 8;
  if (!input.sopAcknowledgementsComplete) score -= 6;
  if (!input.managerApproved) score -= 5;
  if (!input.rolePermissionsActive) score -= 10;
  if (!input.readinessEligible) score -= 15;
  for (const cert of input.certifications) {
    if (cert.isExpired) score -= 12;
    else if (cert.isExpiringSoon) score -= 4;
    if (!cert.verified) score -= 2;
  }
  for (const cred of input.credentials) {
    if (cred.status === "expiring_soon") score -= 3;
  }
  return Math.max(0, Math.min(100, Math.round(score)));
}

export function calculateClinicalEligibility(
  input: ClinicalEligibilityInput
): StaffClinicalEligibilityResult {
  const blockingReasons: string[] = [];
  const warnings: string[] = [];
  let penalties = 0;

  const inactive =
    !input.isActive ||
    isOperationallyIneligible(input.employmentStatus) ||
    INACTIVE_STATUSES.has(String(input.employmentStatus).toLowerCase());

  if (inactive) {
    blockingReasons.push("Staff member is inactive or offboarded");
    return {
      eligible: false,
      status: "inactive",
      score: 0,
      blockingReasons,
      warnings,
    };
  }

  if (!input.isClinicalRole) {
    return {
      eligible: false,
      status: "non_clinical",
      score: scoreFromInput(input, 0),
      blockingReasons: [],
      warnings: ["Role is non-clinical"],
    };
  }

  for (const cred of input.credentials) {
    if (cred.status === "expired" && cred.blocksClinicalWork) {
      blockingReasons.push(`${cred.displayName} expired`);
      penalties += 40;
    } else if (cred.status === "suspended" && cred.blocksClinicalWork) {
      blockingReasons.push(`${cred.displayName} suspended`);
      penalties += 35;
    } else if (cred.status === "revoked" && cred.blocksClinicalWork) {
      blockingReasons.push(`${cred.displayName} revoked`);
      penalties += 40;
    } else if (cred.status === "expiring_soon" && cred.expiresAt) {
      const days = Math.ceil(
        (new Date(cred.expiresAt).getTime() - Date.now()) / 86_400_000
      );
      warnings.push(`${cred.displayName} expires in ${days} day(s)`);
    }
  }

  if (blockingReasons.some((r) => r.includes("expired") || r.includes("revoked"))) {
    return {
      eligible: false,
      status: "expired_credentials",
      score: scoreFromInput(input, penalties),
      blockingReasons,
      warnings,
    };
  }

  const criticalAlerts = input.complianceAlerts.filter(
    (a) => !a.resolved && (a.severity === "critical" || a.severity === "high")
  );
  if (criticalAlerts.length > 0) {
    for (const alert of criticalAlerts) {
      blockingReasons.push(alert.message ?? alert.alertType);
    }
    return {
      eligible: false,
      status: "compliance_blocked",
      score: scoreFromInput(input, penalties + 25),
      blockingReasons,
      warnings,
    };
  }

  if (!input.trainingComplete || !input.sopAcknowledgementsComplete) {
    blockingReasons.push("Required training or SOP acknowledgements incomplete");
    return {
      eligible: false,
      status: "training_incomplete",
      score: scoreFromInput(input, penalties + 20),
      blockingReasons,
      warnings,
    };
  }

  if (input.hasExpiredComplianceDocuments) {
    blockingReasons.push("Expired compliance documents on file");
    penalties += 20;
  }

  const expiredCerts = input.certifications.filter((c) => c.isExpired);
  const missingRequiredCerts = input.certifications.length === 0;

  if (expiredCerts.length > 0) {
    for (const cert of expiredCerts) {
      warnings.push(`${cert.certificationName} certification expired`);
    }
    penalties += expiredCerts.length * 10;
  }

  if (!input.readinessEligible) {
    for (const issue of input.readinessBlockingIssues) {
      warnings.push(issue);
    }
    penalties += 15;
  }

  if (missingRequiredCerts || expiredCerts.length > 0) {
    return {
      eligible: false,
      status: "restricted",
      score: scoreFromInput(input, penalties),
      blockingReasons:
        expiredCerts.length > 0
          ? expiredCerts.map((c) => `${c.certificationName} certification expired`)
          : ["Required certifications missing"],
      warnings,
    };
  }

  if (blockingReasons.length > 0 || penalties >= 25) {
    return {
      eligible: false,
      status: "restricted",
      score: scoreFromInput(input, penalties),
      blockingReasons,
      warnings,
    };
  }

  return {
    eligible: true,
    status: "eligible",
    score: scoreFromInput(input, penalties),
    blockingReasons: [],
    warnings,
  };
}

/** @deprecated Use calculateClinicalEligibility */
export type ClinicalEligibilityResult = StaffClinicalEligibilityResult & {
  legalEligible: boolean;
  operationalEligible: boolean;
  clinicalEligible: boolean;
  blockingIssues: string[];
  reason: string | null;
  snapshot: Record<string, unknown>;
};

/** @deprecated Use calculateClinicalEligibility */
export function evaluateClinicalEligibility(input: {
  employmentStatus: StaffEmploymentStatus;
  isActive: boolean;
  credentials: Array<{
    id: string;
    credentialKey: string;
    credentialType: string;
    displayName: string;
    expiresAt: string | null;
    status: string;
    blocksClinicalWork: boolean;
    verificationStatus?: string;
  }>;
  certifications: Array<{
    id: string;
    certificationKey: string;
    certificationType: string;
    displayName: string;
    expiresAt: string | null;
    status: string;
  }>;
  complianceObligations: Array<{ status: string; severity: string; title: string }>;
  readinessEligible: boolean;
  readinessBlockingIssues: string[];
  procedurePrivilegeEligible?: boolean;
  requireVerifiedCredentials?: boolean;
}): ClinicalEligibilityResult {
  const mapped = calculateClinicalEligibility({
    employmentStatus: input.employmentStatus,
    isActive: input.isActive,
    isClinicalRole: true,
    credentials: input.credentials.map((c) => ({
      id: c.id,
      staffMemberId: "",
      credentialType: c.credentialType,
      credentialKey: c.credentialKey,
      displayName: c.displayName,
      issuingBody: null,
      credentialNumber: null,
      issuedAt: null,
      expiresAt: c.expiresAt,
      status: c.status as StaffCredentialRecord["status"],
      reminderSent: false,
      blocksClinicalWork: c.blocksClinicalWork,
    })),
    certifications: input.certifications.map((c) => ({
      id: c.id,
      staffMemberId: "",
      certificationName: c.displayName,
      certificationKey: c.certificationKey,
      certificationType: c.certificationType,
      issuingOrganization: null,
      issuedAt: null,
      expiresAt: c.expiresAt,
      competencyScore: null,
      verified: true,
      isExpired: c.status === "expired",
      isExpiringSoon: c.status === "due_soon",
    })),
    complianceAlerts: input.complianceObligations
      .filter((o) => o.severity === "blocking" && o.status === "overdue")
      .map((o, i) => ({
        id: `legacy-${i}`,
        staffMemberId: "",
        alertType: "legacy_obligation",
        severity: "critical" as const,
        message: o.title,
        resolved: false,
        createdAt: new Date().toISOString(),
      })),
    trainingComplete: input.readinessEligible,
    sopAcknowledgementsComplete: input.readinessEligible,
    managerApproved: true,
    rolePermissionsActive: input.procedurePrivilegeEligible !== false,
    hasExpiredComplianceDocuments: false,
    readinessEligible: input.readinessEligible,
    readinessBlockingIssues: input.readinessBlockingIssues,
  });

  return {
    ...mapped,
    legalEligible: mapped.status !== "expired_credentials",
    operationalEligible: mapped.status !== "inactive",
    clinicalEligible: mapped.eligible,
    blockingIssues: mapped.blockingReasons as never[],
    reason: mapped.eligible ? null : mapped.blockingReasons[0] ?? "Not clinically eligible",
    snapshot: {},
  };
}