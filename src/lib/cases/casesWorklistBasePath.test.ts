import assert from "node:assert/strict";
import test from "node:test";

import {
  casesWorklistHref,
  defaultCasesWorklistBasePath,
  parseCasesIndexQuery,
  surgeryCasesWorklistBasePath,
} from "@/src/lib/cases/casesIndexFilters";

const TENANT = "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa";

test("legacy cases worklist href stays under /cases by default", () => {
  const q = parseCasesIndexQuery({ readiness: "needs_attention", page: "2" });
  const href = casesWorklistHref(TENANT, q);
  assert.equal(defaultCasesWorklistBasePath(TENANT), `/fi-admin/${TENANT}/cases`);
  assert.ok(href.startsWith(`/fi-admin/${TENANT}/cases?`));
  assert.ok(href.includes("readiness=needs_attention"));
  assert.ok(href.includes("page=2"));
  assert.ok(!href.includes("/surgery/cases"));
});

test("surgery cases worklist href stays under /surgery/cases", () => {
  const q = parseCasesIndexQuery({ status: "active", q: "smith" });
  const base = surgeryCasesWorklistBasePath(TENANT);
  assert.equal(base, `/fi-admin/${TENANT}/surgery/cases`);
  const href = casesWorklistHref(TENANT, q, { page: 3 }, base);
  assert.ok(href.startsWith(`${base}?`));
  assert.ok(href.includes("q=smith"));
  assert.ok(href.includes("status=active"));
  assert.ok(href.includes("page=3"));
  assert.ok(!href.includes(`/fi-admin/${TENANT}/cases?`));
});

test("filter patches preserve query params on surgery base path", () => {
  const q = parseCasesIndexQuery({ readiness: "in_progress", sort: "procedure_date_desc" });
  const base = surgeryCasesWorklistBasePath(TENANT);
  const next = casesWorklistHref(TENANT, q, { pageSize: 25, page: 1 }, base);
  assert.ok(next.startsWith(base));
  assert.ok(next.includes("readiness=in_progress"));
  assert.ok(next.includes("sort=procedure_date_desc"));
  assert.ok(next.includes("pageSize=25"));
});
