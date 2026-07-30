/**
 * FI-IMAGINGOS-PRE-SURGERY-PROJECTION-1A — Explicit provider selection (no silent stub fallback).
 */

import "server-only";

import {
  assertGenerationAllowed,
  resolveProjectionGatewayConfig,
  type ProjectionGatewayConfig,
} from "./config.server";
import { ProjectionGatewayError } from "./errors";
import type { PreSurgeryProjectionProvider } from "./provider";
import { createStubPreSurgeryProjectionProvider } from "./stubProvider.server";

export function resolveProjectionProvider(
  config: ProjectionGatewayConfig = resolveProjectionGatewayConfig()
): PreSurgeryProjectionProvider {
  try {
    assertGenerationAllowed(config);
  } catch (e) {
    const code =
      e && typeof e === "object" && "code" in e
        ? String((e as { code: string }).code)
        : "provider_disabled";
    if (code === "stub_blocked_in_production") {
      throw new ProjectionGatewayError(
        "stub_blocked_in_production",
        "Stub projection provider is blocked in production",
        503
      );
    }
    if (code === "feature_disabled") {
      throw new ProjectionGatewayError(
        "feature_disabled",
        "Pre-surgery projection gateway is disabled",
        503
      );
    }
    throw new ProjectionGatewayError(
      "provider_disabled",
      "No real projection provider is connected; generation is disabled",
      503
    );
  }

  if (config.provider === "stub") {
    return createStubPreSurgeryProjectionProvider();
  }

  throw new ProjectionGatewayError(
    "provider_disabled",
    "No real projection provider is connected; generation is disabled",
    503
  );
}
