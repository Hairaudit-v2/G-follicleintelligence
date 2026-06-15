import type { IntelligenceEventEnvelope } from "@follicle/intelligence-core";

import type { SupabaseClient } from "@supabase/supabase-js";

import { supabaseAdmin } from "@/lib/supabaseAdmin";

import type { InternalIntelligenceQueuedEnvelopeSummary } from "./internalBusQueue";
import { isFiIntelligenceEventLogPersistEnabled, type PersistentEventLogEnvOptions } from "./persistentEventLogEnv";
import {
  sanitizeIntelligenceEventForPersistence,
  sanitizeIntelligencePayloadKeysForPersistence,
} from "./sanitizeIntelligenceEventForPersistence";

export type PersistIntelligenceEventLogOptions = PersistentEventLogEnvOptions & {
  /** Unit tests only: bypass {@link supabaseAdmin} singleton. */
  supabaseClientForTests?: SupabaseClient;
};

export type PersistIntelligenceEventLogInput =
  | {
      status: string;
      summary: InternalIntelligenceQueuedEnvelopeSummary;
      /**
       * When still in scope (e.g. immediately after enqueue), pass the original envelope so
       * `payload_summary` uses safe key counting across the full payload, not only the queue sample slice.
       */
      envelope_for_payload_shape?: IntelligenceEventEnvelope;
      warnings?: string[];
      error_message?: string | null;
      /** Extra safe-only fields merged into payload_summary (e.g. handler_error_count). */
      payload_summary_extra?: Record<string, unknown>;
    }
  | {
      status: string;
      envelope: IntelligenceEventEnvelope;
      warnings?: string[];
      error_message?: string | null;
    };

export type PersistIntelligenceEventLogResult =
  | { status: "skipped_disabled" }
  | { status: "inserted"; id: string }
  | { status: "failed"; message: string };

function normalizeWarnings(w?: string[]): string[] {
  if (!w?.length) return [];
  return w.map((x) => (x.length > 500 ? x.slice(0, 500) : x));
}

function mergePayloadSummary(base: Record<string, unknown>, extra?: Record<string, unknown>): Record<string, unknown> {
  if (!extra) return base;
  return { ...base, ...extra };
}

/**
 * Inserts one sanitized row into `fi_intelligence_event_logs` using the Supabase **service role**.
 * Intended for Next.js server routes / server actions only (`*.server.ts`); not marked `server-only`
 * so unit tests can import this module under `tsx`. No-ops when persistence is disabled.
 * Swallows DB errors into `{ status: "failed" }` unless `throwOnError` is true (tests only).
 */
export async function persistIntelligenceEventLog(
  input: PersistIntelligenceEventLogInput,
  options?: PersistIntelligenceEventLogOptions & { throwOnError?: boolean }
): Promise<PersistIntelligenceEventLogResult> {
  if (!isFiIntelligenceEventLogPersistEnabled(options)) {
    return { status: "skipped_disabled" };
  }

  const meta =
    "summary" in input
      ? sanitizeIntelligenceEventForPersistence({ kind: "queue_summary", summary: input.summary })
      : sanitizeIntelligenceEventForPersistence({ kind: "envelope", envelope: input.envelope });

  let payload_summary = meta.payload_summary;
  if ("summary" in input && input.envelope_for_payload_shape) {
    const shape = sanitizeIntelligencePayloadKeysForPersistence(
      input.envelope_for_payload_shape.payload as Record<string, unknown>
    );
    payload_summary = mergePayloadSummary(
      {
        key_count: shape.key_count,
        key_sample: shape.key_sample,
        queue_item_id: input.summary.queue_item_id,
        schema_version: input.summary.schema_version,
      },
      input.payload_summary_extra
    );
  } else if ("summary" in input) {
    payload_summary = mergePayloadSummary(meta.payload_summary, input.payload_summary_extra);
  }

  const row = {
    event_name: meta.event_name,
    source: meta.source,
    source_event_id: meta.source_event_id,
    correlation_id: meta.correlation_id,
    privacy_level: meta.privacy_level,
    delivery_mode: meta.delivery_mode,
    status: input.status,
    payload_summary,
    warnings: normalizeWarnings(input.warnings),
    error_message: input.error_message ?? null,
    occurred_at: meta.occurred_at,
  };

  try {
    const supabase = options?.supabaseClientForTests ?? supabaseAdmin();
    const { data, error } = await supabase
      .from("fi_intelligence_event_logs")
      .insert(row)
      .select("id")
      .single();
    if (error) {
      if (options?.throwOnError) throw error;
      return { status: "failed", message: error.message };
    }
    if (!data?.id) {
      if (options?.throwOnError) throw new Error("persistIntelligenceEventLog: missing id");
      return { status: "failed", message: "missing id" };
    }
    return { status: "inserted", id: data.id as string };
  } catch (e) {
    if (options?.throwOnError) throw e;
    const message = e instanceof Error ? e.message : String(e);
    return { status: "failed", message };
  }
}
