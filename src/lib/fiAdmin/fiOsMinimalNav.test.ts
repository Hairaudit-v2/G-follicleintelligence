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
  it("returns six D6G-B slots: Today, Calendar, Patients, Team, Reports, More", () => {
    const sidebarItems = resolveFiOsPrimarySidebarItems(base, true, true);
    const items = resolveFiOsMinimalNavItems(base, sidebarItems);
    assert.equal(items.length, 6);
    assert.deepEqual(
      items.map((item) => item.id),
      ["today", "calendar", "patients", "team", "reports", "more"]
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

  it("disables team and reports rail when filtered from sidebar", () => {
    const sidebarWithoutTeamReports = resolveFiOsPrimarySidebarItems(base, true, true).filter(
      (item) => item.id !== "team" && item.id !== "reports"
    );
    const items = resolveFiOsMinimalNavItems(base, sidebarWithoutTeamReports);
    const team = items.find((i) => i.id === "team");
    const reports = items.find((i) => i.id === "reports");
    if (team?.kind === "link") {
      assert.equal(team.disabled, true);
      assert.match(team.hint ?? "", /not available/i);
    }
    if (reports?.kind === "link") {
      assert.equal(reports.disabled, true);
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

  it("marks team and reports routes", () => {
    assert.equal(getFiOsMinimalNavActiveId(`${base}/workforce-os`, base), "team");
    assert.equal(getFiOsMinimalNavActiveId(`${base}/analytics`, base), "reports");
  });

  it("returns null for routes grouped only under More", () => {
    assert.equal(getFiOsMinimalNavActiveId(`${base}/reception`, base), null);
    assert.equal(getFiOsMinimalNavActiveId(`${base}/surgery-os`, base), null);
  });
});