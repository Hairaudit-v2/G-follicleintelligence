import assert from "node:assert/strict";
import { test } from "node:test";

import { ACADEMY_EVENTS } from "@/src/lib/analytics-os/analyticsEventTypes";

test("ACADEMY_EVENTS includes competency lifecycle events", () => {
  assert.ok(ACADEMY_EVENTS.includes("competency_verified"));
  assert.ok(ACADEMY_EVENTS.includes("competency_expired"));
  assert.ok(ACADEMY_EVENTS.includes("competency_restricted"));
  assert.ok(ACADEMY_EVENTS.includes("certification_verified"));
  assert.ok(ACADEMY_EVENTS.includes("procedure_privilege_granted"));
  assert.ok(ACADEMY_EVENTS.includes("privilege_requirement_missing"));
});
