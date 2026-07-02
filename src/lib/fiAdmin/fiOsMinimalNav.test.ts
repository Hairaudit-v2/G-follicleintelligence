import assert from "node:assert/strict";
import { describe, it } from "node:test";

import { resolveFiOsMinimalNavItems, getFiOsMinimalNavActiveId } from "@/src/lib/fiAdmin/fiOsMinimalNav";
import { resolveFiOsPrimarySidebarItems } from "@/src/lib/fiAdmin/fiOsShellPrimaryNav";

const base = "/fi-admin/t-1";

describe("resolveFiOsMinimalNavItems", () => {
  it("returns Today, Calendar, Search, New, More in order", () => {
    const sidebarItems = resolveFiOsPrimarySidebarItems(base, true, true);
    const items = resolveFiOsMinimalNavItems(base, sidebarItems);
    assert.deepEqual(
      items.map((item) => item.id),
      ["today", "calendar", "search", "new", "more"]
    );
  });

  it("inherits calendar disabled state from primary sidebar items", () => {
    const sidebarItems = resolveFiOsPrimarySidebarItems(base, false, false, "finance_admin");
    const calendar = sidebarItems.find((item) => item.id === "calendar");
    const minimalCalendar = resolveFiOsMinimalNavItems(base, sidebarItems).find(
      (item) => item.id === "calendar"
    );
    assert.equal(minimalCalendar?.kind, "link");
    if (minimalCalendar?.kind === "link") {
      assert.equal(minimalCalendar.disabled, calendar?.disabled);
      assert.equal(minimalCalendar.hint, calendar?.hint);
    }
  });
});

describe("getFiOsMinimalNavActiveId", () => {
  it("marks tenant home as today", () => {
    assert.equal(getFiOsMinimalNavActiveId(base, base), "today");
    assert.equal(getFiOsMinimalNavActiveId(`${base}/`, base), "today");
  });

  it("marks calendar routes as calendar", () => {
    assert.equal(getFiOsMinimalNavActiveId(`${base}/calendar`, base), "calendar");
    assert.equal(getFiOsMinimalNavActiveId(`${base}/calendar/week`, base), "calendar");
  });

  it("returns null for non-minimal routes", () => {
    assert.equal(getFiOsMinimalNavActiveId(`${base}/reception`, base), null);
  });
});
