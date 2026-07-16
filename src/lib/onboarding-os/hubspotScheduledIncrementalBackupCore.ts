/**
 * FI-HUBSPOT-BACKUP-1 Stage P3 — pure scheduled cutoff helpers (no I/O).
 */

import {
  isHubspotIncrementalDataset,
  parseStrictUtcTimestamp,
  type HubspotIncrementalDataset,
  type IncrementalRange,
} from "./hubspotIncrementalBackupCore";

export const HUBSPOT_SCHEDULED_INCREMENTAL_SOURCE = "vercel_cron";
export const HUBSPOT_SCHEDULED_CADENCE_CRON_UTC = "0 16 * * *";
export const HUBSPOT_SCHEDULED_LOCAL_TZ = "Australia/Brisbane";
export const HUBSPOT_SCHEDULED_LOCAL_TIME = "02:00";
/** 02:00 Australia/Brisbane = 16:00 UTC (Brisbane has no DST). */
export const HUBSPOT_SCHEDULED_UTC_TIME = "16:00";

export const HUBSPOT_SCHEDULED_MAX_TRANSIENT_ATTEMPTS = 3;
export const HUBSPOT_SCHEDULED_BASE_BACKOFF_MS = 1_000;

export type ScheduledOutcome =
  | "success"
  | "empty_success"
  | "partial"
  | "failure"
  | "overlap_blocked"
  | "missing_watermark"
  | "missing_credentials"
  | "validation_error"
  | "disabled"
  | "stuck_requires_intervention";

export type ScheduledCutoffPlan = {
  dataset: HubspotIncrementalDataset;
  cutoffFrom: string;
  cutoffTo: string;
  watermarkBefore: string;
  range: IncrementalRange;
};

export function resolveScheduledDataset(raw: string | null | undefined): HubspotIncrementalDataset {
  const value = (raw ?? "notes").trim() || "notes";
  if (!isHubspotIncrementalDataset(value)) {
    throw new Error(`Unsupported scheduled dataset "${value}". Supported: notes.`);
  }
  return value;
}

/**
 * Build immutable cutoffs for a scheduled invocation.
 * cutoff-from = verified watermark; cutoff-to = frozen scheduler invocation time.
 */
export function buildScheduledCutoffs(input: {
  dataset?: string | null;
  watermarkTimestamp: string | null | undefined;
  invocationTimeIso: string;
}): ScheduledCutoffPlan {
  const dataset = resolveScheduledDataset(input.dataset);
  if (!input.watermarkTimestamp?.trim()) {
    throw new Error("Missing verified notes watermark. Refuse to schedule a full-history backup.");
  }
  const watermark = parseStrictUtcTimestamp(
    new Date(input.watermarkTimestamp).toISOString(),
    "watermark"
  );
  const cutoffTo = parseStrictUtcTimestamp(input.invocationTimeIso, "cutoff-to");
  if (!(cutoffTo.epochMs > watermark.epochMs)) {
    throw new Error(
      `Scheduled cutoff-to (${cutoffTo.iso}) must be strictly later than watermark (${watermark.iso}).`
    );
  }
  return {
    dataset,
    cutoffFrom: watermark.iso,
    cutoffTo: cutoffTo.iso,
    watermarkBefore: watermark.iso,
    range: { cutoffFrom: watermark, cutoffTo },
  };
}

export function classifyScheduledOutcome(input: {
  ok: boolean;
  exitHint?: "conflict" | "validation" | "failed";
  status?: "completed" | "partial" | "failed";
  verificationState?: "passed" | "failed" | "pending";
  emptyRange?: boolean;
  error?: string;
}): ScheduledOutcome {
  if (!input.ok) {
    if (input.exitHint === "conflict") return "overlap_blocked";
    if (input.exitHint === "validation") {
      const msg = (input.error ?? "").toLowerCase();
      if (msg.includes("watermark")) return "missing_watermark";
      if (msg.includes("credential")) return "missing_credentials";
      return "validation_error";
    }
    return "failure";
  }
  if (input.status === "partial") return "partial";
  if (input.status === "failed" || input.verificationState === "failed") return "failure";
  if (input.status === "completed" && input.verificationState === "passed") {
    return input.emptyRange ? "empty_success" : "success";
  }
  return "failure";
}

export function isTransientScheduledError(error: unknown): boolean {
  if (!error || typeof error !== "object") return false;
  const status = Number((error as { status?: number }).status);
  const category = String((error as { category?: string }).category ?? "");
  if (status === 429 || category === "rate_limit") return true;
  if (status >= 500 || category === "network") return true;
  const message = String((error as { message?: string }).message ?? "").toLowerCase();
  return (
    message.includes("429") ||
    message.includes("rate limit") ||
    message.includes("timeout") ||
    message.includes("econnreset") ||
    message.includes("fetch failed")
  );
}

export function computeScheduledBackoffMs(
  attemptIndexZeroBased: number,
  baseMs = HUBSPOT_SCHEDULED_BASE_BACKOFF_MS
): number {
  const capped = Math.min(Math.max(attemptIndexZeroBased, 0), 5);
  return baseMs * 2 ** capped;
}

export function nextDailyBrisbaneRunUtc(from: Date = new Date()): string {
  const candidate = new Date(
    Date.UTC(from.getUTCFullYear(), from.getUTCMonth(), from.getUTCDate(), 16, 0, 0, 0)
  );
  if (candidate.getTime() <= from.getTime()) {
    candidate.setUTCDate(candidate.getUTCDate() + 1);
  }
  return candidate.toISOString();
}
