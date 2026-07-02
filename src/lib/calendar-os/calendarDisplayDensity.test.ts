import assert from "node:assert/strict";
import { describe, it } from "node:test";

import {
  calendarOsDayGridTemplate,
  calendarOsDensityTokens,
  calendarOsWeekGridTemplate,
  isCalendarOsDisplayDensity,
  normalizeCalendarOsDisplayDensity,
} from "./calendarDisplayDensity";

describe("calendarDisplayDensity", () => {
  it("normalizes unknown density to comfortable", () => {
    assert.equal(normalizeCalendarOsDisplayDensity("nope"), "comfortable");
    assert.equal(normalizeCalendarOsDisplayDensity("compact"), "compact");
    assert.equal(normalizeCalendarOsDisplayDensity("command"), "command");
  });

  it("command mode is denser than comfortable", () => {
    const comfy = calendarOsDensityTokens("comfortable");
    const cmd = calendarOsDensityTokens("command");
    assert.ok(cmd.weekRowMinHeight < comfy.weekRowMinHeight);
    assert.ok(cmd.dayPxPerHour < comfy.dayPxPerHour);
    assert.ok(cmd.weekResourceLabelWidth < comfy.weekResourceLabelWidth);
  });

  it("builds grid templates", () => {
    assert.match(calendarOsWeekGridTemplate("compact", 7), /^152px repeat\(7,/);
    assert.match(calendarOsDayGridTemplate("command", 4), /^40px repeat\(4,/);
  });

  it("validates density ids", () => {
    assert.equal(isCalendarOsDisplayDensity("compact"), true);
    assert.equal(isCalendarOsDisplayDensity("dense"), false);
  });
});
