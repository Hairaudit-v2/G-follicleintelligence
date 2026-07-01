/**
 * Pure credential / certification expiry evaluation (WorkforceOS Sprint 3).
 */

import type { StaffCredentialStatus } from "@/src/lib/workforce/workforceClinicalTypes";

const MS_DAY = 86_400_000;
export const CREDENTIAL_DUE_SOON_DAYS = 30;

export type ExpiryEvaluation = {
  status: StaffCredentialStatus;
  daysUntilExpiry: number | null;
  isExpired: boolean;
  isDueSoon: boolean;
  blocksClinicalWork: boolean;
};

export type CertificationExpiryEvaluation = {
  isExpired: boolean;
  isDueSoon: boolean;
  daysUntilExpiry: number | null;
  blocksClinicalWork: boolean;
};

function parseIso(iso: string | null | undefined): Date | null {
  if (!iso?.trim()) return null;
  const d = new Date(iso);
  return Number.isNaN(d.getTime()) ? null : d;
}

export function evaluateCredentialExpiry(input: {
  expiresAt: string | null;
  revoked?: boolean;
  suspended?: boolean;
  blocksClinicalWork?: boolean;
  now?: Date;
  dueSoonDays?: number;
}): ExpiryEvaluation {
  const now = input.now ?? new Date();
  const dueSoonDays = input.dueSoonDays ?? CREDENTIAL_DUE_SOON_DAYS;

  if (input.revoked) {
    return {
      status: "revoked",
      daysUntilExpiry: null,
      isExpired: true,
      isDueSoon: false,
      blocksClinicalWork: true,
    };
  }

  if (input.suspended) {
    return {
      status: "suspended",
      daysUntilExpiry: null,
      isExpired: false,
      isDueSoon: false,
      blocksClinicalWork: input.blocksClinicalWork ?? true,
    };
  }

  const exp = parseIso(input.expiresAt);
  if (!exp) {
    return {
      status: "active",
      daysUntilExpiry: null,
      isExpired: false,
      isDueSoon: false,
      blocksClinicalWork: false,
    };
  }

  const days = Math.ceil((exp.getTime() - now.getTime()) / MS_DAY);
  if (days < 0) {
    return {
      status: "expired",
      daysUntilExpiry: days,
      isExpired: true,
      isDueSoon: false,
      blocksClinicalWork: input.blocksClinicalWork ?? true,
    };
  }

  if (days <= dueSoonDays) {
    return {
      status: "expiring_soon",
      daysUntilExpiry: days,
      isExpired: false,
      isDueSoon: true,
      blocksClinicalWork: false,
    };
  }

  return {
    status: "active",
    daysUntilExpiry: days,
    isExpired: false,
    isDueSoon: false,
    blocksClinicalWork: false,
  };
}

export function evaluateCertificationExpiry(input: {
  expiresAt: string | null;
  revoked?: boolean;
  now?: Date;
  dueSoonDays?: number;
}): CertificationExpiryEvaluation {
  const now = input.now ?? new Date();
  const dueSoonDays = input.dueSoonDays ?? CREDENTIAL_DUE_SOON_DAYS;

  if (input.revoked) {
    return {
      isExpired: true,
      isDueSoon: false,
      daysUntilExpiry: null,
      blocksClinicalWork: true,
    };
  }

  const exp = parseIso(input.expiresAt);
  if (!exp) {
    return {
      isExpired: false,
      isDueSoon: false,
      daysUntilExpiry: null,
      blocksClinicalWork: false,
    };
  }

  const days = Math.ceil((exp.getTime() - now.getTime()) / MS_DAY);
  if (days < 0) {
    return {
      isExpired: true,
      isDueSoon: false,
      daysUntilExpiry: days,
      blocksClinicalWork: true,
    };
  }
  if (days <= dueSoonDays) {
    return {
      isExpired: false,
      isDueSoon: true,
      daysUntilExpiry: days,
      blocksClinicalWork: false,
    };
  }
  return {
    isExpired: false,
    isDueSoon: false,
    daysUntilExpiry: days,
    blocksClinicalWork: false,
  };
}

export function credentialTypeToKey(credentialType: string): string {
  return credentialType
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "_")
    .replace(/^_|_$/g, "");
}

export function certificationNameToKey(name: string): string {
  return name
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "_")
    .replace(/^_|_$/g, "");
}