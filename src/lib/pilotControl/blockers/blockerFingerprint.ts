/**
 * Stable blocker fingerprinting (1A.3).
 * Must not depend on evaluation timestamp, display wording, temporary correlation IDs,
 * patient names, or mutable summary text.
 */

import { createHash } from "node:crypto";

import type { PilotBlockerCandidate } from "./blockerTypes";

export type FingerprintInput = PilotBlockerCandidate["fingerprintParts"];

/**
 * Deterministic fingerprint from stable identity of the source problem.
 * Format: sha256 hex of pipe-delimited canonical fields (truncated to 40 for storage).
 */
export function buildBlockerFingerprint(parts: FingerprintInput): string {
  const normalised = [
    parts.programmeId.trim(),
    parts.tenantId.trim(),
    parts.patientId.trim(),
    parts.category,
    parts.sourceModule,
    parts.sourceSignalKey.trim(),
    (parts.sourceRecordId ?? "").trim(),
    parts.milestoneContext.trim(),
  ].join("|");

  return createHash("sha256").update(normalised, "utf8").digest("hex").slice(0, 40);
}

export function fingerprintFromCandidate(candidate: PilotBlockerCandidate): string {
  return buildBlockerFingerprint(candidate.fingerprintParts);
}

/** Same source state must always produce the same fingerprint (idempotency proof helper). */
export function fingerprintsEqual(a: FingerprintInput, b: FingerprintInput): boolean {
  return buildBlockerFingerprint(a) === buildBlockerFingerprint(b);
}
