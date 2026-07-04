import assert from "node:assert/strict";
import { describe, it } from "node:test";

import {
  loadResolvedProtocol,
  loadResolvedProtocolSlots,
} from "./imagingOsProtocolCatalogAdapter.server";

function stubSupabaseClient() {
  const chain = {
    select() {
      return chain;
    },
    eq() {
      return chain;
    },
    is() {
      return chain;
    },
    order() {
      return chain;
    },
    maybeSingle: async () => ({ data: null, error: null }),
  };
  return { from: () => chain } as never;
}

describe("imagingOsProtocolCatalogAdapter.server", () => {
  it("exposes canonical catalog loader entry points", () => {
    assert.equal(typeof loadResolvedProtocol, "function");
    assert.equal(typeof loadResolvedProtocolSlots, "function");
  });

  it("loadResolvedProtocol resolves baseline_consultation from canonical catalog", async () => {
    const actual = await loadResolvedProtocol(
      "00000000-0000-4000-8000-000000000001",
      "baseline_consultation",
      stubSupabaseClient()
    );
    assert.equal(actual.slug, "baseline_consultation");
    assert.equal(actual.metadata.source, "imagingos_canonical");
    assert.ok(actual.slots.length >= 6);
  });

  it("loadResolvedProtocolSlots preserves protocol name and slot list for surgery_day", async () => {
    const resolved = await loadResolvedProtocolSlots(
      "00000000-0000-4000-8000-000000000001",
      "surgery_day",
      stubSupabaseClient()
    );
    assert.equal(resolved.protocol.slug, "surgery_day");
    assert.equal(resolved.name, resolved.protocol.name);
    assert.equal(resolved.protocol.metadata.source, "imagingos_canonical");
    assert.ok(resolved.slots.length > 0);
    assert.equal(resolved.slots.length, resolved.protocol.slots.length);
  });
});