/**
 * FI-CONTROLLED-PILOT-CONTROL-CENTRE-1A.4 — rate limits + abuse controls (pure + in-memory).
 * Process-local; sufficient for single-instance / acceptance proofs. Not a distributed limiter.
 */

export const PILOT_CONTROL_RATE_LIMITS = {
  /** Per-user requests per rolling minute across pilot-control routes. */
  perUserPerMinute: 120,
  /** Export requests per user per rolling 10 minutes. */
  exportPerUserPer10Minutes: 5,
  /** Max concurrent evaluations tracked per user (soft). */
  maxSimultaneousEvaluations: 3,
} as const;

type Bucket = { timestamps: number[] };

const requestBuckets = new Map<string, Bucket>();
const exportBuckets = new Map<string, Bucket>();
const evaluationCounts = new Map<string, number>();

function prune(bucket: Bucket, windowMs: number, now: number): void {
  bucket.timestamps = bucket.timestamps.filter((t) => now - t < windowMs);
}

function take(
  map: Map<string, Bucket>,
  key: string,
  limit: number,
  windowMs: number,
  now = Date.now()
): { allowed: boolean; remaining: number } {
  const bucket = map.get(key) ?? { timestamps: [] };
  prune(bucket, windowMs, now);
  if (bucket.timestamps.length >= limit) {
    map.set(key, bucket);
    return { allowed: false, remaining: 0 };
  }
  bucket.timestamps.push(now);
  map.set(key, bucket);
  return { allowed: true, remaining: Math.max(0, limit - bucket.timestamps.length) };
}

export function checkPilotControlRequestRateLimit(actorKey: string): {
  allowed: boolean;
  remaining: number;
} {
  return take(
    requestBuckets,
    actorKey,
    PILOT_CONTROL_RATE_LIMITS.perUserPerMinute,
    60_000
  );
}

export function checkPilotControlExportRateLimit(actorKey: string): {
  allowed: boolean;
  remaining: number;
} {
  return take(
    exportBuckets,
    actorKey,
    PILOT_CONTROL_RATE_LIMITS.exportPerUserPer10Minutes,
    10 * 60_000
  );
}

export function beginPilotControlEvaluation(actorKey: string): boolean {
  const n = evaluationCounts.get(actorKey) ?? 0;
  if (n >= PILOT_CONTROL_RATE_LIMITS.maxSimultaneousEvaluations) return false;
  evaluationCounts.set(actorKey, n + 1);
  return true;
}

export function endPilotControlEvaluation(actorKey: string): void {
  const n = evaluationCounts.get(actorKey) ?? 0;
  if (n <= 1) evaluationCounts.delete(actorKey);
  else evaluationCounts.set(actorKey, n - 1);
}

/** Test-only reset. */
export function __resetPilotControlRateLimitsForTests(): void {
  requestBuckets.clear();
  exportBuckets.clear();
  evaluationCounts.clear();
}
