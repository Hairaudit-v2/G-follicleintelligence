import assert from "node:assert/strict";
import { describe, it } from "node:test";

import {
  d6gCanAccessFinance,
  d6gMoreVisibility,
  FI_OS_D6G_MORE_MENU_VISIBILITY,
  FI_OS_D6G_PRIMARY_RAIL_ITEMS,
  FI_OS_D6G_PRIMARY_RAIL_VISIBILITY,
  FI_OS_D6G_VISIBILITY_ROLES,
  formatD6gRoleVisibilityMatrixMarkdown,
} from "@/src/lib/fiOs/navigation/fiOsD6gRoleVisibilityMatrix";

describe("FI OS D6G role visibility matrix", () => {
  it("primary rail has the same six items for every role", () => {
    assert.deepEqual([...FI_OS_D6G_PRIMARY_RAIL_ITEMS], [
      "Today",
      "Calendar",
      "Patients",
      "Team",
      "Reports",
      "More",
    ]);
    for (const role of FI_OS_D6G_VISIBILITY_ROLES) {
      for (const item of FI_OS_D6G_PRIMARY_RAIL_ITEMS) {
        assert.equal(FI_OS_D6G_PRIMARY_RAIL_VISIBILITY[role][item], "yes", `${role}.${item}`);
      }
    }
  });

  it("Front Desk can access Finance / Money; clinical and surgery cannot", () => {
    assert.equal(d6gCanAccessFinance("front_desk"), true);
    assert.equal(d6gMoreVisibility("front_desk", "finance"), "yes");
    assert.equal(d6gCanAccessFinance("manager"), true);
    assert.equal(d6gCanAccessFinance("admin"), true);
    assert.equal(d6gCanAccessFinance("consultant"), false);
    assert.equal(d6gCanAccessFinance("clinical"), false);
    assert.equal(d6gCanAccessFinance("surgery"), false);
    assert.equal(d6gMoreVisibility("auditor", "finance"), "no");
  });

  it("Front Desk keeps pipeline and front desk; no admin intelligence", () => {
    const row = FI_OS_D6G_MORE_MENU_VISIBILITY.front_desk;
    assert.equal(row.pipeline, "yes");
    assert.equal(row.front_desk, "yes");
    assert.equal(row.inbox, "yes");
    assert.equal(row.admin_intelligence, "no");
    assert.equal(row.surgery, "no");
  });

  it("exports markdown matrix for docs", () => {
    const md = formatD6gRoleVisibilityMatrixMarkdown();
    assert.match(md, /Primary Rail/);
    assert.match(md, /Finance \/ Money/);
    assert.match(md, /Front Desk/);
  });
});
