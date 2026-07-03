import assert from "node:assert/strict";
import test from "node:test";

import {
  fiOsCalDesktopOnly,
  fiOsCalFloatingAssistScrollPad,
  fiOsCalTabletChipScroll,
  fiOsCalTabletGridMinHeight,
  fiOsCalTabletOnly,
  isFiOsCalendarTabletCompactWidth,
} from "@/src/lib/calendar/fiOsCalendarResponsive";

test("fiOsCalendarResponsive: tablet compact band uses xl breakpoint", () => {
  assert.equal(fiOsCalDesktopOnly, "hidden xl:block");
  assert.equal(fiOsCalTabletOnly, "xl:hidden");
});

test("fiOsCalendarResponsive: chip scroll and grid min-height include dvh and safe-area", () => {
  assert.ok(fiOsCalTabletChipScroll.includes("overflow-x-auto"));
  assert.ok(fiOsCalTabletGridMinHeight.includes("100dvh"));
  assert.ok(fiOsCalFloatingAssistScrollPad.includes("safe-area-inset-bottom"));
});

test("isFiOsCalendarTabletCompactWidth: 768–1279px inclusive lower bound", () => {
  assert.equal(isFiOsCalendarTabletCompactWidth(767), false);
  assert.equal(isFiOsCalendarTabletCompactWidth(768), true);
  assert.equal(isFiOsCalendarTabletCompactWidth(1024), true);
  assert.equal(isFiOsCalendarTabletCompactWidth(1279), true);
  assert.equal(isFiOsCalendarTabletCompactWidth(1280), false);
});
