/**
 * Cross-product idempotency — one current generation per clinical key.
 * Server-only: must never be reachable from client entry points.
 */

import "server-only";

import { createHash } from "node:crypto";
import type { SharedProjectionIdempotencyParts } from "../shared/requestContract";

function stableStringify(value: unknown): string {
  if (value === null || typeof value !== "object") {
    return JSON.stringify(value);
  }
  if (Array.isArray(value)) {
    return `[${value.map((v) => stableStringify(v)).join(",")}]`;
  }
  const obj = value as Record<string, unknown>;
  const keys = Object.keys(obj).sort();
  return `{${keys.map((k) => `${JSON.stringify(k)}:${stableStringify(obj[k])}`).join(",")}}`;
}

/**
 * Canonical idempotency key for shared illustrative generations.
 * Same valid request → same key → return existing generation; do not re-invoke provider.
 */
export function deriveSharedProjectionIdempotencyKey(
  parts: SharedProjectionIdempotencyParts
): string {
  const material = {
    v: 1 as const,
    patientSubjectRef: parts.patientSubjectRef.trim(),
    planId: parts.planId.trim(),
    planVersion: parts.planVersion,
    hairlineDesignId: parts.hairlineDesignId.trim(),
    hairlineDesignVersion: parts.hairlineDesignVersion,
    sourceImageChecksum: parts.sourceImageChecksum.trim().toLowerCase(),
    maskChecksum: parts.maskChecksum.trim().toLowerCase(),
    view: parts.view,
    mode: parts.mode,
    providerId: parts.providerId.trim().toLowerCase(),
    modelVersion: parts.modelVersion.trim(),
    promptTemplateVersion: parts.promptTemplateVersion.trim(),
  };
  return createHash("sha256").update(stableStringify(material)).digest("hex").slice(0, 40);
}

export function assertIdempotencyPartsComplete(
  parts: SharedProjectionIdempotencyParts
): void {
  const required: Array<[string, string | number]> = [
    ["patientSubjectRef", parts.patientSubjectRef],
    ["planId", parts.planId],
    ["hairlineDesignId", parts.hairlineDesignId],
    ["sourceImageChecksum", parts.sourceImageChecksum],
    ["maskChecksum", parts.maskChecksum],
    ["providerId", parts.providerId],
    ["modelVersion", parts.modelVersion],
    ["promptTemplateVersion", parts.promptTemplateVersion],
  ];
  for (const [name, value] of required) {
    if (value === "" || value == null) {
      throw new Error(`idempotency_incomplete:${name}`);
    }
  }
  if (!Number.isFinite(parts.planVersion) || parts.planVersion < 1) {
    throw new Error("idempotency_incomplete:planVersion");
  }
  if (!Number.isFinite(parts.hairlineDesignVersion) || parts.hairlineDesignVersion < 1) {
    throw new Error("idempotency_incomplete:hairlineDesignVersion");
  }
}
