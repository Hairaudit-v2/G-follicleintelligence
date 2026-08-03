import assert from "node:assert/strict";
import { describe, it } from "node:test";

import {
  capabilitiesForTier,
  evaluateTrichoscopyAccessLayers,
  hasCapability,
  intersectCapabilities,
  TRICHOSCOPY_TIER_CAPABILITIES,
} from "./trichoscopyCapabilities";
import {
  buildTrichoscopyRequestIdempotencyKey,
  mapEventTypeToFiosStatus,
  mapHliTrichoscopyStatusToFios,
  resolveFiosTrichoscopyReadiness,
} from "@/src/lib/integrations/hliTrichoscopy/mappers";
import {
  signHliTrichoscopyPayload,
  verifyHliTrichoscopySignature,
  verifyHliTrichoscopyTimestamp,
} from "@/src/lib/integrations/hliTrichoscopy/eventVerifier";

describe("trichoscopyCapabilities", () => {
  it("packages capture tier without surgical planning", () => {
    const caps = capabilitiesForTier("capture");
    assert.equal(hasCapability(caps, "trichoscopy.request"), true);
    assert.equal(hasCapability(caps, "trichoscopy.surgical_planning"), false);
  });

  it("clinical tier excludes longitudinal", () => {
    const caps = capabilitiesForTier("clinical");
    assert.equal(hasCapability(caps, "trichoscopy.quantitative_metrics"), true);
    assert.equal(hasCapability(caps, "trichoscopy.longitudinal"), false);
  });

  it("complete includes all capabilities", () => {
    assert.equal(
      capabilitiesForTier("complete").length,
      TRICHOSCOPY_TIER_CAPABILITIES.complete.length
    );
  });

  it("intersects subscribed and tenant config", () => {
    const result = intersectCapabilities(
      capabilitiesForTier("surgical"),
      capabilitiesForTier("clinical")
    );
    assert.equal(hasCapability(result, "trichoscopy.surgical_planning"), false);
    assert.equal(hasCapability(result, "trichoscopy.review"), true);
  });
});

describe("evaluateTrichoscopyAccessLayers", () => {
  const base = {
    platformEnabled: true,
    entitlementStatus: "active" as const,
    capabilityTier: "clinical" as const,
    subscribedCapabilities: [...capabilitiesForTier("clinical")],
    tenantModuleEnabled: true,
    tenantConfigCapabilities: [...capabilitiesForTier("clinical")],
    platformCapabilities: [...capabilitiesForTier("complete")],
    userPermitted: true,
    resourceAccessible: true,
    requestedCapability: "trichoscopy.request" as const,
  };

  it("allows when all layers pass", () => {
    const result = evaluateTrichoscopyAccessLayers(base);
    assert.equal(result.allowed, true);
  });

  it("denies when platform disabled", () => {
    const result = evaluateTrichoscopyAccessLayers({ ...base, platformEnabled: false });
    assert.equal(result.allowed, false);
    assert.equal(result.denialReason, "platform_disabled");
  });

  it("denies when not entitled", () => {
    const result = evaluateTrichoscopyAccessLayers({
      ...base,
      entitlementStatus: "not_entitled",
    });
    assert.equal(result.denialReason, "subscription_not_included");
  });

  it("denies when module disabled", () => {
    const result = evaluateTrichoscopyAccessLayers({ ...base, tenantModuleEnabled: false });
    assert.equal(result.denialReason, "tenant_module_disabled");
  });

  it("denies surgical capability on clinical tier", () => {
    const result = evaluateTrichoscopyAccessLayers({
      ...base,
      requestedCapability: "trichoscopy.surgical_planning",
    });
    assert.equal(result.allowed, false);
    assert.equal(result.denialReason, "capability_not_included");
  });

  it("denies when user not permitted", () => {
    const result = evaluateTrichoscopyAccessLayers({ ...base, userPermitted: false });
    assert.equal(result.denialReason, "user_not_permitted");
  });

  it("denies when resource not accessible", () => {
    const result = evaluateTrichoscopyAccessLayers({ ...base, resourceAccessible: false });
    assert.equal(result.denialReason, "resource_not_accessible");
  });

  it("marks trial expired", () => {
    const result = evaluateTrichoscopyAccessLayers({
      ...base,
      entitlementStatus: "trial",
      trialEndsAt: "2020-01-01T00:00:00.000Z",
      now: new Date("2024-01-01T00:00:00.000Z"),
    });
    assert.equal(result.allowed, false);
    assert.equal(result.denialReason, "trial_expired");
    assert.equal(result.historicalReadOnly, true);
  });

  it("blocks new usage in grace period", () => {
    const result = evaluateTrichoscopyAccessLayers({
      ...base,
      entitlementStatus: "grace_period",
      gracePeriodEndsAt: "2099-01-01T00:00:00.000Z",
    });
    assert.equal(result.allowed, false);
    assert.equal(result.historicalReadOnly, true);
  });

  it("denies suspended accounts", () => {
    const result = evaluateTrichoscopyAccessLayers({
      ...base,
      entitlementStatus: "suspended",
    });
    assert.equal(result.denialReason, "account_suspended");
  });

  it("applies manual override capabilities", () => {
    const result = evaluateTrichoscopyAccessLayers({
      ...base,
      capabilityTier: "capture",
      subscribedCapabilities: [...capabilitiesForTier("capture")],
      tenantConfigCapabilities: [...capabilitiesForTier("complete")],
      overrideCapabilities: ["trichoscopy.surgical_planning"],
      requestedCapability: "trichoscopy.surgical_planning",
    });
    assert.equal(result.allowed, true);
  });
});

describe("status and readiness mappers", () => {
  it("maps HLI statuses", () => {
    assert.equal(mapHliTrichoscopyStatusToFios("analysis_ready"), "review_pending");
    assert.equal(mapHliTrichoscopyStatusToFios("confirmed"), "confirmed");
  });

  it("maps event types", () => {
    assert.equal(mapEventTypeToFiosStatus("trichoscopy.repeat_capture_requested"), "repeat_capture_required");
  });

  it("readiness does not invent clinical decisions", () => {
    const r = resolveFiosTrichoscopyReadiness({ status: "capture_due", required: true });
    assert.equal(r.blocking, true);
    assert.ok(r.blockingReasonCodes.includes("trichoscopy_capture_incomplete"));
    assert.notEqual(r.nextAction, "unsuitable_for_surgery");
  });

  it("builds stable idempotency keys", () => {
    const a = buildTrichoscopyRequestIdempotencyKey({
      tenantId: "t1",
      patientId: "p1",
      purpose: "consultation",
    });
    const b = buildTrichoscopyRequestIdempotencyKey({
      tenantId: "t1",
      patientId: "p1",
      purpose: "consultation",
    });
    assert.equal(a, b);
  });
});

describe("HLI event signature", () => {
  it("verifies valid signatures and rejects tampering", () => {
    const secret = "test-hli-trichoscopy-webhook-secret-32!";
    const timestamp = String(Date.now());
    const requestId = "req-1";
    const tenantId = "tenant-1";
    const body = JSON.stringify({ eventId: "e1" });
    const signature = signHliTrichoscopyPayload({
      secret,
      timestamp,
      requestId,
      tenantId,
      body,
    });
    assert.equal(
      verifyHliTrichoscopySignature({ secret, timestamp, requestId, tenantId, body, signature }),
      true
    );
    assert.equal(
      verifyHliTrichoscopySignature({
        secret,
        timestamp,
        requestId,
        tenantId,
        body: JSON.stringify({ eventId: "e2" }),
        signature,
      }),
      false
    );
  });

  it("rejects skewed timestamps", () => {
    assert.equal(verifyHliTrichoscopyTimestamp(String(Date.now() - 60 * 60 * 1000)), false);
    assert.equal(verifyHliTrichoscopyTimestamp(String(Date.now())), true);
  });
});
