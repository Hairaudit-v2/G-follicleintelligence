/** Stale `processing` rows older than this may be reclaimed for retry. */
export const FI_EVENT_PROCESSING_LEASE_MINUTES = 15;

export type FiProcessingLeaseAudit = {
  reclaim_reason: "stale_processing_lease";
  previous_processing_at: string;
  reclaimed_at: string;
  reclaim_count: number;
};

export function isFiEventProcessingLeaseStale(
  processingUpdatedAtIso: string,
  nowMs: number = Date.now()
): boolean {
  const updatedMs = Date.parse(processingUpdatedAtIso);
  if (!Number.isFinite(updatedMs)) return true;
  return nowMs - updatedMs > FI_EVENT_PROCESSING_LEASE_MINUTES * 60_000;
}

export function readFiProcessingLeaseReclaimCount(
  payloadJson: Record<string, unknown> | null | undefined
): number {
  const lease = payloadJson?._fi_processing_lease;
  if (!lease || typeof lease !== "object") return 0;
  const count = Number((lease as { reclaim_count?: unknown }).reclaim_count ?? 0);
  return Number.isFinite(count) && count >= 0 ? Math.floor(count) : 0;
}

export function buildStaleProcessingReclaimPayloadPatch(input: {
  existingPayload: Record<string, unknown>;
  previousProcessingAt: string;
  reclaimedAt: string;
}): Record<string, unknown> {
  const previousCount = readFiProcessingLeaseReclaimCount(input.existingPayload);
  const lease: FiProcessingLeaseAudit = {
    reclaim_reason: "stale_processing_lease",
    previous_processing_at: input.previousProcessingAt,
    reclaimed_at: input.reclaimedAt,
    reclaim_count: previousCount + 1,
  };
  return {
    ...input.existingPayload,
    _fi_processing_lease: lease,
  };
}