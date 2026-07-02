import assert from "node:assert/strict";
import { describe, it } from "node:test";

import {
  beginFiPerfCollection,
  drainFiPerfSnapshot,
  recordFiPerfSpan,
} from "./fiPerfCollector.server";

describe("fiPerfCollector", () => {
  it("records spans when diagnostics enabled", () => {
    const prev = process.env.FI_PERF_DIAGNOSTICS_ENABLED;
    process.env.FI_PERF_DIAGNOSTICS_ENABLED = "1";
    beginFiPerfCollection("test.surface", "tenant-1");
    recordFiPerfSpan("step.one", 42);
    const snap = drainFiPerfSnapshot();
    assert.ok(snap);
    assert.equal(snap!.surface, "test.surface");
    assert.equal(snap!.spans.length, 1);
    assert.equal(snap!.spans[0]?.label, "step.one");
    process.env.FI_PERF_DIAGNOSTICS_ENABLED = prev;
  });

  it("nested collectors attribute spans to the innermost surface", () => {
    const prev = process.env.FI_PERF_DIAGNOSTICS_ENABLED;
    process.env.FI_PERF_DIAGNOSTICS_ENABLED = "1";
    beginFiPerfCollection("outer.surface", "tenant-1");
    beginFiPerfCollection("inner.surface", "tenant-1");
    recordFiPerfSpan("inner.step", 12);
    const inner = drainFiPerfSnapshot();
    recordFiPerfSpan("outer.step", 34);
    const outer = drainFiPerfSnapshot();
    assert.equal(inner?.surface, "inner.surface");
    assert.equal(inner?.spans[0]?.label, "inner.step");
    assert.equal(outer?.surface, "outer.surface");
    assert.equal(outer?.spans[0]?.label, "outer.step");
    process.env.FI_PERF_DIAGNOSTICS_ENABLED = prev;
  });
});