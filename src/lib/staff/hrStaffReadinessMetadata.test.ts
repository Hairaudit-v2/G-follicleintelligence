import assert from "node:assert/strict";
import { test } from "node:test";

import {
  extractValidatedHrReadinessFields,
  HR_STAFF_READINESS_METADATA_KEYS,
  HR_STAFF_SENSITIVE_METADATA_KEYS,
  mergeHrStaffSourceMetadataOnSync,
  sanitizeIiohrHrMetadataSnapshot,
} from "./hrStaffReadinessMetadata";
import { buildStaffHrNotificationSummary, STAFF_HR_SYNC_STALE_DAYS } from "./staffHrNotificationSummary";

const NOW = new Date("2026-06-09T12:00:00.000Z");
const FRESH_SYNC_AT = NOW.toISOString();

test("readiness metadata keys are written on merge", () => {
  const merged = mergeHrStaffSourceMetadataOnSync(
    { primary_fi_clinic_id: "clinic-1" },
    {
      onboarding_status: "pending",
      onboarding_completed_at: "2026-05-01T00:00:00.000Z",
      required_documents_missing_count: 2,
      training_required_count: 1,
      certificates_outstanding_count: 0,
      hr_profile_url: "https://hr.example/profile/1",
    },
    FRESH_SYNC_AT,
    "https://hr.example/profile/1"
  );

  for (const key of HR_STAFF_READINESS_METADATA_KEYS) {
    assert.ok(key in merged, `expected ${key} in merged metadata`);
  }
  assert.equal(merged.last_synced_at, FRESH_SYNC_AT);
  assert.equal(merged.primary_fi_clinic_id, "clinic-1");
});

test("sensitive keys are stripped from metadata snapshot", () => {
  const sanitized = sanitizeIiohrHrMetadataSnapshot({
    onboarding_status: "pending",
    training_required_count: 1,
    bank_details: { account: "secret" },
    TFN: "123",
    pay_rate: 90000,
    tax_information: "hidden",
  });

  for (const key of HR_STAFF_SENSITIVE_METADATA_KEYS) {
    assert.equal((sanitized as Record<string, unknown>)[key], undefined, `leaked sensitive key: ${key}`);
  }
  assert.equal(sanitized.onboarding_status, "pending");
  assert.equal(sanitized.training_required_count, 1);
});

test("invalid profile URLs are ignored", () => {
  const sanitized = sanitizeIiohrHrMetadataSnapshot({
    hr_profile_url: "javascript:alert(1)",
    source_url: "ftp://bad.example/profile",
    onboarding_status: "complete",
  });
  assert.equal(sanitized.hr_profile_url, undefined);

  const fromHttp = extractValidatedHrReadinessFields({
    hr_profile_url: "https://hr.example/staff/9",
  });
  assert.equal(fromHttp.hr_profile_url, "https://hr.example/staff/9");
});

test("invalid counts and dates are omitted; negative counts rejected", () => {
  const sanitized = sanitizeIiohrHrMetadataSnapshot({
    required_documents_missing_count: -3,
    training_required_count: "not-a-number",
    certificates_outstanding_count: 2.7,
    onboarding_completed_at: "not-a-date",
    onboarding_status: "pending",
  });
  assert.equal(sanitized.required_documents_missing_count, undefined);
  assert.equal(sanitized.training_required_count, undefined);
  assert.equal(sanitized.certificates_outstanding_count, 2);
  assert.equal(sanitized.onboarding_completed_at, undefined);
  assert.equal(sanitized.onboarding_status, "pending");
});

test("missing counts stay absent (unknown in UI)", () => {
  const sanitized = sanitizeIiohrHrMetadataSnapshot({
    onboarding_status: "complete",
    last_synced_at: "2026-01-01T00:00:00.000Z",
  });
  assert.equal(sanitized.required_documents_missing_count, undefined);
  assert.equal(sanitized.training_required_count, undefined);
  assert.equal(sanitized.certificates_outstanding_count, undefined);
});

test("stale sync clears after fresh last_synced_at update", () => {
  const staleAt = new Date(NOW.getTime() - (STAFF_HR_SYNC_STALE_DAYS + 1) * 86_400_000).toISOString();
  const stale = buildStaffHrNotificationSummary(
    {
      source_system: "iiohr_hr",
      metadata: { onboarding_status: "complete", last_synced_at: staleAt },
    },
    NOW
  );
  assert.equal(stale.isSyncStale, true);

  const merged = mergeHrStaffSourceMetadataOnSync(
    { onboarding_status: "complete", last_synced_at: staleAt },
    {},
    FRESH_SYNC_AT
  );
  const fresh = buildStaffHrNotificationSummary(
    { source_system: "iiohr_hr", metadata: merged },
    NOW
  );
  assert.equal(fresh.isSyncStale, false);
});

test("hr_profile_url falls back to validated source_url", () => {
  const sanitized = sanitizeIiohrHrMetadataSnapshot({}, "https://hr.example/staff/42");
  assert.equal(sanitized.hr_profile_url, "https://hr.example/staff/42");
});
