import assert from "node:assert/strict";
import { test } from "node:test";

import { ACADEMY_EVENTS } from "@/src/lib/analytics-os/analyticsEventTypes";

test("ACADEMY_EVENTS includes competency lifecycle events", () => {
  assert.deepEqual([...ACADEMY_EVENTS], [
    "competency_verified",
    "competency_expired",
    "competency_restricted",
    "certification_verified",
  ]);
});
