import assert from "node:assert/strict";
import { describe, it } from "node:test";

import {
  getFiOsMinimalNavActiveId,
  primaryRailSlotIds,
  resolveFiOsMinimalNavItems,
} from "@/src/lib/fiAdmin/fiOsMinimalNav";
import { resolveFiOsPrimarySidebarItems } from "@/src/lib/fiAdmin/fiOsShellPrimaryNav";

const base = "/fi-admin/t-1";

describe("resolveFiOsMinimalNavItems", () => {
  it("returns six slots: Today, Calendar, Patients, Front desk, Team, More", () => {
    const sidebarItems = resolveFiOsPrimarySidebarItems(base, true, true);
    const items = resolveFiOsMinimalNavItems(base, sidebarItems);
    assert.equal(items.length, 6);
    assert.deepEqual(
      items.map((item) => item.id),
      ["today", "calendar", "patients", "front-desk", "team", "more"]
    );
    assert.equal(primaryRailSlotIds().length, 6);
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
      assert.equal(minimalCalendar.href, `${base}/calendar`);
    }
  });

  it("disables front desk and team rail when filtered from sidebar", () => {
    const sidebarWithout = resolveFiOsPrimarySidebarItems(base, true, true).filter(
      (item) => item.id !== "team" && item.id !== "front-desk"
    );
    const items = resolveFiOsMinimalNavItems(base, sidebarWithout);
    const team = items.find((i) => i.id === "team");
    const front = items.find((i) => i.id === "front-desk");
    if (team?.kind === "link") {
      assert.equal(team.disabled, true);
      assert.match(team.hint ?? "", /not available/i);
    }
    if (front?.kind === "link") {
      assert.equal(front.disabled, true);
    }
  });

  it("links Front desk to /front-desk", () => {
    const sidebarItems = resolveFiOsPrimarySidebarItems(base, true, true);
    const front = resolveFiOsMinimalNavItems(base, sidebarItems).find((i) => i.id === "front-desk");
    assert.equal(front?.kind, "link");
    if (front?.kind === "link") {
      assert.equal(front.href, `${base}/front-desk`);
      assert.equal(front.label, "Front desk");
      assert.equal(front.disabled, false);
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

  it("marks front desk and team routes", () => {
    assert.equal(getFiOsMinimalNavActiveId(`${base}/front-desk`, base), "front-desk");
    assert.equal(getFiOsMinimalNavActiveId(`${base}/front-desk/tomorrow`, base), "front-desk");
    assert.equal(getFiOsMinimalNavActiveId(`${base}/workforce-os`, base), "team");
  });

  it("returns null for routes grouped only under More (reports, surgery)", () => {
    assert.equal(getFiOsMinimalNavActiveId(`${base}/reports`, base), null);
    assert.equal(getFiOsMinimalNavActiveId(`${base}/analytics`, base), null);
    assert.equal(getFiOsMinimalNavActiveId(`${base}/surgery-os`, base), null);
  });
});
