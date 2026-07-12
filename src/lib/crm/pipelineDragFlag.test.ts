/**
 * FI-PIPELINE-STABILITY-GATE — desktop drag kill-switch parser.
 */

import assert from "node:assert/strict";
import { test } from "node:test";

import { parsePipelineDesktopDragEnabled } from "@/src/lib/crm/pipelineDragFlag";

test("drag flag defaults OFF when unset/empty", () => {
  assert.equal(parsePipelineDesktopDragEnabled(undefined), false);
  assert.equal(parsePipelineDesktopDragEnabled(null), false);
  assert.equal(parsePipelineDesktopDragEnabled(""), false);
  assert.equal(parsePipelineDesktopDragEnabled("   "), false);
});

test("drag flag OFF for falsey strings", () => {
  assert.equal(parsePipelineDesktopDragEnabled("false"), false);
  assert.equal(parsePipelineDesktopDragEnabled("0"), false);
  assert.equal(parsePipelineDesktopDragEnabled("off"), false);
  assert.equal(parsePipelineDesktopDragEnabled("no"), false);
  assert.equal(parsePipelineDesktopDragEnabled("enabled"), false);
});

test("drag flag ON only for explicit truthy tokens", () => {
  assert.equal(parsePipelineDesktopDragEnabled("true"), true);
  assert.equal(parsePipelineDesktopDragEnabled("TRUE"), true);
  assert.equal(parsePipelineDesktopDragEnabled(" 1 "), true);
  assert.equal(parsePipelineDesktopDragEnabled("yes"), true);
  assert.equal(parsePipelineDesktopDragEnabled("On"), true);
});
