import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import test from "node:test";

import {
  buildPipelineMenuDismissKey,
  collectPipelineBoardLeadIds,
  isOpenMenuLeadStillOnBoard,
  shouldBumpMenuDismissEpochOnPresentationApply,
} from "@/src/lib/crm/pipelineMenuDismiss";

const UI = readFileSync(join("src/components/fi/crm/pipeline/pipelineUi.tsx"), "utf8");
const WS = readFileSync(join("src/components/fi/crm/pipeline/PipelineWorkspace.tsx"), "utf8");
const DIAG = readFileSync(join("src/lib/crm/pipelineMoreDiagnostic.ts"), "utf8");

test("1. menuDismissKey uses view:epoch — not generatedAt", () => {
  assert.equal(buildPipelineMenuDismissKey("board", 0), "board:0");
  assert.equal(buildPipelineMenuDismissKey("follow_ups", 2), "follow_ups:2");
  assert.doesNotMatch(WS, /presentation\.generatedAt.*menuDismiss/);
  assert.doesNotMatch(WS, /presentationKey/);
  assert.match(WS, /menuDismissKey=\{menuDismissKey\}/);
  assert.match(WS, /buildPipelineMenuDismissKey/);
});

test("2. shell→full hydrate does not bump menuDismissEpoch", () => {
  assert.equal(shouldBumpMenuDismissEpochOnPresentationApply("hydrate"), false);
  assert.equal(shouldBumpMenuDismissEpochOnPresentationApply("refresh"), true);
  assert.match(WS, /shouldBumpMenuDismissEpochOnPresentationApply/);
  assert.match(WS, /applyFullPresentation\(next, "hydrate"\)/);
});

test("3. generatedAt change alone does not clear openMenuLeadId", () => {
  assert.doesNotMatch(UI, /menuDismissKey.*generatedAt/);
  assert.doesNotMatch(UI, /\[props\.presentationKey/);
  assert.match(UI, /\[props\.menuDismissKey\]/);
});

test("4. loadTier change alone does not close More", () => {
  assert.doesNotMatch(UI, /\[props\.presentationKey, props\.loadTier\]/);
  assert.doesNotMatch(UI, /\[props\.menuDismissKey, props\.loadTier\]/);
  assert.doesNotMatch(WS, /loadTier.*menuDismiss/);
});

test("5. enrichment hydrate mode does not advance epoch", () => {
  assert.match(WS, /applyFullPresentation\(next, "hydrate"\)/);
  assert.equal(shouldBumpMenuDismissEpochOnPresentationApply("hydrate"), false);
});

test("6. view change closes More via menuDismissKey", () => {
  const k1 = buildPipelineMenuDismissKey("board", 1);
  const k2 = buildPipelineMenuDismissKey("follow_ups", 1);
  assert.notEqual(k1, k2);
  assert.match(UI, /menuDismissKey changed/);
});

test("7. explicit refresh closes More via epoch bump", () => {
  const before = buildPipelineMenuDismissKey("board", 0);
  const after = buildPipelineMenuDismissKey("board", 1);
  assert.notEqual(before, after);
  assert.match(WS, /applyFullPresentation\(next, "refresh"\)/);
});

test("8. card removal clears open menu when lead leaves board", () => {
  const cols = [{ cards: [{ leadId: "a" }, { leadId: "b" }] }];
  assert.equal(isOpenMenuLeadStillOnBoard("c", cols), false);
  assert.match(UI, /isOpenMenuLeadStillOnBoard/);
  assert.match(UI, /card-removed/);
});

test("9. selecting an action closes the menu", () => {
  assert.match(UI, /onSelect=\{\(\) => \{[\s\S]*setMenuOpen\(false\)/);
});

test("10-11. outside click and Escape close with Radix handlers", () => {
  assert.match(UI, /onPointerDownOutside/);
  assert.match(UI, /onInteractOutside/);
  assert.match(UI, /onEscapeKeyDown/);
  assert.match(UI, /onCloseAutoFocus/);
});

test("12. only one menu open via openMenuLeadId", () => {
  assert.match(UI, /openMenuLeadId === card\.leadId/);
});

test("13. Contact primary path stays independent", () => {
  assert.match(UI, /props\.onAction\(primary, card\)/);
});

test("14. drag remains disabled by default", () => {
  assert.match(WS, /desktopDragFeatureEnabled = false/);
  assert.match(UI, /const canDrag = Boolean\(props\.desktopDragEnabled\)/);
});

test("15. sort changes do not flow into menuDismissKey", () => {
  assert.doesNotMatch(WS, /sortMode.*menuDismiss/);
  assert.doesNotMatch(WS, /menuDismissKey=\{`\$\{.*sortMode/);
});

test("16. diagnostics are env-gated and PHI-safe", () => {
  assert.match(DIAG, /NEXT_PUBLIC_FI_PIPELINE_MORE_DIAG/);
  assert.match(DIAG, /window\.__moreLog/);
  assert.doesNotMatch(DIAG, /document\.addEventListener/);
  assert.doesNotMatch(UI, /leadId.*moreLog/);
  assert.match(UI, /cardIndex/);
});

test("collectPipelineBoardLeadIds dedupes rendered cards", () => {
  const ids = collectPipelineBoardLeadIds([
    { cards: [{ leadId: "x" }] },
    { cards: [{ leadId: "y" }, { leadId: "x" }] },
  ]);
  assert.deepEqual([...ids].sort(), ["x", "y"]);
});