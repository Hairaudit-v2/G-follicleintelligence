/**
 * OnboardingOS tenant provisioning step processing lease — pure helpers.
 * Safe for unit tests; no server-only imports.
 */

import type { ProvisioningStepStatus } from "@/src/lib/onboarding-os/tenantProvisioningTypes";

/** Stale `running` steps older than this may be reclaimed for retry. */
export const TENANT_PROVISIONING_STEP_LEASE_MINUTES = 15;

export type ProvisioningStepRetryEligibility =
  | { kind: "eligible"; mode: "failed" | "retry_pending" | "stale_running" }
  | { kind: "blocked"; reason: "fresh_running" | "not_retryable" | "max_attempts" };

export type ProvisioningStepLeaseAudit = {
  reclaim_reason: "stale_running_step";
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

export function incrementReclaimCount(
  metadata: Record<string, unknown> | null | undefined
): number {
  return readProvisioningStepLeaseReclaimCount(metadata) + 1;
}

export function buildProvisioningStepReclaimMetadata(input: {
  existingMetadata: Record<string, unknown>;
  previousRunningAt: string;
  reclaimedAt: string;
  attemptCountAtReclaim: number;
}): Record<string, unknown> {
  const lease: ProvisioningStepLeaseAudit = {
    reclaim_reason: "stale_running_step",
    previous_running_at: input.previousRunningAt,
    reclaimed_at: input.reclaimedAt,
    reclaim_count: incrementReclaimCount(input.existingMetadata),
    attempt_count_at_reclaim: input.attemptCountAtReclaim,
  };
  return {
    ...input.existingMetadata,
    _provisioning_step_lease: lease,
  };
}

/** Whether an operator retry request may proceed (failed, retry_pending, or stale running). */
export function resolveProvisioningStepRetryEligibility(opts: {
  status: ProvisioningStepStatus;
  attemptCount: number;
  maxAttempts: number;
  updatedAt: string;
  nowMs?: number;
}): ProvisioningStepRetryEligibility {
  const nowMs = opts.nowMs ?? Date.now();

  if (opts.status === "running") {
    if (!isProvisioningStepLeaseStale(opts.updatedAt, nowMs)) {
      return { kind: "blocked", reason: "fresh_running" };
    }
    return { kind: "eligible", mode: "stale_running" };
  }

  if (opts.status !== "failed" && opts.status !== "retry_pending") {
    return { kind: "blocked", reason: "not_retryable" };
  }

  if (opts.attemptCount >= opts.maxAttempts) {
    return { kind: "blocked", reason: "max_attempts" };
  }

  return { kind: "eligible", mode: opts.status };
}