/**
 * Stage 12: map internal bus queue outcomes to `IntelligenceEventLogRecord`-like rows
 * (in-memory / caller-provided only — no DB writes in this stage).
 */

import type {
  IntelligenceEventDeliveryMode,
  IntelligenceEventName,
  IntelligenceEventPrivacyLevel,
  IntelligenceSystemSource,
} from "@follicle/intelligence-core";
import type {
  DrainInternalIntelligenceEventQueueResult,
  EnqueueInternalIntelligenceEventResult,
} from "./internalBusQueue";

export type InternalBusQueueObservabilityWarning = { code: string; message: string };

/**
 * Field-aligned companion to `IntelligenceEventLogRecord` for queue telemetry
 * (`processing_status` → `status`, timestamps split for enqueue vs record creation).
 */
export type InternalBusQueueIntelligenceEventLogLike = {
  event_name: IntelligenceEventName | string;
  source: IntelligenceSystemSource | string;
  correlation_id?: string;
  privacy_level: IntelligenceEventPrivacyLevel | string;
  delivery_mode: IntelligenceEventDeliveryMode | string;
  status:
    | "received"
    | "processed"
    | "ignored"
    | "error"
    | "skipped_disabled"
    | "skipped_production"
    | "enqueued";
  warnings?: InternalBusQueueObservabilityWarning[];
  error_message?: string;
  occurred_at: string;
  created_at: string;
};

function isoNow(): string {
  return new Date().toISOString();
}

export function mapEnqueueInternalIntelligenceOutcomeToLogLike(input: {
  envelope: {
    event_name: IntelligenceEventName | string;
    source: IntelligenceSystemSource | string;
    correlation_id?: string;
    privacy_level: IntelligenceEventPrivacyLevel | string;
    delivery_mode: IntelligenceEventDeliveryMode | string;
    emitted_at: string;
  };
  result: EnqueueInternalIntelligenceEventResult;
  warnings?: InternalBusQueueObservabilityWarning[];
  occurred_at?: string;
  created_at?: string;
}): InternalBusQueueIntelligenceEventLogLike {
  const occurred_at = input.occurred_at ?? input.envelope.emitted_at;
  const created_at = input.created_at ?? isoNow();

  if (input.result.status === "skipped_disabled") {
    return {
      event_name: input.envelope.event_name,
      source: input.envelope.source,
      ...(input.envelope.correlation_id ? { correlation_id: input.envelope.correlation_id } : {}),
      privacy_level: input.envelope.privacy_level,
      delivery_mode: input.envelope.delivery_mode,
      status: "skipped_disabled",
      warnings: input.warnings,
      occurred_at,
      created_at,
    };
  }

  return {
    event_name: input.envelope.event_name,
    source: input.envelope.source,
    ...(input.envelope.correlation_id ? { correlation_id: input.envelope.correlation_id } : {}),
    privacy_level: input.envelope.privacy_level,
    delivery_mode: input.envelope.delivery_mode,
    status: "enqueued",
    warnings: input.warnings,
    occurred_at,
    created_at,
  };
}

export function mapDrainInternalIntelligenceOutcomeToLogLike(input: {
  envelope: {
    event_name: IntelligenceEventName | string;
    source: IntelligenceSystemSource | string;
    correlation_id?: string;
    privacy_level: IntelligenceEventPrivacyLevel | string;
    delivery_mode: IntelligenceEventDeliveryMode | string;
    emitted_at: string;
  };
  result: DrainInternalIntelligenceEventQueueResult;
  warnings?: InternalBusQueueObservabilityWarning[];
  occurred_at?: string;
  created_at?: string;
}): InternalBusQueueIntelligenceEventLogLike {
  const occurred_at = input.occurred_at ?? input.envelope.emitted_at;
  const created_at = input.created_at ?? isoNow();

  if (input.result.status === "skipped_disabled") {
    return {
      event_name: input.envelope.event_name,
      source: input.envelope.source,
      ...(input.envelope.correlation_id ? { correlation_id: input.envelope.correlation_id } : {}),
      privacy_level: input.envelope.privacy_level,
      delivery_mode: input.envelope.delivery_mode,
      status: "skipped_disabled",
      warnings: input.warnings,
      occurred_at,
      created_at,
    };
  }

  if (input.result.status === "skipped_production") {
    return {
      event_name: input.envelope.event_name,
      source: input.envelope.source,
      ...(input.envelope.correlation_id ? { correlation_id: input.envelope.correlation_id } : {}),
      privacy_level: input.envelope.privacy_level,
      delivery_mode: input.envelope.delivery_mode,
      status: "skipped_production",
      warnings: input.warnings,
      occurred_at,
      created_at,
    };
  }

  const errs = input.result.items.flatMap((i) => i.handler_errors);
  const hasErr = errs.length > 0;

  return {
    event_name: input.envelope.event_name,
    source: input.envelope.source,
    ...(input.envelope.correlation_id ? { correlation_id: input.envelope.correlation_id } : {}),
    privacy_level: input.envelope.privacy_level,
    delivery_mode: input.envelope.delivery_mode,
    status: hasErr ? "error" : "processed",
    warnings: input.warnings,
    ...(hasErr ? { error_message: errs.join("; ") } : {}),
    occurred_at,
    created_at,
  };
}
