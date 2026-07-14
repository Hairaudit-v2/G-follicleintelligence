import assert from "node:assert/strict";
import test from "node:test";

import {
  isInternalAppNavigationHref,
  isSameRoute,
  normalizeRoutePath,
  routeProgressClearDelayMs,
  shouldHardNavigateSoftNavFallback,
  shouldStartRouteProgress,
} from "./routeProgressCore";

const ORIGIN = "https://example.com";

test("normalizeRoutePath trims trailing slashes", () => {
  assert.equal(normalizeRoutePath("/platform/"), "/platform");
  assert.equal(normalizeRoutePath("/"), "/");
});

test("isInternalAppNavigationHref accepts same-origin and root-relative", () => {
  assert.equal(isInternalAppNavigationHref("/platform", ORIGIN), true);
  assert.equal(isInternalAppNavigationHref("/fi-admin/t1", ORIGIN), true);
  assert.equal(isInternalAppNavigationHref("https://example.com/about", ORIGIN), true);
  assert.equal(isInternalAppNavigationHref("https://evil.com/x", ORIGIN), false);
  assert.equal(isInternalAppNavigationHref("mailto:a@b.com", ORIGIN), false);
  assert.equal(isInternalAppNavigationHref("#section", ORIGIN), false);
});

test("shouldStartRouteProgress starts for internal route changes", () => {
  assert.equal(
    shouldStartRouteProgress({
      href: "/platform",
      current: { pathname: "/", search: "" },
      modifiedClick: false,
      origin: ORIGIN,
    }),
    true
  );
});

test("shouldStartRouteProgress ignores same route and modified clicks", () => {
  assert.equal(
    shouldStartRouteProgress({
      href: "/platform",
      current: { pathname: "/platform", search: "" },
      modifiedClick: false,
      origin: ORIGIN,
    }),
    false
  );
  assert.equal(
    shouldStartRouteProgress({
      href: "/platform",
      current: { pathname: "/", search: "" },
      modifiedClick: true,
      origin: ORIGIN,
    }),
    false
  );
});

test("isSameRoute ignores trailing slash differences", () => {
  assert.equal(
    isSameRoute({ pathname: "/a/", search: "" }, { pathname: "/a", search: "" }),
    true
  );
});

test("routeProgressClearDelayMs enforces minimum visible time", () => {
  assert.equal(routeProgressClearDelayMs(1000, 1100, 350), 250);
  assert.equal(routeProgressClearDelayMs(1000, 1400, 350), 0);
  assert.equal(routeProgressClearDelayMs(0, 2000, 350), 0);
});

test("shouldHardNavigateSoftNavFallback recovers stuck soft nav", () => {
  assert.equal(
    shouldHardNavigateSoftNavFallback({
      intendedPathname: "/fi-admin/t1/front-desk",
      currentPathname: "/fi-admin/t1/crm",
      startedAtMs: 1000,
      nowMs: 3500,
      fallbackMs: 2000,
    }),
    true
  );
  assert.equal(
    shouldHardNavigateSoftNavFallback({
      intendedPathname: "/fi-admin/t1/front-desk",
      currentPathname: "/fi-admin/t1/crm",
      startedAtMs: 1000,
      nowMs: 2500,
      fallbackMs: 2000,
    }),
    false
  );
  assert.equal(
    shouldHardNavigateSoftNavFallback({
      intendedPathname: "/fi-admin/t1/front-desk/",
      currentPathname: "/fi-admin/t1/front-desk",
      startedAtMs: 1000,
      nowMs: 5000,
      fallbackMs: 2000,
    }),
    false
  );
});
