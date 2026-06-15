/**
 * Cross-system intelligence events (draft).
 * Complements legacy `FiEventEnvelope` — see package README for migration.
 */

/** Producer or context for an intelligence event. */
export type IntelligenceSystemSource = "fi_os" | "hli" | "hairaudit" | "iiohr" | "external";

/**
 * Allow-listed event names (examples + production-aligned aliases).
 * Extend this array when adding new cross-system events; bump `schema_version` when envelope fields change.
 */
export const INTELLIGENCE_EVENT_NAMES = [
  "iiohr.competency.evidence.created",
  "iiohr.competency.export.requested",
  "hairaudit.case.created",
  "hairaudit.case.submitted",
  "hairaudit.images.uploaded",
  "hairaudit.audit.completed",
  "hairaudit.report.generated",
  "fi_os.clinic.readiness.updated",
  "fi_os.patient_twin.updated",
  "hli.intake.submitted",
  "hli.document.uploaded",
  "hli.lab.panel.summary.recorded",
  /** FI HTTP ingest local-telemetry event; canonical envelope name for bus alignment. */
  "clinic.ai.usage",
] as const;

export type IntelligenceEventName = (typeof INTELLIGENCE_EVENT_NAMES)[number];

/** Type-specific payload; keep small and non-PHI for graph/export bus use. */
export type IntelligenceEventPayload = Record<string, unknown>;

/** How the event is delivered to consumers. */
export type IntelligenceEventDeliveryMode = "sync_http" | "async_queue" | "batch_file" | "internal_only";

/** Privacy tier for routing, retention, and export policy. */
export type IntelligenceEventPrivacyLevel =
  | "operational_clinical"
  | "pseudonymous_analytics"
  | "aggregate_only"
  | "internal_debug";

export type IntelligenceEventEnvelope = {
  /** Optional unique id assigned by emitter or bus. */
  event_id?: string;
  /** Monotonic contract version for this envelope shape. */
  schema_version: number;
  /** ISO-8601 timestamp when the emitter recorded the event. */
  emitted_at: string;
  source: IntelligenceSystemSource;
  event_name: IntelligenceEventName;
  delivery_mode: IntelligenceEventDeliveryMode;
  privacy_level: IntelligenceEventPrivacyLevel;
  /** Join key across services (optional). */
  correlation_id?: string;
  payload: IntelligenceEventPayload;
};

export type IntelligenceEventEnvelopeParseResult =
  | { ok: true; envelope: IntelligenceEventEnvelope }
  | { ok: false; error: string };

const SOURCES = new Set<IntelligenceSystemSource>(["fi_os", "hli", "hairaudit", "iiohr", "external"]);

const DELIVERY_MODES = new Set<IntelligenceEventDeliveryMode>([
  "sync_http",
  "async_queue",
  "batch_file",
  "internal_only",
]);

const PRIVACY_LEVELS = new Set<IntelligenceEventPrivacyLevel>([
  "operational_clinical",
  "pseudonymous_analytics",
  "aggregate_only",
  "internal_debug",
]);

const EVENT_NAME_SET = new Set<string>(INTELLIGENCE_EVENT_NAMES);

function isRecord(v: unknown): v is Record<string, unknown> {
  return typeof v === "object" && v !== null && !Array.isArray(v);
}

function asTrimmedString(v: unknown): string {
  return typeof v === "string" ? v.trim() : "";
}

function isIsoLike(s: string): boolean {
  return !Number.isNaN(Date.parse(s));
}

/**
 * Lightweight structural validation for bus ingress and tests.
 * Does not authenticate callers or enforce tenant scope — application middleware must.
 */
export function parseIntelligenceEventEnvelope(input: unknown): IntelligenceEventEnvelopeParseResult {
  if (!isRecord(input)) {
    return { ok: false, error: "Envelope must be a JSON object." };
  }

  const schema_version = input.schema_version;
  if (typeof schema_version !== "number" || !Number.isFinite(schema_version) || schema_version < 1) {
    return { ok: false, error: "schema_version must be a positive finite number." };
  }

  const emitted_at = asTrimmedString(input.emitted_at);
  if (!emitted_at || !isIsoLike(emitted_at)) {
    return { ok: false, error: "emitted_at must be a valid ISO-8601 timestamp string." };
  }

  const source = asTrimmedString(input.source) as IntelligenceSystemSource;
  if (!SOURCES.has(source)) {
    return { ok: false, error: "source must be one of fi_os, hli, hairaudit, iiohr, external." };
  }

  const event_name = asTrimmedString(input.event_name);
  if (!event_name || !EVENT_NAME_SET.has(event_name)) {
    return { ok: false, error: "event_name is unknown or missing; extend INTELLIGENCE_EVENT_NAMES." };
  }

  const delivery_mode = asTrimmedString(input.delivery_mode) as IntelligenceEventDeliveryMode;
  if (!DELIVERY_MODES.has(delivery_mode)) {
    return { ok: false, error: "delivery_mode is invalid." };
  }

  const privacy_level = asTrimmedString(input.privacy_level) as IntelligenceEventPrivacyLevel;
  if (!PRIVACY_LEVELS.has(privacy_level)) {
    return { ok: false, error: "privacy_level is invalid." };
  }

  if (!isRecord(input.payload)) {
    return { ok: false, error: "payload must be an object." };
  }

  const event_id = input.event_id !== undefined ? asTrimmedString(input.event_id) : undefined;
  const correlation_id =
    input.correlation_id !== undefined ? asTrimmedString(input.correlation_id) : undefined;

  const envelope: IntelligenceEventEnvelope = {
    ...(event_id ? { event_id } : {}),
    schema_version,
    emitted_at,
    source,
    event_name: event_name as IntelligenceEventName,
    delivery_mode,
    privacy_level,
    ...(correlation_id ? { correlation_id } : {}),
    payload: input.payload,
  };

  return { ok: true, envelope };
}
