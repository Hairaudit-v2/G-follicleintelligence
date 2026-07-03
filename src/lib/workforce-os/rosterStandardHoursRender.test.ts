import assert from "node:assert/strict";
import { test } from "node:test";

import {
  computeStandardHoursWeeklyTotal,
  formatStandardHoursWeeklyTotal,
} from "@/src/lib/workforce-os/staffStandardHoursCore";

test("weekly total helpers tolerate undefined standard hours rows", () => {
  assert.equal(computeStandardHoursWeeklyTotal(undefined), 0);
  assert.equal(formatStandardHoursWeeklyTotal(undefined), "0.0");
});
