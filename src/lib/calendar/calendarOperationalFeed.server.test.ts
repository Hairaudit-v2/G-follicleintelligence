import assert from "node:assert/strict";
import { describe, it } from "node:test";

import { assertNonEmptyUuid } from "@/src/lib/crm/validation";

describe("calendarOperationalFeed tenant isolation contract", () => {
  it("rejects empty tenant id before any loader work", () => {
    assert.throws(() => assertNonEmptyUuid("", "tenantId"), /tenantId/);
  });

  it("requires valid uuid shape for tenant scoped reads", () => {
    assert.throws(() => assertNonEmptyUuid("not-a-uuid", "tenantId"));
    assert.doesNotThrow(() =>
      assertNonEmptyUuid("aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa", "tenantId")
    );
  });
});