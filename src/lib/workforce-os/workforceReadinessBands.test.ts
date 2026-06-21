import assert from "node:assert/strict";
import { test } from "node:test";

import { resolveWorkforceReadinessBand } from "./workforceReadinessBands";

test("resolveWorkforceReadinessBand returns label and variant", () => {
  const band = resolveWorkforceReadinessBand(92);
  assert.equal(band.id, "fully_ready");
  assert.equal(band.label, "Fully Ready");
  assert.equal(band.variant, "complete");
  assert.equal(band.severity, "success");
});

test("operational warning band uses warning variant", () => {
  const band = resolveWorkforceReadinessBand(75);
  assert.equal(band.id, "operational_warning");
  assert.equal(band.variant, "warning");
  assert.equal(band.severity, "warning");
});

test("not eligible band uses danger variant", () => {
  const band = resolveWorkforceReadinessBand(30);
  assert.equal(band.id, "not_eligible");
  assert.equal(band.variant, "danger");
  assert.equal(band.severity, "danger");
});
