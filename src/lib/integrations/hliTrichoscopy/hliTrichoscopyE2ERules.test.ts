/**
 * Browser E2E checklist for FI-TRICHOSCOPY-1A (run against staging with stub or live HLI).
 *
 * Automated Playwright coverage can be expanded once staging tenants are seeded.
 * This file documents the minimum acceptance paths and provides lightweight smoke helpers.
 */

import assert from "node:assert/strict";
import { describe, it } from "node:test";

import { evaluateTrichoscopyAccessLayers, capabilitiesForTier } from "@/src/lib/platform/entitlements/trichoscopyCapabilities";
import { canShowModuleNav } from "@/src/lib/platform/entitlements/modules";

describe("trichoscopy entitlement-aware UI rules (smoke)", () => {
  it("hides module nav when not entitled", () => {
    const entitlements = {
      tenantId: "t1",
      userId: "u1",
      modules: {
        hli_trichoscopy: { moduleCode: "hli_trichoscopy", canAccess: false, showInNav: false },
      },
    };
    assert.equal(canShowModuleNav(entitlements, "hli_trichoscopy"), false);
  });

  it("blocks surgical planning on clinical tier (UI capability gate)", () => {
    const access = evaluateTrichoscopyAccessLayers({
      platformEnabled: true,
      entitlementStatus: "active",
      capabilityTier: "clinical",
      subscribedCapabilities: [...capabilitiesForTier("clinical")],
      tenantModuleEnabled: true,
      tenantConfigCapabilities: [...capabilitiesForTier("clinical")],
      platformCapabilities: [...capabilitiesForTier("complete")],
      userPermitted: true,
      resourceAccessible: true,
      requestedCapability: "trichoscopy.surgical_planning",
    });
    assert.equal(access.allowed, false);
  });

  it("upgrade to complete enables surgical planning", () => {
    const access = evaluateTrichoscopyAccessLayers({
      platformEnabled: true,
      entitlementStatus: "active",
      capabilityTier: "complete",
      subscribedCapabilities: [...capabilitiesForTier("complete")],
      tenantModuleEnabled: true,
      tenantConfigCapabilities: [...capabilitiesForTier("complete")],
      platformCapabilities: [...capabilitiesForTier("complete")],
      userPermitted: true,
      resourceAccessible: true,
      requestedCapability: "trichoscopy.surgical_planning",
    });
    assert.equal(access.allowed, true);
  });

  it("feature flag off disables all tenant access", () => {
    const access = evaluateTrichoscopyAccessLayers({
      platformEnabled: false,
      entitlementStatus: "active",
      capabilityTier: "complete",
      subscribedCapabilities: [...capabilitiesForTier("complete")],
      tenantModuleEnabled: true,
      tenantConfigCapabilities: [...capabilitiesForTier("complete")],
      platformCapabilities: [...capabilitiesForTier("complete")],
      userPermitted: true,
      resourceAccessible: true,
      requestedCapability: "trichoscopy.view",
    });
    assert.equal(access.denialReason, "platform_disabled");
  });
});
