import assert from "node:assert/strict";
import test from "node:test";

import {
  buildHrProjectionHealth,
  countMissingStaffProjections,
  countStaleStaffProjections,
} from "./projectionHealthCore";

test("countMissingStaffProjections counts fi_staff without member projection", () => {
  assert.equal(
    countMissingStaffProjections({
      fiStaffIds: ["a", "b", "c"],
      linkedFiStaffIds: ["a", "c"],
    }),
    1
  );
});

test("countStaleStaffProjections counts projections older than fi_staff", () => {
  assert.equal(
    countStaleStaffProjections({
      fiStaffUpdatedAtById: {
        s1: "2026-07-04T12:00:00.000Z",
        s2: "2026-07-04T10:00:00.000Z",
      },
      memberRows: [
        { fi_staff_id: "s1", updated_at: "2026-07-04T11:00:00.000Z" },
        { fi_staff_id: "s2", updated_at: "2026-07-04T11:00:00.000Z" },
      ],
    }),
    1
  );
});

test("buildHrProjectionHealth marks needsRepair when missing or stale", () => {
  const healthy = buildHrProjectionHealth({
    operationalFiStaffCount: 3,
    linkedProjectionCount: 3,
    missingProjectionCount: 0,
    staleProjectionCount: 0,
  });
  assert.equal(healthy.needsRepair, false);

  const unhealthy = buildHrProjectionHealth({
    operationalFiStaffCount: 3,
    linkedProjectionCount: 2,
    missingProjectionCount: 1,
    staleProjectionCount: 0,
  });
  assert.equal(unhealthy.needsRepair, true);
});
