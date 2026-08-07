/**
 * @follicle/projection-core package unit tests
 */

import assert from "node:assert/strict";
import { describe, it } from "node:test";
import {
  SHARED_PROJECTION_LIFECYCLE_STATES,
  assertSharedProjectionLifecycleTransition,
  providerLooksLikeOverlayOnly,
  providerLooksLikePhotoreal,
} from "./index.ts";

describe("@follicle/projection-core", () => {
  it("exposes required lifecycle states", () => {
    assert.ok(SHARED_PROJECTION_LIFECYCLE_STATES.includes("ready_to_generate"));
    assert.ok(SHARED_PROJECTION_LIFECYCLE_STATES.includes("clinician_review"));
    assert.ok(!SHARED_PROJECTION_LIFECYCLE_STATES.includes("approved" as never));
  });

  it("classifies providers", () => {
    assert.equal(providerLooksLikeOverlayOnly("local-illustrative-v1"), true);
    assert.equal(providerLooksLikePhotoreal("openai-gpt-image"), true);
  });

  it("blocks illegal lifecycle jumps", () => {
    assert.throws(() =>
      assertSharedProjectionLifecycleTransition("awaiting_plan_approval", "clinician_review")
    );
  });
});
