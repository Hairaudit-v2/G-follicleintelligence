/**
 * SurgeryOS graft reconciliation — tray review derivation and the reconciliation gate.
 */

import {
  computeRemainingGrafts,
  type SurgeryOsGraftComposition,
  type SurgeryOsGraftCountEventType,
} from "@/src/lib/surgeryOs/surgeryOsGraftCounting";
import type { SurgeryOsMajorPhase } from "@/src/lib/surgeryOs/surgeryOsPolicy";

export const SURGERY_OS_GRAFT_RECONCILIATION_STATUSES = [
  "pending",
  "balanced",
  "mismatch",
  "completed",
] as const;
export type SurgeryOsGraftReconciliationStatus =
  (typeof SURGERY_OS_GRAFT_RECONCILIATION_STATUSES)[number];

export const SURGERY_OS_GRAFT_RECONCILIATION_STATUS_LABELS: Record<
  SurgeryOsGraftReconciliationStatus,
  string
> = {
  pending: "Pending",
  balanced: "Balanced",
  mismatch: "Mismatch",
  completed: "Completed",
};

export type SurgeryOsGraftReconciliationGateResult =
  | { ok: true }
  | { ok: false; reasons: string[] };

export type SurgeryOsConfirmedTrayTotals = SurgeryOsGraftComposition & {
  damaged: number;
  totalHairs: number;
  trayCount: number;
};

export type TrayReviewStatus = "pending" | "confirmed" | "rejected";

export function deriveTrayReviewStatuses(
  events: Array<{
    id: string;
    eventType: SurgeryOsGraftCountEventType;
    note: string | null;
    createdAt: string;
  }>
): Map<string, TrayReviewStatus> {
  const out = new Map<string, TrayReviewStatus>();
  const sorted = [...events].sort((a, b) => a.createdAt.localeCompare(b.createdAt));

  for (const event of sorted) {
    if (event.eventType !== "tray_count") continue;
    out.set(event.id, "pending");
  }

  for (const event of sorted) {
    if (event.eventType !== "tray_confirmed" && event.eventType !== "tray_rejected") continue;
    const label = event.note ?? "";
    for (const [trayId, status] of out) {
      if (status !== "pending") continue;
      const trayEvent = sorted.find((e) => e.id === trayId);
      if (!trayEvent?.note) continue;
      if (label.includes(trayEvent.note)) {
        out.set(trayId, event.eventType === "tray_confirmed" ? "confirmed" : "rejected");
      }
    }
  }

  return out;
}

export function deriveTrayReviewStatusForEvent(
  trayEventId: string,
  events: Array<{
    id: string;
    eventType: SurgeryOsGraftCountEventType;
    note: string | null;
    createdAt: string;
  }>
): TrayReviewStatus {
  return deriveTrayReviewStatuses(events).get(trayEventId) ?? "pending";
}

export function countTrayReviewBuckets(
  events: Array<{ eventType: SurgeryOsGraftCountEventType; reviewStatus?: TrayReviewStatus | null }>
): { pending: number; confirmed: number; rejected: number; total: number } {
  let pending = 0;
  let confirmed = 0;
  let rejected = 0;
  for (const event of events) {
    if (event.eventType !== "tray_count") continue;
    const status = event.reviewStatus ?? "pending";
    if (status === "confirmed") confirmed += 1;
    else if (status === "rejected") rejected += 1;
    else pending += 1;
  }
  return { pending, confirmed, rejected, total: pending + confirmed + rejected };
}

export function computeConfirmedTrayTotals(
  events: Array<{
    eventType: SurgeryOsGraftCountEventType;
    reviewStatus?: TrayReviewStatus | null;
    singles: number | null;
    doubles: number | null;
    triples: number | null;
    multiples: number | null;
    totalHairs: number | null;
    deltaDiscarded: number;
  }>
): SurgeryOsConfirmedTrayTotals {
  const out: SurgeryOsConfirmedTrayTotals = {
    singles: 0,
    doubles: 0,
    triples: 0,
    multiples: 0,
    damaged: 0,
    totalHairs: 0,
    trayCount: 0,
  };

  for (const event of events) {
    if (event.eventType !== "tray_count" || event.reviewStatus !== "confirmed") continue;
    out.singles += event.singles ?? 0;
    out.doubles += event.doubles ?? 0;
    out.triples += event.triples ?? 0;
    out.multiples += event.multiples ?? 0;
    out.damaged += event.deltaDiscarded ?? 0;
    out.totalHairs += event.totalHairs ?? 0;
    out.trayCount += 1;
  }

  return out;
}

export function assessGraftReconciliationGate(input: {
  extractedGrafts: number;
  implantedGrafts: number;
  discardedGrafts: number;
  remainingGrafts: number;
  reconciliationStatus: SurgeryOsGraftReconciliationStatus;
  pendingTrayCount: number;
  requireCompleted?: boolean;
  /** When FI_IMAGING_REQUIRE_GRAFT_TRAY_CAPTURE=true */
  trayImageCount?: number;
  requireTrayCapture?: boolean;
}): SurgeryOsGraftReconciliationGateResult {
  const reasons: string[] = [];

  if (input.requireTrayCapture === true) {
    const trayCount = input.trayImageCount ?? 0;
    if (trayCount < 1) {
      reasons.push(
        "At least one graft tray photo is required before final reconciliation. Open Surgery Day capture and photograph the graft tray."
      );
    }
  }

  if (input.implantedGrafts > input.extractedGrafts) {
    reasons.push("Implanted grafts cannot exceed extracted grafts.");
  }

  const expectedRemaining = computeRemainingGrafts(
    input.extractedGrafts,
    input.implantedGrafts,
    input.discardedGrafts
  );
  if (input.remainingGrafts !== 0 || expectedRemaining !== 0) {
    reasons.push(
      `Graft balance unresolved: ${input.remainingGrafts} graft(s) unaccounted (extracted − implanted − discarded must equal zero).`
    );
  }

  if (input.pendingTrayCount > 0) {
    reasons.push(`${input.pendingTrayCount} tray(s) still awaiting nurse review.`);
  }

  if (input.requireCompleted !== false && input.reconciliationStatus !== "completed") {
    reasons.push("Graft reconciliation must be completed by a surgeon or manager.");
  }

  return reasons.length ? { ok: false, reasons } : { ok: true };
}

export function assertGraftReconciliationGate(input: {
  extractedGrafts: number;
  implantedGrafts: number;
  discardedGrafts: number;
  remainingGrafts: number;
  reconciliationStatus: SurgeryOsGraftReconciliationStatus;
  pendingTrayCount: number;
  requireCompleted?: boolean;
  trayImageCount?: number;
  requireTrayCapture?: boolean;
}): void {
  const result = assessGraftReconciliationGate(input);
  if (!result.ok) {
    throw new Error(result.reasons.join(" "));
  }
}

export function shouldBlockSurgeryPhaseForGraftReconciliation(
  toPhase: SurgeryOsMajorPhase
): boolean {
  return toPhase === "recovery" || toPhase === "complete";
}

export function deriveReconciliationStatus(
  extracted: number,
  implanted: number,
  discarded: number,
  remaining: number,
  explicitlyCompleted: boolean
): SurgeryOsGraftReconciliationStatus {
  if (explicitlyCompleted) return "completed";
  if (remaining === 0 && extracted === implanted + discarded) return "balanced";
  if (remaining !== 0 || implanted + discarded > extracted) return "mismatch";
  return "pending";
}
