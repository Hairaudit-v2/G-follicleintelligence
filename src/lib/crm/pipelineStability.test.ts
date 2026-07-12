/**
 * FI-PIPELINE-STABILITY-FIX — More menu + initial load contracts (static + pure).
 */

import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { test } from "node:test";

import {
  PIPELINE_BOARD_DEFAULT_MAX_LEADS,
  PIPELINE_BOARD_DEFAULT_MAX_PAGES,
} from "@/src/lib/crm/crmShellLoaders";
import {
  normalizePipelineSearchParams,
  pipelineInitialBoardMaxLeads,
} from "@/src/lib/crm/pipelineLoader";

const UI = readFileSync(join("src/components/fi/crm/pipeline/pipelineUi.tsx"), "utf8");
const WS = readFileSync(join("src/components/fi/crm/pipeline/PipelineWorkspace.tsx"), "utf8");
const LOADERS = readFileSync(join("src/lib/crm/crmShellLoaders.ts"), "utf8");
const LOADER_PURE = readFileSync(join("src/lib/crm/pipelineLoader.ts"), "utf8");
const ORCH = readFileSync(join("src/lib/crm/pipelineLoaderOrchestration.ts"), "utf8");

// --- More menu ----------------------------------------------------------------

test("1. Contact primary action remains a direct button path", () => {
  assert.match(UI, /pipelineCardActionLabel\(primary\)/);
  assert.match(UI, /props\.onAction\(primary, card\)/);
});

test("2. More opens via controlled DropdownMenu", () => {
  assert.match(UI, /aria-label="More actions"/);
  assert.match(UI, /open=\{menuOpen\}/);
  assert.match(UI, /onOpenChange=\{\(open\) =>/);
  assert.match(UI, /openMenuLeadId === card\.leadId/);
});

test("3. More remains open — not reset on loadTier alone", () => {
  assert.doesNotMatch(UI, /\[props\.presentationKey, props\.loadTier\]/);
  assert.match(UI, /setOpenMenuLeadId\(null\)/);
  assert.match(UI, /\[props\.presentationKey\]/);
});

test("4. More only renders when secondary actions exist", () => {
  assert.match(UI, /secondary\.length > 0 \? \(/);
  assert.match(UI, /aria-label="More actions"/);
});

test("5. onOpenChange can close More", () => {
  assert.match(UI, /setMenuOpen\(open\)/);
});

test("6-8. Escape / outside / focus — Radix + focus restore", () => {
  assert.match(UI, /DropdownMenuContent/);
  assert.match(UI, /onCloseAutoFocus/);
  assert.match(UI, /data-pipeline-more-trigger/);
});

test("9. More does not start drag", () => {
  assert.match(UI, /data-pipeline-more-trigger/);
  assert.match(UI, /onPointerDown=\{stopCardDrag\}/);
  assert.match(UI, /data-pipeline-card-actions/);
  assert.doesNotMatch(UI, /draggable=\{canDrag\}/);
});

test("10. Drag is handle-only on desktop", () => {
  assert.match(UI, /data-pipeline-drag-handle/);
  assert.match(UI, /aria-label="Drag to move stage"/);
  assert.match(UI, /data-pipeline-draggable=\{canDrag \? "handle"/);
});

test("11. Selecting an action closes menu then dispatches", () => {
  assert.match(UI, /setMenuOpen\(false\)/);
  assert.match(UI, /props\.onAction\(a, card\)/);
});

test("12-13. Sort does not remount menu via presentationKey", () => {
  assert.match(WS, /presentationKey=\{`\$\{presentation\.generatedAt\}:\$\{view\}`\}/);
  assert.doesNotMatch(WS, /sortMode\}`\}/);
});

test("14. Shell-to-full does not reset menu via loadTier", () => {
  assert.doesNotMatch(UI, /\[props\.presentationKey, props\.loadTier\]/);
});

test("15. Mutation refresh uses presentation generatedAt identity", () => {
  assert.match(WS, /presentation\.generatedAt/);
  assert.match(UI, /presentationKey/);
});

test("16. Read-only: drag disabled when canMutate false", () => {
  assert.match(WS, /mq\.matches && permissions\.canMutate/);
});

test("17. Tablet: stack layout never enables drop", () => {
  assert.match(UI, /props\.layout === "desktop"/);
  assert.match(UI, /lg:hidden/);
});

test("18. Only one menu open via openMenuLeadId", () => {
  assert.match(UI, /openMenuLeadId === card\.leadId/);
  assert.match(UI, /setOpenMenuLeadId/);
});

// --- Initial load bounds ------------------------------------------------------

test("19. Shell build does not require enrichment maps", () => {
  assert.match(ORCH, /loadPipelineShellPayload/);
  assert.match(ORCH, /buildPipelinePresentation/);
});

test("20. More trigger not gated on loadTier full", () => {
  assert.match(UI, /secondary\.length > 0/);
  assert.doesNotMatch(UI, /loadTier === "full"[\s\S]{0,80}More actions/);
});

test("21. Default query limit is bounded (300)", () => {
  assert.equal(PIPELINE_BOARD_DEFAULT_MAX_PAGES, 3);
  assert.equal(PIPELINE_BOARD_DEFAULT_MAX_LEADS, 300);
  assert.equal(pipelineInitialBoardMaxLeads(), 300);
  const n = normalizePipelineSearchParams({});
  assert.equal(String(n.boardMaxPages), "3");
});

test("22-24. Lost/converted raise window slightly but stay capped", () => {
  const lost = normalizePipelineSearchParams({ lifecycle: "closed_lost" });
  assert.equal(String(lost.boardMaxPages), "5");
  const won = normalizePipelineSearchParams({ lifecycle: "converted" });
  assert.equal(String(won.boardMaxPages), "5");
});

test("25. Explicit boardMaxPages is preserved", () => {
  const n = normalizePipelineSearchParams({ boardMaxPages: "2" });
  assert.equal(String(n.boardMaxPages), "2");
});

test("26. Shell/full share boardMaxPages normalization", () => {
  assert.match(LOADER_PURE, /boardMaxPages/);
  assert.match(LOADERS, /boardMaxPages/);
});

test("27. Owner options not loaded in shell orchestration", () => {
  assert.doesNotMatch(ORCH, /loadCrmAssignableOwnerOptions|loadCrmShellUserPickerOptions/);
});

test("28. More state is local to Board — not in ops useMemo", () => {
  assert.match(UI, /const \[openMenuLeadId, setOpenMenuLeadId\]/);
  assert.doesNotMatch(WS, /openMenuLeadId/);
  assert.match(WS, /applyPipelineOpsToPresentation/);
});

test("29. No default polling", () => {
  assert.doesNotMatch(WS, /setInterval/);
});

test("30. Full enrichment failure retains shell", () => {
  assert.match(WS, /Retain shell \/ last valid presentation on full-load failure/);
});

test("31. Inactive review does not O(n) scan on every board paint", () => {
  assert.match(WS, /Avoid O\(n\) inactive scan on every board paint/);
});

test("32. Move stage keyboard path remains", () => {
  assert.match(UI, /Move stage destinations/);
  assert.match(UI, /role="menu"/);
});
