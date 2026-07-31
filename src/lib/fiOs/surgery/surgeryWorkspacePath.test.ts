import assert from "node:assert/strict";
import test from "node:test";

import {
  FI_OS_SURGERY_TABS,
  buildFiOsSurgeryBase,
  buildFiOsSurgeryTabHref,
  buildFiOsSurgeryTenantBase,
  isSurgeryTabActive,
  resolveSurgeryTabFromPath,
} from "@/src/lib/fiOs/surgery/surgeryWorkspaceCore";

const TENANT = "cccccccc-cccc-4ccc-8ccc-cccccccccccc";
const OTHER = "dddddddd-dddd-4ddd-8ddd-dddddddddddd";

test("every surgery tab builds a tenant-scoped href under /surgery", () => {
  const base = buildFiOsSurgeryBase(TENANT);
  assert.equal(base, `/fi-admin/${TENANT}/surgery`);
  for (const tab of FI_OS_SURGERY_TABS) {
    const href = buildFiOsSurgeryTabHref(TENANT, tab);
    assert.ok(href.startsWith(base), href);
    assert.ok(!href.includes("//"));
    assert.ok(href.includes(TENANT));
  }
});

test("resolveSurgeryTabFromPath maps overview, cases, procedure-day, review", () => {
  const tenantBase = buildFiOsSurgeryTenantBase(TENANT);
  assert.equal(resolveSurgeryTabFromPath(`/fi-admin/${TENANT}/surgery`, tenantBase), "command");
  assert.equal(resolveSurgeryTabFromPath(`/fi-admin/${TENANT}/surgery/`, tenantBase), "command");
  assert.equal(
    resolveSurgeryTabFromPath(`/fi-admin/${TENANT}/surgery/cases`, tenantBase),
    "cases"
  );
  assert.equal(
    resolveSurgeryTabFromPath(`/fi-admin/${TENANT}/surgery/cases?page=2`, tenantBase),
    "cases"
  );
  assert.equal(
    resolveSurgeryTabFromPath(`/fi-admin/${TENANT}/surgery/procedure-day/`, tenantBase),
    "procedure-day"
  );
  assert.equal(
    resolveSurgeryTabFromPath(`/fi-admin/${TENANT}/surgery/review/nested`, tenantBase),
    "review"
  );
  assert.equal(
    resolveSurgeryTabFromPath(`/fi-admin/${TENANT}/surgery/unknown-segment`, tenantBase),
    null
  );
  assert.equal(resolveSurgeryTabFromPath(`/fi-admin/${TENANT}/surgery-os`, tenantBase), null);
  assert.equal(resolveSurgeryTabFromPath(`/fi-admin/${TENANT}/cases`, tenantBase), null);
});

test("tenant isolation: other tenant paths do not resolve", () => {
  const tenantBase = buildFiOsSurgeryTenantBase(TENANT);
  assert.equal(
    resolveSurgeryTabFromPath(`/fi-admin/${OTHER}/surgery/cases`, tenantBase),
    null
  );
});

test("tab active-state excludes siblings and tolerates query strings", () => {
  const tenantBase = buildFiOsSurgeryTenantBase(TENANT);
  for (const tab of FI_OS_SURGERY_TABS) {
    const href = buildFiOsSurgeryTabHref(TENANT, tab);
    assert.equal(isSurgeryTabActive(`${href}?x=1`, tenantBase, tab.segment), true, tab.id);
    for (const other of FI_OS_SURGERY_TABS) {
      if (other.id === tab.id) continue;
      assert.equal(
        isSurgeryTabActive(href, tenantBase, other.segment),
        false,
        `${other.id} vs ${tab.id}`
      );
    }
  }
});
