import assert from "node:assert/strict";
import { test } from "node:test";

import {
  buildBoundedMetadataSnapshotV1,
  buildHrReadinessMetadataSnapshot,
  listSensitiveHrFieldKeys,
  mapIiohrHrStaffToFiSyncRow,
  type IiohrHrPortalStaffRecord,
} from "@/src/lib/hr/iiohrFiStaffSyncMapper";
import { HR_STAFF_READINESS_METADATA_KEYS } from "@/src/lib/staff/hrStaffReadinessMetadata";

const METADATA_V1_KEYS = new Set([
  "schema_version",
  "employment_type",
  "clinic_name",
  "role_label",
  "compliance_summary",
  "training_summary",
  "last_hr_updated_at",
  ...HR_STAFF_READINESS_METADATA_KEYS,
]);

test("mapper excludes sensitive HR fields from the FI sync row payload", () => {
  const record: IiohrHrPortalStaffRecord = {
    external_staff_id: "E-1",
    full_name: "Test User",
    email: "t@example.com",
    contracts: [{ id: "c1" }],
    offer_letters: ["x"],
    hr_letters: ["y"],
    identity_documents: { passport: "secret" },
    bank_details: { bsb: "000-000" },
    super_details: { fund: "X" },
    tax_details: { tfn: "xxx" },
    private_notes: "do not leak",
  };
  const row = mapIiohrHrStaffToFiSyncRow(record);
  const serialized = JSON.stringify(row);
  for (const k of listSensitiveHrFieldKeys()) {
    assert.ok(!serialized.includes(`"${k}"`), `unexpected sensitive key in payload: ${k}`);
  }
});

test("metadata_snapshot is schema v1 and bounded to the allowlisted keys", () => {
  const record: IiohrHrPortalStaffRecord = {
    external_staff_id: "E-2",
    full_name: "Meta Test",
    employment_type: "full_time",
    clinic_name: "Perth",
    role_label: "Nurse",
    compliance_summary: "ok",
    training_summary: "CPR current",
    last_hr_updated_at: "2026-01-01T00:00:00.000Z",
  };
  const snap = buildBoundedMetadataSnapshotV1(record);
  assert.equal(snap.schema_version, 1);
  const keys = Object.keys(snap);
  assert.ok(keys.length <= METADATA_V1_KEYS.size);
  for (const k of keys) {
    assert.ok(METADATA_V1_KEYS.has(k), `unexpected metadata key: ${k}`);
  }
  const row = mapIiohrHrStaffToFiSyncRow(record);
  const ms = row.metadata_snapshot;
  assert.ok(ms && typeof ms === "object");
  for (const k of Object.keys(ms)) {
    assert.ok(METADATA_V1_KEYS.has(k), `row.metadata_snapshot leaked key: ${k}`);
  }
});

test("mapper truncates long summary strings in metadata_snapshot", () => {
  const long = "a".repeat(5000);
  const record: IiohrHrPortalStaffRecord = {
    external_staff_id: "E-3",
    full_name: "Long",
    training_summary: long,
  };
  const snap = buildBoundedMetadataSnapshotV1(record);
  assert.ok(snap.training_summary != null);
  assert.ok(snap.training_summary.length <= 2000, "training_summary should be truncated");
});

test("mapper includes validated HR readiness metadata in metadata_snapshot", () => {
  const record: IiohrHrPortalStaffRecord = {
    external_staff_id: "E-4",
    full_name: "Ready",
    onboarding_status: "pending",
    onboarding_completed_at: "2026-05-01T00:00:00.000Z",
    required_documents_missing_count: 1,
    training_required_count: 2,
    certificates_outstanding_count: 0,
    source_url: "https://hr.example/staff/E-4",
    hr_profile_url: "javascript:evil()",
    bank_details: { bsb: "000" },
  };
  const readiness = buildHrReadinessMetadataSnapshot(record);
  assert.equal(readiness.onboarding_status, "pending");
  assert.equal(readiness.training_required_count, 2);
  assert.equal(readiness.hr_profile_url, "https://hr.example/staff/E-4");
  assert.equal((readiness as Record<string, unknown>).bank_details, undefined);

  const row = mapIiohrHrStaffToFiSyncRow(record);
  assert.equal(row.metadata_snapshot?.onboarding_status, "pending");
  assert.equal(row.metadata_snapshot?.required_documents_missing_count, 1);
});
