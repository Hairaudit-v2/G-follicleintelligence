import assert from "node:assert/strict";
import { test } from "node:test";

import {
  buildHrReconciliationFeedBlockedMessage,
  mapIiohrPortalStaffToEvolvedStaffRecords,
  resolveEvolvedStaffRecordId,
} from "./hrReconciliationCandidateCore";

test("resolveEvolvedStaffRecordId prefers iiohr_user_id UUID", () => {
  assert.equal(
    resolveEvolvedStaffRecordId({
      external_staff_id: "HR-001",
      iiohr_user_id: "00000000-0000-4000-8000-000000000101",
    }),
    "00000000-0000-4000-8000-000000000101"
  );
});

test("mapIiohrPortalStaffToEvolvedStaffRecords skips non-uuid external ids", () => {
  const mapped = mapIiohrPortalStaffToEvolvedStaffRecords([
    {
      external_staff_id: "HR-001",
      full_name: "No UUID Staff",
      email: "no-uuid@example.com",
    },
    {
      external_staff_id: "00000000-0000-4000-8000-000000000201",
      full_name: "UUID Staff",
      email: "uuid@example.com",
    },
  ]);

  assert.equal(mapped.records.length, 1);
  assert.equal(mapped.skippedNonUuidCount, 1);
  assert.equal(mapped.records[0]?.email, "uuid@example.com");
});

test("buildHrReconciliationFeedBlockedMessage for not configured", () => {
  const message = buildHrReconciliationFeedBlockedMessage("not_configured", null);
  assert.ok(message?.includes("IIOHR_HR_PERTH_STAFF_FEED_URL"));
});
