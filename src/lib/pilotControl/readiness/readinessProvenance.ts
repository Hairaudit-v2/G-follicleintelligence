/**
 * FI-CONTROLLED-PILOT-CONTROL-CENTRE-1A.2 — provenance helpers (pure).
 * Never include clinical free text, pathology values, card data, image URLs, or message bodies.
 */

import { READINESS_EVALUATION_VERSION, type ReadinessObservedValueClass, type ReadinessProvenance, type PilotSourceSystem } from "./readinessTypes";

export function makeProvenance(args: {
  sourceSystem: PilotSourceSystem;
  observedValueClass: ReadinessObservedValueClass;
  sourceTable?: string;
  sourceView?: string;
  sourceRecordId?: string;
  sourceField?: string;
  sourceUpdatedAt?: string;
  correlationId?: string;
  resolverVersion?: string;
}): ReadinessProvenance {
  return {
    sourceSystem: args.sourceSystem,
    sourceTable: args.sourceTable,
    sourceView: args.sourceView,
    sourceRecordId: args.sourceRecordId,
    sourceField: args.sourceField,
    observedValueClass: args.observedValueClass,
    sourceUpdatedAt: args.sourceUpdatedAt,
    resolverVersion: args.resolverVersion ?? READINESS_EVALUATION_VERSION,
    correlationId: args.correlationId,
  };
}

/** Strip fields that must never appear in readiness telemetry or provenance. */
export function assertSafeProvenancePayload(payload: Record<string, unknown>): Record<string, unknown> {
  const banned = [
    "pathology_value",
    "medication",
    "clinical_notes",
    "card_number",
    "payment_token",
    "document_content",
    "image_url",
    "message_body",
    "body",
    "content",
  ];
  const out: Record<string, unknown> = {};
  for (const [k, v] of Object.entries(payload)) {
    const lower = k.toLowerCase();
    if (banned.some((b) => lower.includes(b))) continue;
    out[k] = v;
  }
  return out;
}
