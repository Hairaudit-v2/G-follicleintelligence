import assert from "node:assert/strict";
import { test } from "node:test";

import {
  buildWorkforceIdentitySummaryFromSourceRows,
  type WorkforceIdentitySourceRowInput,
} from "./workforceIdentitySummary";
import { buildWorkforceIdentityReadinessSignals } from "./workforceIdentityReadinessSignals";

test("summary and readiness signals work without server-only imports", () => {
  const rows: WorkforceIdentitySourceRowInput[] = [
    {
      source_system: "iiohr_hr",
      source_staff_id: "ext-1",
      metadata: { last_synced_at: "2026-06-09T12:00:00.000Z", sync_status: "active" },
    },
  ];
  const summary = buildWorkforceIdentitySummaryFromSourceRows(rows, new Date("2026-06-09T12:00:00.000Z"));
  const signals = buildWorkforceIdentityReadinessSignals(rows, new Date("2026-06-09T12:00:00.000Z"));
  assert.equal(summary.hr.linked, true);
  assert.equal(signals.hasHrIdentityLink, true);
});
