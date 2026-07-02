import assert from "node:assert/strict";
import { describe, it } from "node:test";

import {
  MANAGE_EMPLOYMENT_VISIBLE_STATUSES,
  resolveStaffLifecycleOperationalState,
} from "./staffLifecyclePresentation";

describe("staffLifecyclePresentation", () => {
  it("maps employment status and archive flag to operational lifecycle states", () => {
    assert.equal(
      resolveStaffLifecycleOperationalState({
        employment_status: "pending_onboarding",
        archived_at: null,
      }),
      "pending_onboarding"
    );
    assert.equal(
      resolveStaffLifecycleOperationalState({ employment_status: "active", archived_at: null }),
      "active"
    );
    assert.equal(
      resolveStaffLifecycleOperationalState({ employment_status: "on_leave", archived_at: null }),
      "temporarily_unavailable"
    );
    assert.equal(
      resolveStaffLifecycleOperationalState({
        employment_status: "terminated",
        archived_at: null,
      }),
      "departed"
    );
    assert.equal(
      resolveStaffLifecycleOperationalState({
        employment_status: "active",
        archived_at: "2026-01-01T00:00:00.000Z",
      }),
      "archived"
    );
  });

  it("excludes merged and contract_expired from manage employment dropdown", () => {
    const visible = MANAGE_EMPLOYMENT_VISIBLE_STATUSES as readonly string[];
    assert.ok(!visible.includes("merged"));
    assert.ok(!visible.includes("contract_expired"));
    assert.ok(!visible.includes("terminated"));
    assert.ok(visible.includes("on_leave"));
  });
});
