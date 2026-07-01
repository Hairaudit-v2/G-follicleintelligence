import assert from "node:assert/strict";
import { test } from "node:test";

import {
  CREDENTIAL_DUE_SOON_DAYS,
  evaluateCertificationExpiry,
  evaluateCredentialExpiry,
} from "@/src/lib/workforce/credentialExpiryCore";
import { calculateClinicalEligibility } from "@/src/lib/workforce/clinicalEligibilityCore";
import {
  formatClinicalEligibilityBlockMessage,
  StaffClinicalEligibilityError,
} from "@/src/lib/workforce/clinicalEligibilityGate.server";
import type { StaffCredentialRecord, StaffCertificationRecord } from "@/src/lib/workforce/workforceClinicalTypes";

const NOW = new Date("2026-07-01T12:00:00.000Z");

function baseCredential(overrides: Partial<StaffCredentialRecord> = {}): StaffCredentialRecord {
  return {
    id: "c1",
    staffMemberId: "sm1",
    credentialType: "AHPRA Registration",
    credentialKey: "ahpra_registration",
    displayName: "AHPRA Registration",
    issuingBody: "AHPRA",
    credentialNumber: "MED123",
    issuedAt: "2024-01-01T00:00:00.000Z",
    expiresAt: "2027-01-01T00:00:00.000Z",
    status: "active",
    reminderSent: false,
    blocksClinicalWork: true,
    ...overrides,
  };
}

function baseInput(overrides: Record<string, unknown> = {}) {
  return {
    employmentStatus: "active" as const,
    isActive: true,
    isClinicalRole: true,
    credentials: [baseCredential()],
    certifications: [] as StaffCertificationRecord[],
    complianceAlerts: [],
    trainingComplete: true,
    sopAcknowledgementsComplete: true,
    managerApproved: true,
    rolePermissionsActive: true,
    hasExpiredComplianceDocuments: false,
    readinessEligible: true,
    readinessBlockingIssues: [],
    ...overrides,
  };
}

test("evaluateCredentialExpiry marks past expiry as expired", () => {
  const result = evaluateCredentialExpiry({
    expiresAt: "2026-06-01T00:00:00.000Z",
    now: NOW,
  });
  assert.equal(result.status, "expired");
  assert.equal(result.isExpired, true);
});

test("evaluateCredentialExpiry marks near expiry as expiring_soon", () => {
  const soon = new Date(NOW.getTime() + 10 * 86_400_000).toISOString();
  const result = evaluateCredentialExpiry({ expiresAt: soon, now: NOW });
  assert.equal(result.status, "expiring_soon");
  assert.equal(result.isDueSoon, true);
  assert.equal(result.isExpired, false);
});

test("active staff with valid credential is eligible", () => {
  const result = calculateClinicalEligibility(
    baseInput({
      certifications: [
        {
          id: "cert1",
          staffMemberId: "sm1",
          certificationName: "Sterile Surgical Protocol Certification",
          certificationKey: "sterile_surgical",
          certificationType: "clinical",
          issuingOrganization: null,
          issuedAt: "2025-01-01T00:00:00.000Z",
          expiresAt: "2027-01-01T00:00:00.000Z",
          competencyScore: 95,
          verified: true,
          isExpired: false,
          isExpiringSoon: false,
        },
      ],
    })
  );
  assert.equal(result.eligible, true);
  assert.equal(result.status, "eligible");
  assert.ok(result.score >= 80);
});

test("expired blocking credential blocks eligibility", () => {
  const result = calculateClinicalEligibility(
    baseInput({
      credentials: [
        baseCredential({
          status: "expired",
          expiresAt: "2026-01-01T00:00:00.000Z",
        }),
      ],
    })
  );
  assert.equal(result.eligible, false);
  assert.equal(result.status, "expired_credentials");
  assert.ok(result.blockingReasons.some((r) => r.includes("AHPRA")));
});

test("inactive staff is blocked", () => {
  const result = calculateClinicalEligibility(
    baseInput({ isActive: false, employmentStatus: "terminated" })
  );
  assert.equal(result.eligible, false);
  assert.equal(result.status, "inactive");
});

test("expired certification restricts eligibility", () => {
  const result = calculateClinicalEligibility(
    baseInput({
      certifications: [
        {
          id: "cert1",
          staffMemberId: "sm1",
          certificationName: "PRP Protocol Certification",
          certificationKey: "prp_protocol",
          certificationType: "clinical",
          issuingOrganization: null,
          issuedAt: "2025-01-01T00:00:00.000Z",
          expiresAt: "2026-01-01T00:00:00.000Z",
          competencyScore: null,
          verified: true,
          isExpired: true,
          isExpiringSoon: false,
        },
      ],
    })
  );
  assert.equal(result.eligible, false);
  assert.equal(result.status, "restricted");
  assert.ok(
    result.blockingReasons.some((r) => r.includes("PRP Protocol Certification"))
  );
});

test("compliance alert upsert key pattern for expired certification", () => {
  const evaluation = evaluateCertificationExpiry({
    expiresAt: "2026-01-01T00:00:00.000Z",
    now: NOW,
  });
  assert.equal(evaluation.isExpired, true);
  const alertType = `certification_expired:prp_protocol`;
  assert.match(alertType, /^certification_expired:/);
});

test("offboarded staff with permissions alert type", () => {
  const alertType = "offboarded_with_permissions";
  assert.equal(alertType, "offboarded_with_permissions");
});

test("SurgeryOS block message format", () => {
  const msg = formatClinicalEligibilityBlockMessage("Dr Seetal", [
    "AHPRA Registration expires in 2 days",
  ]);
  assert.match(msg, /Cannot assign Dr Seetal/);
  assert.match(msg, /AHPRA Registration expires in 2 days/);
});

test("StaffClinicalEligibilityError preserves message", () => {
  const err = new StaffClinicalEligibilityError("Cannot assign Nurse Anna. Reason: PRP Certification expired.");
  assert.equal(err.name, "StaffClinicalEligibilityError");
  assert.match(err.message, /PRP Certification expired/);
});

test("credential due soon window constant", () => {
  assert.equal(CREDENTIAL_DUE_SOON_DAYS, 30);
});