import assert from "node:assert/strict";
import { test } from "node:test";

import { buildWorkforceIdentitySummaryFromSourceRows } from "./workforceIdentitySummary";
import { WORKFORCE_IDENTITY_SOURCE_SYSTEMS } from "./workforceIdentitySources";

const NOW = new Date("2026-06-09T12:00:00.000Z");

test("summary detects HR, Academy, and Nexus links", () => {
  const summary = buildWorkforceIdentitySummaryFromSourceRows(
    [
      {
        source_system: "iiohr_hr",
        source_staff_id: "ext-1",
        metadata: { last_synced_at: NOW.toISOString(), sync_status: "active" },
      },
      {
        source_system: "iiohr_academy",
        source_staff_id: "academy-1",
        metadata: {
          last_synced_at: NOW.toISOString(),
          training_source: "iiohr_academy",
          certification_source: "iiohr_academy",
        },
      },
      {
        source_system: "iiohr_nexus",
        source_staff_id: "iiohr:prof:001",
        metadata: {
          global_professional_id: "iiohr:prof:001",
          last_synced_at: NOW.toISOString(),
          sync_status: "active",
        },
      },
    ],
    NOW
  );

  assert.equal(summary.hr.linked, true);
  assert.equal(summary.academy.linked, true);
  assert.equal(summary.nexus.linked, true);
  assert.equal(summary.linkedIdentityCount, 3);
  assert.equal(summary.hasStaleIdentitySync, false);
});

test("backward compatible with legacy hr source_system alias on read", () => {
  const summary = buildWorkforceIdentitySummaryFromSourceRows(
    [
      {
        source_system: "hr",
        source_staff_id: "legacy-1",
        metadata: { last_synced_at: NOW.toISOString() },
      },
    ],
    NOW
  );
  assert.equal(summary.hr.linked, true);
  assert.equal(summary.hr.sourceSystem, WORKFORCE_IDENTITY_SOURCE_SYSTEMS.IIOHR_HR);
});
