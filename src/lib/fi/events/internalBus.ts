/**
 * Non-blocking internal intelligence bus (draft).
 * Default mode is `noop` in production; no network or downstream coupling.
 */

import type { IntelligenceEventEnvelope } from "@follicle/intelligence-core";

export type InternalIntelligenceDeliveryMode = "inline_dev_only" | "queued_future" | "noop";

export type EmitInternalIntelligenceEventOptions = {
  mode?: InternalIntelligenceDeliveryMode;
};

type Handler = (envelope: IntelligenceEventEnvelope) => void | Promise<void>;

const handlers = new Map<string, Set<Handler>>();

function resolveDefaultMode(): InternalIntelligenceDeliveryMode {
  const env = process.env.NODE_ENV;
  if (env === "test") return "inline_dev_only";
  if (env === "development") return "noop";
  return "noop";
}

/**
 * Registers a handler for an `event_name`. Not used by production ingest in Stage 10.
 */
export function registerInternalIntelligenceHandler(eventName: string, handler: Handler): () => void {
  let set = handlers.get(eventName);
  if (!set) {
    set = new Set();
    handlers.set(eventName, set);
  }
  set.add(handler);
  return () => {
    set?.delete(handler);
    if (set && set.size === 0) handlers.delete(eventName);
  };
}

/** Clears all handlers (test utility). */
export function __resetInternalIntelligenceHandlersForTests(): void {
  handlers.clear();
}

/**
 * Emits to registered handlers according to `mode`.
 * - `noop`: never invokes handlers.
 * - `queued_future`: reserved; currently behaves like `noop` (no queue implementation).
 * - `inline_dev_only`: invokes handlers synchronously when mode is explicitly set or default is test-only.
 */
export async function emitInternalIntelligenceEvent(
  envelope: IntelligenceEventEnvelope,
  options?: EmitInternalIntelligenceEventOptions
): Promise<void> {
  const mode = options?.mode ?? resolveDefaultMode();
  if (mode === "noop" || mode === "queued_future") {
    return;
  }

  const set = handlers.get(envelope.event_name);
  if (!set || set.size === 0) return;

  for (const h of set) {
    await h(envelope);
  }
}
