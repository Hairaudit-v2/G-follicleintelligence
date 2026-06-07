import assert from "node:assert/strict";
import { test } from "node:test";

import {
  normalizeFiStaffSourceIdKey,
  normalizeFiStaffSourceMetadata,
  normalizeFiStaffSourceStaffId,
  normalizeFiStaffSourceSystem,
  normalizeFiStaffSourceUrl,
} from "./staffSourceIdsNormalize";

test("normalizeFiStaffSourceSystem trims and lowercases", () => {
  assert.equal(normalizeFiStaffSourceSystem("  IIOHR_HR  "), "iiohr_hr");
});

test("normalizeFiStaffSourceStaffId trims only", () => {
  assert.equal(normalizeFiStaffSourceStaffId("  abc-XYZ  "), "abc-XYZ");
});

test("normalizeFiStaffSourceUrl", () => {
  assert.equal(normalizeFiStaffSourceUrl(null), null);
  assert.equal(normalizeFiStaffSourceUrl("   "), null);
  assert.equal(normalizeFiStaffSourceUrl(" https://x/y "), "https://x/y");
});

test("normalizeFiStaffSourceMetadata", () => {
  assert.deepEqual(normalizeFiStaffSourceMetadata(undefined), {});
  assert.deepEqual(normalizeFiStaffSourceMetadata([]), {});
  assert.deepEqual(normalizeFiStaffSourceMetadata({ a: 1 }), { a: 1 });
});

test("normalizeFiStaffSourceIdKey", () => {
  assert.deepEqual(
    normalizeFiStaffSourceIdKey({
      tenantId: "  t1 ",
      staffId: " s1 ",
      sourceSystem: "HR",
      sourceStaffId: " emp-42 ",
    }),
    { tenantId: "t1", staffId: "s1", sourceSystem: "hr", sourceStaffId: "emp-42" }
  );
});
