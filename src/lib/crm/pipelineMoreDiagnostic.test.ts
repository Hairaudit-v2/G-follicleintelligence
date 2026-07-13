import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import test from "node:test";

const UI = readFileSync(join("src/components/fi/crm/pipeline/pipelineUi.tsx"), "utf8");
const DIAG = readFileSync(join("src/lib/crm/pipelineMoreDiagnostic.ts"), "utf8");

test("diagnostic module exposes window.__moreLog behind env gate", () => {
  assert.match(DIAG, /window\.__moreLog/);
  assert.match(DIAG, /NEXT_PUBLIC_FI_PIPELINE_MORE_DIAG/);
  assert.doesNotMatch(DIAG, /document\.addEventListener/);
});

test("More UI logs instance marker and loadTier without lead identity", () => {
  assert.match(UI, /more-instance-/);
  assert.match(UI, /instanceRef/);
  assert.match(UI, /cardIndex/);
  assert.match(UI, /loadTier: props\.loadTier/);
  assert.doesNotMatch(UI, /moreLog\([^)]*leadId/);
});