/**
 * Maps legacy FI HTTP ingest envelopes ↔ `@follicle/intelligence-core` envelopes.
 * Adapter-only: does not change ingestion handlers or persistence.
 */

import type { FiEventEnvelope, FiEventType, FiSourceSystem } from "@/src/types/fi-events";
import { fiEventTypeSchema } from "@/lib/fi/events/schema";
import type {
  IntelligenceEventEnvelope,
  IntelligenceEventName,
  IntelligenceSystemSource,
} from "@follicle/intelligence-core";

/** Reserved payload key for lossless adapter round-trip (strip before any external emit). */
export const ADAPTER_PAYLOAD_MIRROR_KEY = "__fiAdapterRoundTrip" as const;

export type AdapterRoundTripMirror = {
  tenant_id: string;
  occurred_at?: string;
  identifiers?: FiEventEnvelope["identifiers"];
};

export type AdapterWarning = { code: string; message: string };

const FI_EVENT_TYPE_SET = new Set<string>(fiEventTypeSchema);

function pushWarning(warnings: AdapterWarning[], code: string, message: string) {
  warnings.push({ code, message });
}

export function mapFiSourceSystemToIntelligenceSource(
  source: FiSourceSystem | string,
  warnings: AdapterWarning[]
): IntelligenceSystemSource {
  switch (source) {
    case "hli":
      return "hli";
    case "hairaudit":
      return "hairaudit";
    case "clinic":
      return "fi_os";
    default:
      pushWarning(
        warnings,
        "unknown_fi_source",
        `Unknown FI source_system "${String(source)}"; mapping to "external" for canonical envelope.`
      );
      return "external";
  }
}

/**
 * Maps canonical intelligence `source` to legacy FI `source_system` wire values.
 * `fi_os` → `clinic` preserves legacy clinic producer semantics on the FI side.
 */
export function mapIntelligenceSourceToFiSourceSystem(
  source: IntelligenceSystemSource,
  warnings: AdapterWarning[]
): FiSourceSystem {
  switch (source) {
    case "hli":
      return "hli";
    case "hairaudit":
      return "hairaudit";
    case "fi_os":
      return "clinic";
    case "iiohr":
      pushWarning(
        warnings,
        "iiohr_no_legacy_source",
        'Intelligence source "iiohr" is reserved; legacy FI envelope uses "clinic" as placeholder until IIOHR producer path exists.'
      );
      return "clinic";
    case "external":
      pushWarning(
        warnings,
        "external_no_legacy_source",
        'Intelligence source "external" has no single legacy FI source_system; using "clinic" as placeholder.'
      );
      return "clinic";
  }
}

export type ToIntelligenceEventEnvelopeResult = {
  envelope: IntelligenceEventEnvelope;
  warnings: AdapterWarning[];
};

export function toIntelligenceEventEnvelope(
  existingFiEvent: FiEventEnvelope,
  options?: { schema_version?: number }
): ToIntelligenceEventEnvelopeResult {
  const warnings: AdapterWarning[] = [];
  const source = mapFiSourceSystemToIntelligenceSource(existingFiEvent.source_system, warnings);
  const emitted_at =
    existingFiEvent.occurred_at && existingFiEvent.occurred_at.trim()
      ? existingFiEvent.occurred_at
      : new Date().toISOString();

  const mirror: AdapterRoundTripMirror = {
    tenant_id: existingFiEvent.tenant_id,
    occurred_at: existingFiEvent.occurred_at,
    identifiers: existingFiEvent.identifiers,
  };

  const envelope: IntelligenceEventEnvelope = {
    schema_version: options?.schema_version ?? 1,
    emitted_at,
    source,
    event_name: existingFiEvent.event_type as IntelligenceEventName,
    delivery_mode: "internal_only",
    privacy_level:
      existingFiEvent.event_type === "clinic.ai.usage" ? "aggregate_only" : "operational_clinical",
    event_id: existingFiEvent.source_event_id,
    ...(existingFiEvent.identifiers?.source_case_id
      ? { correlation_id: existingFiEvent.identifiers.source_case_id }
      : {}),
    payload: {
      ...existingFiEvent.payload,
      [ADAPTER_PAYLOAD_MIRROR_KEY]: mirror,
    },
  };

  return { envelope, warnings };
}

export type FromIntelligenceEventEnvelopeResult = {
  fiCompatible: FiEventEnvelope;
  warnings: AdapterWarning[];
};

function isFiEventTypeString(value: string): value is FiEventType {
  return FI_EVENT_TYPE_SET.has(value);
}

export function fromIntelligenceEventEnvelope(
  envelope: IntelligenceEventEnvelope
): FromIntelligenceEventEnvelopeResult {
  const warnings: AdapterWarning[] = [];
  const raw = envelope.payload as Record<string, unknown>;
  const mirrorRaw = raw[ADAPTER_PAYLOAD_MIRROR_KEY];
  const { [ADAPTER_PAYLOAD_MIRROR_KEY]: _strip, ...rest } = { ...raw };

  const mirror =
    mirrorRaw && typeof mirrorRaw === "object" && !Array.isArray(mirrorRaw)
      ? (mirrorRaw as AdapterRoundTripMirror)
      : undefined;

  if (!mirror?.tenant_id) {
    pushWarning(
      warnings,
      "missing_adapter_mirror",
      `Missing or incomplete "${ADAPTER_PAYLOAD_MIRROR_KEY}" payload; tenant_id may be empty.`
    );
  }

  const tenant_id = mirror?.tenant_id ?? "";
  const source_system = mapIntelligenceSourceToFiSourceSystem(envelope.source, warnings);

  const event_type_raw = envelope.event_name;
  const event_type = (
    isFiEventTypeString(event_type_raw) ? event_type_raw : (event_type_raw as FiEventType)
  );

  const fiCompatible: FiEventEnvelope = {
    tenant_id,
    event_type,
    source_system,
    source_event_id: envelope.event_id ?? "",
    occurred_at: mirror?.occurred_at ?? envelope.emitted_at,
    identifiers: mirror?.identifiers,
    payload: rest as Record<string, unknown>,
  };

  return { fiCompatible, warnings };
}
