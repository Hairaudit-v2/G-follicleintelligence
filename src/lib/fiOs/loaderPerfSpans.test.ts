import assert from "node:assert/strict";
import { describe, it } from "node:test";

import {
  drainLoaderPerfSpans,
  isLoaderPerfSpansEnabled,
  recordLoaderPerfSpan,
} from "./loaderPerfSpans.server";

describe("loaderPerfSpans", () => {
  it("is off unless FI_LOADER_PERF_SPANS=1", () => {
    const prev = process.env.FI_LOADER_PERF_SPANS;
    process.env.FI_LOADER_PERF_SPANS = "0";
    assert.equal(isLoaderPerfSpansEnabled(), false);
    process.env.FI_LOADER_PERF_SPANS = "1";
    assert.equal(isLoaderPerfSpansEnabled(), true);
    process.env.FI_LOADER_PERF_SPANS = prev;
  });

  it("records and drains spans when enabled", () => {
    const prev = process.env.FI_LOADER_PERF_SPANS;
    process.env.FI_LOADER_PERF_SPANS = "1";
    drainLoaderPerfSpans();
    recordLoaderPerfSpan("test.span", 12.4);
    const spans = drainLoaderPerfSpans();
    assert.equal(spans.length, 1);
    assert.equal(spans[0]?.label, "test.span");
    assert.equal(spans[0]?.ms, 12);
    assert.equal(drainLoaderPerfSpans().length, 0);
    process.env.FI_LOADER_PERF_SPANS = prev;
  });
});