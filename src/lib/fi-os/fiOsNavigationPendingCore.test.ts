import assert from "node:assert/strict";
import test from "node:test";

import {
  FI_OS_NAV_PENDING_ATTR,
  isInternalFiOsNavigationHref,
  isModifiedNavigationClick,
  isSameFiOsRoute,
  normalizeFiOsNavPath,
  readFiOsNavIdFromAnchor,
  shouldStartFiOsNavigationPending,
} from "@/src/lib/fi-os/fiOsNavigationPendingCore";

const ORIGIN = "http://fi.local";

test("normalizeFiOsNavPath trims trailing slashes", () => {
  assert.equal(normalizeFiOsNavPath("/fi-admin/t-1/"), "/fi-admin/t-1");
  assert.equal(normalizeFiOsNavPath("/"), "/");
});

test("isInternalFiOsNavigationHref accepts tenant routes only", () => {
  assert.equal(isInternalFiOsNavigationHref("/fi-admin/t-1/calendar", ORIGIN), true);
  assert.equal(isInternalFiOsNavigationHref("https://example.com/fi-admin/t-1", "https://example.com"), true);
  assert.equal(isInternalFiOsNavigationHref("https://evil.com/fi-admin/t-1", ORIGIN), false);
  assert.equal(isInternalFiOsNavigationHref("/marketing", ORIGIN), false);
  assert.equal(isInternalFiOsNavigationHref("mailto:a@b.com", ORIGIN), false);
});

test("isModifiedNavigationClick detects modifier and non-primary clicks", () => {
  assert.equal(
    isModifiedNavigationClick({
      metaKey: false,
      ctrlKey: false,
      shiftKey: false,
      altKey: false,
      button: 0,
      defaultPrevented: false,
    }),
    false
  );
  assert.equal(
    isModifiedNavigationClick({
      metaKey: true,
      ctrlKey: false,
      shiftKey: false,
      altKey: false,
      button: 0,
      defaultPrevented: false,
    }),
    true
  );
  assert.equal(
    isModifiedNavigationClick({
      metaKey: false,
      ctrlKey: false,
      shiftKey: false,
      altKey: false,
      button: 1,
      defaultPrevented: false,
    }),
    true
  );
});

test("shouldStartFiOsNavigationPending starts for internal route changes", () => {
  const current = { pathname: "/fi-admin/t-1", search: "" };
  assert.equal(
    shouldStartFiOsNavigationPending({
      href: "/fi-admin/t-1/calendar",
      current,
      modifiedClick: false,
      origin: ORIGIN,
    }),
    true
  );
});

test("shouldStartFiOsNavigationPending ignores same route, external, blank, and modified clicks", () => {
  const current = { pathname: "/fi-admin/t-1/calendar", search: "?clinic=a" };
  assert.equal(
    shouldStartFiOsNavigationPending({
      href: "/fi-admin/t-1/calendar?clinic=a",
      current,
      modifiedClick: false,
      origin: ORIGIN,
    }),
    false
  );
  assert.equal(
    shouldStartFiOsNavigationPending({
      href: "https://example.com",
      current,
      modifiedClick: false,
      origin: ORIGIN,
    }),
    false
  );
  assert.equal(
    shouldStartFiOsNavigationPending({
      href: "/fi-admin/t-1/patients",
      current,
      target: "_blank",
      modifiedClick: false,
      origin: ORIGIN,
    }),
    false
  );
  assert.equal(
    shouldStartFiOsNavigationPending({
      href: "/fi-admin/t-1/patients",
      current,
      download: "report.csv",
      modifiedClick: false,
      origin: ORIGIN,
    }),
    false
  );
  assert.equal(
    shouldStartFiOsNavigationPending({
      href: "/fi-admin/t-1/patients",
      current,
      disabled: true,
      modifiedClick: false,
      origin: ORIGIN,
    }),
    false
  );
  assert.equal(
    shouldStartFiOsNavigationPending({
      href: "/fi-admin/t-1/patients",
      current,
      modifiedClick: true,
      origin: ORIGIN,
    }),
    false
  );
});

test("isSameFiOsRoute compares normalized pathname and search", () => {
  assert.equal(
    isSameFiOsRoute(
      { pathname: "/fi-admin/t-1/", search: "" },
      { pathname: "/fi-admin/t-1", search: "" }
    ),
    true
  );
  assert.equal(
    isSameFiOsRoute(
      { pathname: "/fi-admin/t-1", search: "?a=1" },
      { pathname: "/fi-admin/t-1", search: "" }
    ),
    false
  );
});

test("readFiOsNavIdFromAnchor reads data attribute constant", () => {
  assert.equal(
    readFiOsNavIdFromAnchor({
      getAttribute: (name) => (name === FI_OS_NAV_PENDING_ATTR ? "calendar" : null),
    }),
    "calendar"
  );
});
