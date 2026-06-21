import assert from "node:assert/strict";
import { test } from "node:test";

import { buildWorkforceIdentityReadinessSignals } from "./workforceIdentityReadinessSignals";

const NOW = new Date("2026-06-09T12:00:00.000Z");

test("readiness signals expose identity boundary without changing HR state machine", () => {
  const signals = buildWorkforceIdentityReadinessSignals(
    [
      {
        source_system: "iiohr_hr",
        source_staff_id: "hr-1",
        metadata: {
          last_synced_at: NOW.toISOString(),
          training_source: "iiohr_hr",
          certification_source: "iiohr_hr",
        },
      },
    ],
    NOW
  );

  assert.equal(signals.hasHrIdentityLink, true);
  assert.equal(signals.hasAcademyIdentityLink, false);
  assert.equal(signals.hasNexusIdentityLink, false);
  assert.equal(signals.trainingSource, "iiohr_hr");
  assert.equal(signals.isHrSyncStale, false);
});

test("detects missing global professional identity", () => {
  const signals = buildWorkforceIdentityReadinessSignals([], NOW);
  assert.equal(signals.globalProfessionalId, null);
  assert.equal(signals.hasNexusIdentityLink, false);
});
