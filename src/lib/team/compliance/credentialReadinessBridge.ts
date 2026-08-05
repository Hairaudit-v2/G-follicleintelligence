/**
 * Summarise existing credential / certification records for the compliance projection.
 * Pure — does not recalculate expiry; uses already-evaluated status fields.
 */

import type {
  StaffCertificationRecord,
  StaffCredentialRecord,
} from "@/src/lib/workforce/workforceClinicalTypes";

export type CredentialSummary = {
  total: number;
  verified: number;
  expiringSoon: number;
  expired: number;
  rejected: number;
  pendingReview: number;
};

export type CertificationSummary = {
  current: number;
  expired: number;
  incomplete: number;
};

export function summariseCredentials(
  credentials: readonly StaffCredentialRecord[]
): CredentialSummary {
  let verified = 0;
  let expiringSoon = 0;
  let expired = 0;
  let rejected = 0;
  let pendingReview = 0;

  for (const row of credentials) {
    if (row.status === "active") verified += 1;
    else if (row.status === "expiring_soon") expiringSoon += 1;
    else if (row.status === "expired") expired += 1;
    else if (row.status === "revoked") rejected += 1;
    else if (row.status === "suspended") pendingReview += 1;
  }

  return {
    total: credentials.length,
    verified,
    expiringSoon,
    expired,
    rejected,
    pendingReview,
  };
}

export function summariseCertifications(
  certifications: readonly StaffCertificationRecord[]
): CertificationSummary {
  let current = 0;
  let expired = 0;
  let incomplete = 0;

  for (const row of certifications) {
    if (row.isExpired) {
      expired += 1;
      continue;
    }
    if (row.verified) {
      current += 1;
      continue;
    }
    incomplete += 1;
  }

  return { current, expired, incomplete };
}

/**
 * Domain compliance blockers derived from already-evaluated records.
 * Identity attention is layered separately and must not replace these.
 */
export function deriveComplianceBlockers(input: {
  credentials: CredentialSummary;
  certifications: CertificationSummary;
}): string[] {
  const blockers: string[] = [];
  if (input.credentials.expired > 0) {
    blockers.push(`${input.credentials.expired} expired credential(s)`);
  }
  if (input.credentials.expiringSoon > 0) {
    blockers.push(`${input.credentials.expiringSoon} credential(s) expiring soon`);
  }
  if (input.certifications.expired > 0) {
    blockers.push(`${input.certifications.expired} expired certification(s)`);
  }
  if (input.certifications.incomplete > 0) {
    blockers.push(`${input.certifications.incomplete} incomplete certification(s)`);
  }
  return blockers;
}
