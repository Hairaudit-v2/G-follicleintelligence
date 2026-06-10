import assert from "node:assert/strict";
import test from "node:test";

import { buildProcedureDayMismatchWarnings } from "@/src/lib/cases/procedureDayMismatchModel";

test("buildProcedureDayMismatchWarnings: flags procedure vs booking day mismatch", () => {
  const w = buildProcedureDayMismatchWarnings({
    procedureDateYmd: "2026-06-12",
    linkedSurgeryBookingYmd: "2026-06-11",
  });
  assert.equal(w.length, 1);
  assert.equal(w[0]?.severity, "warning");
  assert.ok(w[0]?.message.includes("does not match"));
});

test("buildProcedureDayMismatchWarnings: warns when booking exists but procedure date empty", () => {
  const w = buildProcedureDayMismatchWarnings({
    procedureDateYmd: null,
    linkedSurgeryBookingYmd: "2026-06-10",
  });
  assert.equal(w.length, 1);
});

test("buildProcedureDayMismatchWarnings: empty when aligned", () => {
  assert.equal(
    buildProcedureDayMismatchWarnings({
      procedureDateYmd: "2026-06-10",
      linkedSurgeryBookingYmd: "2026-06-10",
    }).length,
    0
  );
});
