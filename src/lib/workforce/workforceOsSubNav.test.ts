import assert from "node:assert/strict";
import { describe, it } from "node:test";

import {
  buildWorkforceOsNavItems,
  isWorkforceOsNavActive,
} from "@/src/components/fi/workforce/WorkforceOsSubNav";

describe("WorkforceOsSubNav", () => {
  const tenantId = "tenant-1";
  const base = `/fi-admin/${tenantId}/workforce-os`;

  it("buildWorkforceOsNavItems includes command centre and phase 2 modules", () => {
    const items = buildWorkforceOsNavItems(tenantId);
    assert.ok(items.some((i) => i.segment === ""));
    assert.ok(items.some((i) => i.segment === "planning"));
    assert.ok(items.some((i) => i.segment === "members"));
    assert.equal(items.length, 8);
  });

  it("isWorkforceOsNavActive matches command centre exactly", () => {
    assert.equal(isWorkforceOsNavActive(base, base, ""), true);
    assert.equal(isWorkforceOsNavActive(`${base}/`, base, ""), true);
    assert.equal(isWorkforceOsNavActive(`${base}/planning`, base, ""), false);
  });

  it("isWorkforceOsNavActive highlights members for directory and staff profile", () => {
    assert.equal(isWorkforceOsNavActive(`${base}/directory`, base, "members"), true);
    assert.equal(
      isWorkforceOsNavActive(`${base}/staff/abc-123`, base, "members"),
      true
    );
    assert.equal(isWorkforceOsNavActive(`${base}/recruitment`, base, "members"), false);
  });
});