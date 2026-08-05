/**
 * Compliance projection unit tests (FI-TEAM-COHESION-B1.5).
 */

import assert from "node:assert/strict";
import test from "node:test";

import type { StaffIdentity } from "@/src/lib/team/identity/types";
import {
  projectStaffComplianceEntry,
  summariseCertifications,
  summariseCredentials,
} from "@/src/lib/team/compliance";
import type {
  StaffCertificationRecord,
  StaffCredentialRecord,
} from "@/src/lib/workforce/workforceClinicalTypes";

function identity(overrides: Partial<StaffIdentity> = {}): StaffIdentity {
  return {
    tenantId: "11111111-1111-1111-1111-111111111111",
    personKey: "sm:44444444-4444-4444-4444-444444444444",
    staffId: "33333333-3333-3333-3333-333333333333",
    staffMemberId: "44444444-4444-4444-4444-444444444444",
    userId: null,
    displayName: "Ada",
    email: "ada@example.com",
    employmentStatus: "active",
    accessStatus: "no_login",
    readinessStatus: "ready",
    archivedAt: null,
    hrLinked: false,
    primaryClinicId: null,
    clinicIds: [],
    roles: ["nurse"],
    capabilities: [],
    integrity: {
      linkStatus: "linked",
      hasSchedulingRecord: true,
      hasLifecycleRecord: true,
      hasAuthIdentity: false,
      warnings: [],
    },
    ...overrides,
  };
}

function credential(overrides: Partial<StaffCredentialRecord> = {}): StaffCredentialRecord {
  return {
    id: "c1",
    staffMemberId: "44444444-4444-4444-4444-444444444444",
    credentialType: "AHPRA Registration",
    credentialKey: "ahpra_registration",
    displayName: "AHPRA Registration",
    issuingBody: null,
    credentialNumber: null,
    issuedAt: null,
    expiresAt: null,
    status: "active",
    reminderSent: false,
    blocksClinicalWork: true,
    ...overrides,
  };
}

function certification(
  overrides: Partial<StaffCertificationRecord> = {}
): StaffCertificationRecord {
  return {
    id: "cert1",
    staffMemberId: "44444444-4444-4444-4444-444444444444",
    certificationName: "FUE Extraction",
    certificationKey: "fue_extraction",
    certificationType: "clinical",
    issuingOrganization: null,
    issuedAt: null,
    expiresAt: null,
    competencyScore: null,
    verified: true,
    isExpired: false,
    isExpiringSoon: false,
    ...overrides,
  };
}

const domainFlags = {
  canUpload: true,
  canVerify: true,
  canReject: true,
  canRequestReplacement: true,
};

test("summariseCredentials preserves evaluated status buckets", () => {
  assert.deepEqual(
    summariseCredentials([
      credential({ status: "active" }),
      credential({ id: "c2", status: "expiring_soon" }),
      credential({ id: "c3", status: "expired" }),
      credential({ id: "c4", status: "revoked" }),
      credential({ id: "c5", status: "suspended" }),
    ]),
    {
      total: 5,
      verified: 1,
      expiringSoon: 1,
      expired: 1,
      rejected: 1,
      pendingReview: 1,
    }
  );
});

test("summariseCertifications separates current, expired, incomplete", () => {
  assert.deepEqual(
    summariseCertifications([
      certification(),
      certification({ id: "cert2", verified: false }),
      certification({ id: "cert3", isExpired: true, verified: false }),
    ]),
    { current: 1, expired: 1, incomplete: 1 }
  );
});

test("linked staff preserves upload actions and surfaces expiry attention separately", () => {
  const entry = projectStaffComplianceEntry(identity(), {
    ...domainFlags,
    credentials: [credential({ status: "expired" })],
    certifications: [],
  });
  assert.equal(entry.actions.canUploadCredential, true);
  assert.ok(entry.attentionReasons.includes("credentials_expired"));
  assert.ok(entry.readiness.complianceBlockers.some((b) => b.includes("expired credential")));
});

test("lifecycle-only remains a valid compliance subject", () => {
  const entry = projectStaffComplianceEntry(
    identity({
      staffId: null,
      integrity: {
        linkStatus: "lifecycle_only",
        hasSchedulingRecord: false,
        hasLifecycleRecord: true,
        hasAuthIdentity: false,
        warnings: [],
      },
    }),
    {
      ...domainFlags,
      credentials: [credential()],
      certifications: [certification()],
    }
  );
  assert.equal(entry.actions.canUploadCredential, true);
  assert.ok(entry.attentionReasons.includes("scheduling_record_missing"));
  assert.equal(entry.credentials.verified, 1);
});

test("ambiguous identity suppresses verify/upload without inventing eligibility", () => {
  const entry = projectStaffComplianceEntry(
    identity({
      integrity: {
        linkStatus: "ambiguous",
        hasSchedulingRecord: true,
        hasLifecycleRecord: true,
        hasAuthIdentity: true,
        warnings: [],
      },
    }),
    {
      ...domainFlags,
      credentials: [credential()],
      certifications: [],
    }
  );
  assert.equal(entry.actions.canUploadCredential, false);
  assert.equal(entry.actions.canVerifyCredential, false);
  assert.equal(entry.actions.canResolveIdentity, true);
  assert.ok(entry.attentionReasons.includes("identity_requires_reconciliation"));
});

test("scheduling-only without lifecycle cannot upload credentials", () => {
  const entry = projectStaffComplianceEntry(
    identity({
      staffMemberId: null,
      personKey: "st:33333333-3333-3333-3333-333333333333",
      integrity: {
        linkStatus: "scheduling_only",
        hasSchedulingRecord: true,
        hasLifecycleRecord: false,
        hasAuthIdentity: false,
        warnings: [],
      },
    }),
    {
      ...domainFlags,
      credentials: [],
      certifications: [],
    }
  );
  assert.equal(entry.actions.canUploadCredential, false);
  assert.ok(entry.attentionReasons.includes("lifecycle_record_missing"));
});

test("identity warning does not erase certification incomplete blockers", () => {
  const entry = projectStaffComplianceEntry(
    identity({
      integrity: {
        linkStatus: "lifecycle_only",
        hasSchedulingRecord: false,
        hasLifecycleRecord: true,
        hasAuthIdentity: false,
        warnings: [],
      },
    }),
    {
      ...domainFlags,
      credentials: [],
      certifications: [certification({ verified: false })],
    }
  );
  assert.ok(entry.attentionReasons.includes("certifications_incomplete"));
  assert.ok(entry.readiness.complianceBlockers.some((b) => b.includes("incomplete")));
});
