/**
 * OnboardingOS tenant provisioning step processing lease — pure helpers.
 * Safe for unit tests; no server-only imports.
 */

/** Stale `running` steps older than this may be reclaimed for retry. */
export const TENANT_PROVISIONING_STEP_LEASE_MINUTES = 15;

export type ProvisioningStepLeaseAudit = {
  reclaim_reason: "stale_running_lease";
  previous_running_at: string;
  reclaimed_at: string;
  reclaim_count: number;
  attempt_count_at_reclaim: number;
};

export function isProvisioningStepLeaseStale(
  runningUpdatedAtIso: string,
  nowMs: number = Date.now()
): boolean {
  const updatedMs = Date.parse(runningUpdatedAtIso);
  if (!Number.isFinite(updatedMs)) return true;
  return nowMs - updatedMs > TENANT_PROVISIONING_STEP_LEASE_MINUTES * 60_000;
}

export function readProvisioningStepLeaseReclaimCount(
  metadata: Record<string, unknown> | null | undefined
): number {
  const lease = metadata?._provisioning_step_lease;
  if (!lease || typeof lease !== "object") return 0;
  const count = Number((lease as { reclaim_count?: unknown }).reclaim_count ?? 0);
  return Number.isFinite(count) && count >= 0 ? Math.floor(count) : 0;
}

export function buildStaleProvisioningStepReclaimMetadataPatch(input: {
  existingMetadata: Record<string, unknown>;
  previousRunningAt: string;
  reclaimedAt: string;
  attemptCountAtReclaim: number;
}): Record<string, unknown> {
  const previousCount = readProvisioningStepLeaseReclaimCount(input.existingMetadata);
  const lease: ProvisioningStepLeaseAudit = {
    reclaim_reason: "stale_running_lease",
    previous_running_at: input.previousRunningAt,
    reclaimed_at: input.reclaimedAt,
    reclaim_count: previousCount + 1,
    attempt_count_at_reclaim: input.attemptCountAtReclaim,
  };
  return {
    ...input.existingMetadata,
    _provisioning_step_lease: lease,
  };
}