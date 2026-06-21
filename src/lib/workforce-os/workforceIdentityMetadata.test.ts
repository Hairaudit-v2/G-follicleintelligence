import assert from "node:assert/strict";
import { test } from "node:test";

import { STAFF_SENSITIVE_METADATA_KEYS } from "@/src/lib/staff/staffSensitiveMetadataKeys";
import {
  mergeWorkforceIdentityMetadata,
  sanitizeWorkforceIdentityMetadata,
} from "./workforceIdentityMetadata";

test("metadata allowlist merge keeps bounded identity keys", () => {
  const merged = mergeWorkforceIdentityMetadata(
    { primary_fi_clinic_id: "clinic-1" },
    {
      iiohr_user_id: "user-9",
      iiohr_hr_profile_id: "hr-42",
      global_professional_id: "iiohr:prof:001",
      certification_source: "iiohr_hr",
      training_source: "iiohr_hr",
      sync_status: "active",
      last_synced_at: "2026-06-09T12:00:00.000Z",
    }
  );

  assert.equal(merged.iiohr_user_id, "user-9");
  assert.equal(merged.iiohr_hr_profile_id, "hr-42");
  assert.equal(merged.global_professional_id, "iiohr:prof:001");
  assert.equal(merged.training_source, "iiohr_hr");
  assert.equal(merged.certification_source, "iiohr_hr");
  assert.equal(merged.sync_status, "active");
  assert.equal(merged.primary_fi_clinic_id, "clinic-1");
});

test("sensitive keys are stripped from workforce identity metadata", () => {
  const sanitized = sanitizeWorkforceIdentityMetadata({
    iiohr_user_id: "u1",
    bank_details: { account: "secret" },
    tfn: "123",
  });

  for (const key of STAFF_SENSITIVE_METADATA_KEYS) {
    assert.equal((sanitized as Record<string, unknown>)[key], undefined);
  }
  assert.equal(sanitized.iiohr_user_id, "u1");
});

test("invalid sync_status is omitted", () => {
  const sanitized = sanitizeWorkforceIdentityMetadata({ sync_status: "not-a-status" });
  assert.equal(sanitized.sync_status, undefined);
});
