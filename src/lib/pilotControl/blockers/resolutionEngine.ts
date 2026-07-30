/**
 * Resolution / dismissal rules (1A.3).
 * Resolution is determined from canonical source state, not manual acknowledgement.
 */

import type { PilotBlockerResolutionState } from "../pilotControlContracts";
import type { PilotBlockerCandidate, PilotBlockerRecord, PersistedBlockerSnapshot } from "./blockerTypes";

export type ResolutionDecision =
  | { action: "keep_open"; reason: string }
  | { action: "resolve"; reason: string }
  | { action: "supersede"; reason: string; supersededByFingerprint?: string };

/**
 * Active blocker whose fingerprint is absent from current candidates is resolved
 * (source condition no longer present), unless superseded by a replacement record.
 */
export function decideResolution(args: {
  existing: PersistedBlockerSnapshot | PilotBlockerRecord;
  matchingCandidate: PilotBlockerCandidate | undefined;
  /** Fingerprint of a newer candidate that replaces this source record. */
  replacementFingerprint?: string;
}): ResolutionDecision {
  const { existing, matchingCandidate, replacementFingerprint } = args;
  const state =
    "state" in existing
      ? existing.state
      : (existing as PilotBlockerRecord).state;

  if (state === "resolved" || state === "superseded" || state === "dismissed") {
    return { action: "keep_open", reason: "already_terminal" };
  }

  if (replacementFingerprint && replacementFingerprint !== fingerprintOf(existing)) {
    return {
      action: "supersede",
      reason: "source_record_superseded",
      supersededByFingerprint: replacementFingerprint,
    };
  }

  if (!matchingCandidate) {
    return {
      action: "resolve",
      reason: "source_condition_no_longer_present",
    };
  }

  return { action: "keep_open", reason: "source_condition_persists" };
}

function fingerprintOf(
  existing: PersistedBlockerSnapshot | PilotBlockerRecord
): string {
  return "fingerprint" in existing
    ? existing.fingerprint
    : (existing as PilotBlockerRecord).fingerprint;
}

/**
 * Manual acknowledgement must never resolve a blocker.
 */
export function acknowledgeDoesNotResolve(
  state: PilotBlockerResolutionState
): PilotBlockerResolutionState {
  if (state === "resolved" || state === "superseded" || state === "dismissed") {
    return state;
  }
  return "acknowledged";
}

/**
 * Categories that cannot be dismissed through ordinary flow.
 */
export function dismissalAllowedForBlocker(args: {
  criticalIntegrity: boolean;
  category: string;
  severity: string;
  dismissalAllowedFromRule: boolean;
}): { allowed: boolean; reason: string } {
  if (args.criticalIntegrity) {
    return { allowed: false, reason: "critical_integrity_cannot_dismiss" };
  }
  if (args.severity === "critical") {
    return { allowed: false, reason: "critical_severity_cannot_dismiss" };
  }
  const blockedCategories = new Set([
    "identity",
    "consent",
    "payment_reconciliation",
    "clinical_review",
    "pathology",
    "governance_approval",
  ]);
  if (blockedCategories.has(args.category) && !args.dismissalAllowedFromRule) {
    return { allowed: false, reason: "category_dismissal_forbidden" };
  }
  if (!args.dismissalAllowedFromRule) {
    return { allowed: false, reason: "rule_forbids_dismissal" };
  }
  return { allowed: true, reason: "false_positive_or_invalid_derived" };
}

/**
 * Apply dismissal — retains audit fields; does not delete.
 */
export function applyDismissal(args: {
  blocker: PilotBlockerRecord;
  reason: string;
  actorId: string;
  asOf: string;
}): { ok: true; blocker: PilotBlockerRecord } | { ok: false; reason: string } {
  const gate = dismissalAllowedForBlocker({
    criticalIntegrity: args.blocker.criticalIntegrity,
    category: args.blocker.category,
    severity: args.blocker.severity,
    dismissalAllowedFromRule: !args.blocker.criticalIntegrity && args.blocker.severity !== "critical",
  });
  if (!gate.allowed) {
    return { ok: false, reason: gate.reason };
  }
  return {
    ok: true,
    blocker: {
      ...args.blocker,
      state: "dismissed",
      dismissalReason: args.reason,
      dismissedBy: args.actorId,
      resolvedAt: args.asOf,
      resolutionReason: `dismissed:${args.reason}`,
      lastConfirmedAt: args.asOf,
    },
  };
}
