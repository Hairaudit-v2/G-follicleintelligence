/**
 * Stage 11: shadow-only internal bus emission for `hairaudit.audit.completed`.
 * Not a producer HTTP event — derived after successful `hairaudit.images.uploaded` ingest
 * when `isInternalIntelligenceBusShadowEnabled()` is true.
 */

import type { FiEventEnvelope } from "@/src/types/fi-events";
import type { IntelligenceEventEnvelope } from "@follicle/intelligence-core";
import { toIntelligenceEventEnvelope } from "./intelligenceCoreAdapter";
import { emitInternalIntelligenceEvent } from "./internalBus";
import { isInternalIntelligenceBusShadowEnabled, type InternalBusShadowEnvOptions } from "./internalBusEnv";
import { enqueueInternalIntelligenceEvent } from "./internalBusQueue";
import { isInternalIntelligenceInternalBusQueueEnabled } from "./internalBusQueueEnv";

export type FiHairAuditImagesUploadedEnvelope = FiEventEnvelope & { event_type: "hairaudit.images.uploaded" };

/**
 * Builds a canonical intelligence envelope for `hairaudit.audit.completed` using the
 * adapter on the images-uploaded FI envelope, then rewrites `event_name` for the shadow bus.
 * In-memory only; never persisted by this module.
 */
export function buildShadowHairAuditAuditCompletedIntelligenceEnvelope(
  fi: FiHairAuditImagesUploadedEnvelope
): IntelligenceEventEnvelope {
  const { envelope } = toIntelligenceEventEnvelope(fi);
  return {
    ...envelope,
    event_name: "hairaudit.audit.completed",
  };
}

/**
 * Emits shadow bus event when shadow mode is enabled. Swallows all errors (logs only).
 * When Stage 12 queue is enabled (`FI_INTELLIGENCE_INTERNAL_BUS_QUEUE_ENABLED === "1"`, non-production),
 * enqueues a sanitized copy instead of calling `emitInternalIntelligenceEvent` directly.
 * Does not change ingest outcomes or handler behavior.
 */
export async function maybeEmitShadowHairAuditAuditCompletedFromImagesIngest(
  envelope: FiEventEnvelope,
  shadowEnv?: InternalBusShadowEnvOptions
): Promise<void> {
  if (envelope.event_type !== "hairaudit.images.uploaded") return;
  if (!isInternalIntelligenceBusShadowEnabled(shadowEnv)) return;

  try {
    const shadowEnvelope = buildShadowHairAuditAuditCompletedIntelligenceEnvelope(
      envelope as FiHairAuditImagesUploadedEnvelope
    );
    if (isInternalIntelligenceInternalBusQueueEnabled(shadowEnv)) {
      await enqueueInternalIntelligenceEvent(shadowEnvelope, shadowEnv);
    } else {
      await emitInternalIntelligenceEvent(shadowEnvelope, { mode: "inline_dev_only" });
    }
  } catch (err) {
    console.error("[FI_INTELLIGENCE_INTERNAL_BUS_SHADOW] emit failed (non-fatal)", err);
  }
}
