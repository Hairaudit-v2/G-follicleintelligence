/**
 * FI-CONTROLLED-PILOT-ACTIVATION-1B Governance Closure —
 * best-effort pathway event emission (server).
 *
 * Never blocks domain mutations. Never triggers human-gated lifecycle events
 * while invitations remain disabled.
 */
import "server-only";

import type { SupabaseClient } from "@supabase/supabase-js";

import { recordPilotControlAuditEvent } from "../api/pilotControlActivity.server";
import {
  buildPilotControlDomainEvent,
  classifySyntheticEvidence,
  decideDomainEventEmission,
  scrubDomainEventPayload,
  type BuildDomainEventInput,
  type PilotControlDomainEvent,
} from "./domainEvents";

export type EmitPilotPathwayEventResult = {
  emitted: boolean;
  reason?: string;
  event?: PilotControlDomainEvent;
  writeFailed?: boolean;
};

/**
 * In-memory idempotency for the current process (tests + short-lived serverless).
 * Durable uniqueness remains soft — DB may still receive duplicates across instances;
 * consumers must treat idempotencyKey as the dedupe key.
 */
const recentKeys = new Map<string, number>();
const KEY_TTL_MS = 60 * 60 * 1000;

function rememberKey(key: string): void {
  const now = Date.now();
  recentKeys.set(key, now);
  if (recentKeys.size > 5000) {
    for (const [k, t] of recentKeys) {
      if (now - t > KEY_TTL_MS) recentKeys.delete(k);
    }
  }
}

function knownKeys(): string[] {
  const now = Date.now();
  const keys: string[] = [];
  for (const [k, t] of recentKeys) {
    if (now - t <= KEY_TTL_MS) keys.push(k);
  }
  return keys;
}

export async function emitPilotPathwayEventBestEffort(
  input: BuildDomainEventInput & {
    expectedTenantId?: string;
    humanInviteGateComplete?: boolean;
    automaticPolling?: boolean;
    payload?: Record<string, unknown>;
    supabase?: SupabaseClient;
  }
): Promise<EmitPilotPathwayEventResult> {
  const decision = decideDomainEventEmission({
    existingKeys: knownKeys(),
    nextKey: input.idempotencyKey,
    eventTenantId: input.tenantId,
    expectedTenantId: input.expectedTenantId ?? input.tenantId,
    eventType: input.eventType,
    humanInviteGateComplete: input.humanInviteGateComplete === true,
    automaticPolling: input.automaticPolling === true,
  });

  if (!decision.emit) {
    return { emitted: false, reason: decision.reason };
  }

  const event = buildPilotControlDomainEvent(input);
  const { safe, stripped } = scrubDomainEventPayload(input.payload ?? {});

  try {
    await recordPilotControlAuditEvent({
      tenantId: event.tenantId,
      programmeId: event.programmeId,
      enrolmentId: event.enrolmentId ?? null,
      patientId: event.patientId ?? null,
      eventKind: event.eventType,
      actorType: event.actorType,
      actorId: event.actorId ?? null,
      correlationId: event.correlationId ?? null,
      payload: {
        ...safe,
        idempotencyKey: event.idempotencyKey,
        evidenceClass: event.evidenceClass,
        sourceRecordId: event.sourceRecordId ?? null,
        actorRole: event.actorRole ?? null,
        isSynthetic: classifySyntheticEvidence(event.evidenceClass),
        ...(stripped.length > 0 ? { sensitiveKeysStripped: stripped.length } : {}),
      },
      supabase: input.supabase,
    });
    rememberKey(input.idempotencyKey);
    return { emitted: true, event };
  } catch (err) {
    console.error(
      "pilot_pathway_event_write_failed",
      err instanceof Error ? err.message.slice(0, 200) : "unknown"
    );
    return { emitted: false, reason: "write_failed", writeFailed: true, event };
  }
}

export function __resetPilotPathwayIdempotencyForTests(): void {
  recentKeys.clear();
}
