import assert from "node:assert/strict";
import test from "node:test";

import {
  CASE_DETAIL_SECTION_IDS,
  CASE_PROCEDURE_DAY_DETAIL_HASH,
  caseProcedureDayDetailHref,
  procedureDayLinkForClipboard,
} from "@/src/lib/cases/caseDetailNavConstants";

test("CASE_PROCEDURE_DAY_DETAIL_HASH matches procedure day section id", () => {
  assert.equal(CASE_PROCEDURE_DAY_DETAIL_HASH, `#${CASE_DETAIL_SECTION_IDS.procedureDay}`);
});

test("caseProcedureDayDetailHref: encodes tenant and case, appends procedure-day hash", () => {
  const href = caseProcedureDayDetailHref("  tenant-uuid  ", "  case-uuid  ");
  assert.equal(href, "/fi-admin/tenant-uuid/cases/case-uuid#case-procedure-day");
});

test("caseProcedureDayDetailHref: encodes special characters in path segments", () => {
  const href = caseProcedureDayDetailHref("t1", "c/c");
  assert.equal(href, "/fi-admin/t1/cases/c%2Fc#case-procedure-day");
});

test("procedureDayLinkForClipboard: returns relative href when origin missing", () => {
  assert.equal(procedureDayLinkForClipboard("/fi-admin/t1/cases/c1#case-procedure-day"), "/fi-admin/t1/cases/c1#case-procedure-day");
  assert.equal(procedureDayLinkForClipboard("/fi-admin/t1/cases/c1#case-procedure-day", ""), "/fi-admin/t1/cases/c1#case-procedure-day");
});

test("procedureDayLinkForClipboard: builds absolute URL when origin provided", () => {
  assert.equal(
    procedureDayLinkForClipboard("/fi-admin/t1/cases/c1#case-procedure-day", "https://app.example.com"),
    "https://app.example.com/fi-admin/t1/cases/c1#case-procedure-day"
  );
});

test("procedureDayLinkForClipboard: trims inputs", () => {
  assert.equal(
    procedureDayLinkForClipboard("  /path  ", "  https://x.test  "),
    "https://x.test/path"
  );
});
