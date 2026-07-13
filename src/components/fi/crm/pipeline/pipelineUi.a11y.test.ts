/**
 * S4.3E — accessibility and tablet layout contract (static source checks).
 */

import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { test } from "node:test";

const UI = readFileSync(join("src/components/fi/crm/pipeline/pipelineUi.tsx"), "utf8");
const WS = readFileSync(join("src/components/fi/crm/pipeline/PipelineWorkspace.tsx"), "utf8");

test("keyboard users can move stage without drag", () => {
  assert.match(UI, /Move stage destinations/);
  assert.match(UI, /role="menu"/);
  // Desktop HTML5 drag is optional enhancement; Move stage remains for keyboard/tablet.
  assert.match(UI, /Move stage destinations/);
  assert.match(WS, /resolvePipelineDragDrop|runMove|onMoveToColumn/);
});

test("desktop drag is gated; tablet stack has no drag requirement", () => {
  assert.match(UI, /desktopDragEnabled/);
  assert.match(UI, /lg:hidden/);
  assert.match(UI, /layout="stack"/);
  // Drag only when desktopDragEnabled; tablet stack never enables drop
  assert.match(UI, /props\.layout === "desktop"/);
  assert.match(WS, /pointer: fine/);
  // Full-card draggable is forbidden — handle only
  assert.match(UI, /data-pipeline-drag-handle/);
  assert.doesNotMatch(UI, /draggable=\{canDrag\}/);
});

test("collapsible sections expose aria-expanded", () => {
  assert.match(UI, /aria-expanded/);
  assert.match(UI, /aria-controls/);
});

test("primary touch targets use min-h-11 (44px)", () => {
  assert.match(UI, /min-h-11/);
  assert.ok((UI.match(/min-h-11/g) ?? []).length >= 5);
});

test("tablet layout uses vertical stack without nested horizontal column scroll", () => {
  assert.match(UI, /lg:hidden/);
  assert.match(UI, /layout="stack"/);
  // Desktop board-level horizontal scroll only — contained region, not page root
  assert.match(UI, /overflow-x-auto/);
  assert.match(UI, /hidden min-w-0 max-w-full lg:block/);
  assert.match(UI, /pipeline-board-h-scroll/);
  assert.match(UI, /pipeline-board-root/);
  assert.match(UI, /overscroll-x-contain/);
});

test("live announcements for mutation outcomes", () => {
  assert.match(UI, /aria-live="polite"/);
  assert.match(WS, /PipelineLiveRegion/);
  assert.match(WS, /Lead moved to/);
  assert.match(WS, /Follow-up completed/);
  assert.match(WS, /Lead marked as lost/);
  assert.match(WS, /Could not move lead/);
});

test("focus restoration after move uses data-lead-id", () => {
  assert.match(WS, /data-lead-id/);
  assert.match(UI, /data-lead-id=\{card\.leadId\}/);
  assert.match(WS, /focusLead/);
});

test("no technical CRM / LeadFlow / Kanban / OS language in UI copy", () => {
  const banned = /\bLeadFlow\b|\bKanban\b|\bCRM\b|command centre|\bOS\b/;
  // Allow import paths and technical identifiers in code, check string literals roughly
  const stringLits = UI.match(/["'`][^"'`]{3,80}["'`]/g) ?? [];
  for (const s of stringLits) {
    if (s.includes("@/") || s.includes("pipeline") || s.includes("className")) continue;
    assert.doesNotMatch(s, banned, s);
  }
});

test("raw diagnostics IDs are not rendered in UI", () => {
  assert.doesNotMatch(UI, /duplicateLeadIds|orphanTaskIds|unknownStageLeadIds|conversionInconsistencies/);
  assert.match(UI, /hiddenLeadCount/);
});
