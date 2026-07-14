import assert from "node:assert/strict";
import { describe, it } from "node:test";

import { resolvePipelineInitialView } from "./pipelineQueryCompat";

describe("resolvePipelineInitialView", () => {
  it("defaults to board when view is absent", () => {
    assert.equal(resolvePipelineInitialView({}), "board");
  });

  it("maps view=board to board", () => {
    assert.equal(resolvePipelineInitialView({ view: "board" }), "board");
  });

  it("maps view=workspace to board", () => {
    assert.equal(resolvePipelineInitialView({ view: "workspace" }), "board");
  });

  it("maps view=list to board", () => {
    assert.equal(resolvePipelineInitialView({ view: "list" }), "board");
  });

  it("maps view=follow_ups to follow_ups", () => {
    assert.equal(resolvePipelineInitialView({ view: "follow_ups" }), "follow_ups");
  });

  it("maps unknown view values to board", () => {
    assert.equal(resolvePipelineInitialView({ view: "kanban" }), "board");
    assert.equal(resolvePipelineInitialView({ view: "mystery" }), "board");
  });

  it("trims and lowercases view values", () => {
    assert.equal(resolvePipelineInitialView({ view: "  FOLLOW_UPS  " }), "follow_ups");
    assert.equal(resolvePipelineInitialView({ view: "Workspace" }), "board");
  });

  it("reads the first value from string arrays", () => {
    assert.equal(resolvePipelineInitialView({ view: ["follow_ups", "board"] }), "follow_ups");
  });

  it("supports URLSearchParams", () => {
    assert.equal(resolvePipelineInitialView(new URLSearchParams("view=follow_ups")), "follow_ups");
  });
});
