import assert from "node:assert/strict";
import { describe, it } from "node:test";

import {
  assertLeadStageTransition,
  buildLeadStageChangedActivityMetadata,
  canTransitionLeadStage,
  clampLeadScore,
  externalEventIdempotencyKey,
  normalizeLeadEmail,
  normalizeLeadPhoneDigits,
} from "@/src/lib/leadFlow/leadFlowFoundationCore";

describe("leadFlowFoundationCore", () => {
  it("clamps lead score to 0–100", () => {
    assert.equal(clampLeadScore(-5), 0);
    assert.equal(clampLeadScore(42.7), 43);
    assert.equal(clampLeadScore(150), 100);
    assert.equal(clampLeadScore(Number.NaN), 0);
  });

  it("normalizes email and phone for deterministic lookup", () => {
    assert.equal(normalizeLeadEmail("  Test@Example.COM "), "test@example.com");
    assert.equal(normalizeLeadPhoneDigits("+61 412 345 678"), "61412345678");
    assert.equal(normalizeLeadPhoneDigits("123"), null);
  });

  it("allows valid stage transitions and rejects invalid ones", () => {
    assert.equal(canTransitionLeadStage("new", "contacted"), true);
    assert.equal(canTransitionLeadStage("won", "lost"), false);
    assert.equal(assertLeadStageTransition("new", "contacted"), "contacted");
    assert.throws(() => assertLeadStageTransition("won", "new"));
  });

  it("builds stage-changed activity metadata", () => {
    const metadata = buildLeadStageChangedActivityMetadata({
      fromStage: "new",
      toStage: "contacted",
      reason: "Initial outreach",
      source: "crm_operator",
    });
    assert.deepEqual(metadata, {
      from_stage: "new",
      to_stage: "contacted",
      reason: "Initial outreach",
      source: "crm_operator",
    });
  });

  it("builds external event idempotency key", () => {
    assert.equal(
      externalEventIdempotencyKey({
        tenantId: "t1",
        provider: "hubspot",
        externalId: "hs-123",
      }),
      "t1::hubspot::hs-123"
    );
    assert.equal(
      externalEventIdempotencyKey({
        tenantId: "t1",
        provider: "hubspot",
        externalId: "  ",
      }),
      null
    );
  });
});
