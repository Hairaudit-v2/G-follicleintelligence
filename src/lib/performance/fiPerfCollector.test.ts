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
});