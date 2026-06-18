/**
 * SurgeryOS Phase 2 — pure graft count model, reconciliation, and alert derivation.
 */

import type { SurgeryOsProcedurePhase, SurgeryOsSeverity } from "@/src/lib/surgeryOs/surgeryOsBoardModel";

export const SURGERY_OS_GRAFT_SESSION_PHASES = [
  "extraction",
  "implantation",
  "tray_count",
  "reconciliation",
] as const;
export type SurgeryOsGraftSessionPhase = (typeof SURGERY_OS_GRAFT_SESSION_PHASES)[number];

export const SURGERY_OS_GRAFT_SESSION_PHASE_LABELS: Record<SurgeryOsGraftSessionPhase, string> = {
  extraction: "Extraction",
  implantation: "Implantation",
  tray_count: "Tray count",
  reconciliation: "Reconciliation",
};

export const SURGERY_OS_GRAFT_COUNT_EVENT_TYPES = [
  "count_update",
  "tray_count",
  "tray_confirmed",
  "tray_rejected",
  "graft_reconciliation",
  "discard_logged",
  "correction",
] as const;

export const SURGERY_OS_GRAFT_TYPES = ["single", "double", "triple", "multiple"] as const;
export type SurgeryOsGraftType = (typeof SURGERY_OS_GRAFT_TYPES)[number];

export const SURGERY_OS_GRAFT_TYPE_LABELS: Record<SurgeryOsGraftType, string> = {
  single: "Single",
  double: "Double",
  triple: "Triple",
  multiple: "Multiple",
};

/** Hairs per graft type for auto-calculation during quick tap. */
export const SURGERY_OS_GRAFT_TYPE_HAIR_WEIGHTS: Record<SurgeryOsGraftType, number> = {
  single: 1,
  double: 2,
  triple: 3,
  multiple: 4,
};

/** Corrections at or above this delta require a mandatory note. */
export const SURGERY_OS_GRAFT_LARGE_CORRECTION_THRESHOLD = 10;
export type SurgeryOsGraftCountEventType = (typeof SURGERY_OS_GRAFT_COUNT_EVENT_TYPES)[number];

export const SURGERY_OS_GRAFT_COUNT_EVENT_TYPE_LABELS: Record<SurgeryOsGraftCountEventType, string> = {
  count_update: "Count update",
  tray_count: "Tray count",
  tray_confirmed: "Tray confirmed",
  tray_rejected: "Tray rejected",
  graft_reconciliation: "Reconciliation",
  discard_logged: "Discarded",
  correction: "Correction",
};

export const SURGERY_OS_GRAFT_RECONCILIATION_STATUSES = [
  "pending",
  "balanced",
  "mismatch",
  "completed",
] as const;
export type SurgeryOsGraftReconciliationStatus = (typeof SURGERY_OS_GRAFT_RECONCILIATION_STATUSES)[number];

export const SURGERY_OS_GRAFT_RECONCILIATION_STATUS_LABELS: Record<SurgeryOsGraftReconciliationStatus, string> = {
  pending: "Pending",
  balanced: "Balanced",
  mismatch: "Mismatch",
  completed: "Completed",
};

export const SURGERY_OS_GRAFT_ALERT_KINDS = [
  "graft_count_behind_target",
  "graft_extracted_implanted_mismatch",
  "graft_discarded_above_threshold",
  "graft_average_hairs_low",
  "graft_target_exceeded",
  "graft_reconciliation_incomplete",
  "graft_pending_tray_review",
  "graft_correction_above_threshold",
] as const;
export type SurgeryOsGraftAlertKind = (typeof SURGERY_OS_GRAFT_ALERT_KINDS)[number];

export const SURGERY_OS_GRAFT_ALERT_LABELS: Record<SurgeryOsGraftAlertKind, string> = {
  graft_count_behind_target: "Graft count behind target",
  graft_extracted_implanted_mismatch: "Extracted/implanted mismatch",
  graft_discarded_above_threshold: "Discarded grafts above threshold",
  graft_average_hairs_low: "Average hairs per graft low",
  graft_target_exceeded: "Target grafts exceeded",
  graft_reconciliation_incomplete: "Reconciliation incomplete",
  graft_pending_tray_review: "Trays awaiting nurse review",
  graft_correction_above_threshold: "Large graft correction logged",
};

/** Default alert thresholds — tune per tenant in a future phase. */
export const SURGERY_OS_GRAFT_DISCARDED_THRESHOLD_PERCENT = 0.05;
export const SURGERY_OS_GRAFT_DISCARDED_THRESHOLD_ABSOLUTE = 50;
export const SURGERY_OS_GRAFT_LOW_HAIRS_PER_GRAFT = 2.0;
export const SURGERY_OS_GRAFT_BEHIND_TARGET_RATIO = 0.5;
export const SURGERY_OS_GRAFT_TARGET_EXCEED_THRESHOLD_RATIO = 0.05;

/** Session lock TTL — stale locks can be taken over by another theatre tablet. */
export const SURGERY_OS_GRAFT_SESSION_LOCK_TTL_MS = 4 * 60 * 60 * 1000;

/** Surgery statuses eligible for graft counting without admin override. */
export const SURGERY_OS_GRAFT_COUNTING_ELIGIBLE_STATUSES = [
  "scheduled",
  "pre_op",
  "in_progress",
  "paused",
] as const;
export type SurgeryOsGraftCountingEligibleStatus = (typeof SURGERY_OS_GRAFT_COUNTING_ELIGIBLE_STATUSES)[number];

export type SurgeryOsGraftCountSessionLockKind = "extraction" | "implantation";

export type SurgeryOsGraftCountSessionLock = {
  kind: SurgeryOsGraftCountSessionLockKind;
  deviceId: string | null;
  heldAt: string | null;
  heldByFiUserId: string | null;
  heldByLabel: string | null;
  isHeldByDevice: boolean;
  isStale: boolean;
};

export type SurgeryOsConfirmedTrayTotals = SurgeryOsGraftComposition & {
  damaged: number;
  totalHairs: number;
  trayCount: number;
};

export type SurgeryOsGraftSummaryExport = {
  tenantName: string;
  patientLabel: string;
  surgeryId: string;
  exportedAt: string;
  targetGrafts: number | null;
  extractedGrafts: number;
  implantedGrafts: number;
  discardedGrafts: number;
  remainingGrafts: number;
  singles: number;
  doubles: number;
  triples: number;
  multiples: number;
  totalHairs: number;
  averageHairsPerGraft: number | null;
  trayCounts: {
    total: number;
    confirmed: number;
    rejected: number;
    pending: number;
  };
  confirmedTrayGrafts: number;
  correctionCount: number;
  reconciliationStatus: SurgeryOsGraftReconciliationStatus;
  reconciledAt: string | null;
  reconciledByLabel: string | null;
  reconciliationNote: string | null;
};

export type SurgeryOsGraftReconciliationGateResult =
  | { ok: true }
  | { ok: false; reasons: string[] };

export type SurgeryOsGraftComposition = {
  singles: number;
  doubles: number;
  triples: number;
  multiples: number;
};

export type SurgeryOsGraftTotals = {
  targetGrafts: number | null;
  extractedGrafts: number;
  implantedGrafts: number;
  discardedGrafts: number;
  remainingGrafts: number;
  totalHairs: number;
  averageHairsPerGraft: number | null;
  composition: SurgeryOsGraftComposition;
};

export type SurgeryOsGraftValidationResult =
  | { ok: true }
  | { ok: false; reason: string; code: "negative_count" | "over_implantation" | "invalid_delta" };

export function computeRemainingGrafts(
  extracted: number,
  implanted: number,
  discarded: number,
): number {
  return extracted - implanted - discarded;
}

export function computeAverageHairsPerGraft(
  totalHairs: number,
  graftCount: number,
): number | null {
  if (graftCount <= 0 || totalHairs <= 0) return null;
  return Math.round((totalHairs / graftCount) * 100) / 100;
}

export function computeGraftProgressPercent(extracted: number, target: number | null): number | null {
  if (target == null || target <= 0) return null;
  return Math.min(100, Math.round((extracted / target) * 100));
}

export function computeGraftCompositionTotal(composition: SurgeryOsGraftComposition): number {
  return composition.singles + composition.doubles + composition.triples + composition.multiples;
}

export function computeTrayHairTotal(composition: SurgeryOsGraftComposition): number {
  return (
    composition.singles * SURGERY_OS_GRAFT_TYPE_HAIR_WEIGHTS.single +
    composition.doubles * SURGERY_OS_GRAFT_TYPE_HAIR_WEIGHTS.double +
    composition.triples * SURGERY_OS_GRAFT_TYPE_HAIR_WEIGHTS.triple +
    composition.multiples * SURGERY_OS_GRAFT_TYPE_HAIR_WEIGHTS.multiple
  );
}

export function applyGraftTypeDelta(
  composition: SurgeryOsGraftComposition,
  graftType: SurgeryOsGraftType,
  count: number,
): SurgeryOsGraftComposition {
  const next = { ...composition };
  switch (graftType) {
    case "single":
      next.singles += count;
      break;
    case "double":
      next.doubles += count;
      break;
    case "triple":
      next.triples += count;
      break;
    case "multiple":
      next.multiples += count;
      break;
  }
  return next;
}

export function computeGraftCorrectionMagnitude(input: {
  previous: { extracted: number; implanted: number; discarded: number };
  next: { extracted: number; implanted: number; discarded: number };
}): number {
  return Math.max(
    Math.abs(input.next.extracted - input.previous.extracted),
    Math.abs(input.next.implanted - input.previous.implanted),
    Math.abs(input.next.discarded - input.previous.discarded),
  );
}

export function requiresLargeCorrectionNote(magnitude: number): boolean {
  return magnitude >= SURGERY_OS_GRAFT_LARGE_CORRECTION_THRESHOLD;
}

export function formatTrayCountNote(trayNumber: number, note?: string | null): string {
  const prefix = `Tray #${trayNumber}`;
  const trimmed = note?.trim();
  return trimmed ? `${prefix} — ${trimmed}` : prefix;
}

export function parseTrayNumberFromNote(note: string | null | undefined): number | null {
  if (!note?.trim()) return null;
  const match = note.match(/Tray\s*#(\d+)/i);
  if (!match) return null;
  const n = Number.parseInt(match[1], 10);
  return Number.isFinite(n) && n > 0 ? n : null;
}

export type TrayReviewStatus = "pending" | "confirmed" | "rejected";

export function deriveTrayReviewStatuses(
  events: Array<{ id: string; eventType: SurgeryOsGraftCountEventType; note: string | null; createdAt: string }>,
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

export function isSurgeryStatusEligibleForGraftCounting(
  status: string,
  options?: { allowAdminOverride?: boolean },
): boolean {
  if (options?.allowAdminOverride) return true;
  return (SURGERY_OS_GRAFT_COUNTING_ELIGIBLE_STATUSES as readonly string[]).includes(status);
}

export function isGraftCountSessionLockStale(heldAt: string | null, nowMs: number): boolean {
  if (!heldAt) return true;
  const heldMs = Date.parse(heldAt);
  if (!Number.isFinite(heldMs)) return true;
  return nowMs - heldMs > SURGERY_OS_GRAFT_SESSION_LOCK_TTL_MS;
}

export function resolveGraftCountSessionLock(input: {
  kind: SurgeryOsGraftCountSessionLockKind;
  deviceId: string | null;
  heldAt: string | null;
  heldByFiUserId: string | null;
  heldByLabel?: string | null;
  requestingDeviceId: string | null;
  nowMs: number;
}): SurgeryOsGraftCountSessionLock {
  const isStale = isGraftCountSessionLockStale(input.heldAt, input.nowMs);
  const isHeldByDevice =
    Boolean(input.deviceId) &&
    Boolean(input.requestingDeviceId) &&
    input.deviceId === input.requestingDeviceId &&
    !isStale;

  return {
    kind: input.kind,
    deviceId: input.deviceId,
    heldAt: input.heldAt,
    heldByFiUserId: input.heldByFiUserId,
    heldByLabel: input.heldByLabel ?? null,
    isHeldByDevice,
    isStale,
  };
}

export function canAcquireGraftCountSessionLock(input: {
  lockDeviceId: string | null;
  lockHeldAt: string | null;
  requestingDeviceId: string | null;
  nowMs: number;
}): boolean {
  if (!input.requestingDeviceId?.trim()) {
    return false;
  }
  if (!input.lockDeviceId?.trim()) return true;
  if (input.lockDeviceId === input.requestingDeviceId) return true;
  return isGraftCountSessionLockStale(input.lockHeldAt, input.nowMs);
}

export function assertGraftCountSessionLock(input: {
  kind: SurgeryOsGraftCountSessionLockKind;
  lockDeviceId: string | null;
  lockHeldAt: string | null;
  requestingDeviceId: string | null;
  nowMs: number;
}): void {
  if (!input.requestingDeviceId?.trim()) {
    throw new Error("A theatre device id is required for graft counting.");
  }
  if (
    !canAcquireGraftCountSessionLock({
      lockDeviceId: input.lockDeviceId,
      lockHeldAt: input.lockHeldAt,
      requestingDeviceId: input.requestingDeviceId,
      nowMs: input.nowMs,
    })
  ) {
    const phase = input.kind === "extraction" ? "extraction" : "implantation";
    throw new Error(
      `Another tablet holds the active ${phase} count session. Sync or wait for the lock to expire before counting.`,
    );
  }
}

export function countTrayReviewBuckets(
  events: Array<{ eventType: SurgeryOsGraftCountEventType; reviewStatus?: TrayReviewStatus | null }>,
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
  }>,
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

export function deriveTrayReviewStatusForEvent(
  trayEventId: string,
  events: Array<{ id: string; eventType: SurgeryOsGraftCountEventType; note: string | null; createdAt: string }>,
): TrayReviewStatus {
  return deriveTrayReviewStatuses(events).get(trayEventId) ?? "pending";
}

export function assessGraftReconciliationGate(input: {
  extractedGrafts: number;
  implantedGrafts: number;
  discardedGrafts: number;
  remainingGrafts: number;
  reconciliationStatus: SurgeryOsGraftReconciliationStatus;
  pendingTrayCount: number;
  requireCompleted?: boolean;
}): SurgeryOsGraftReconciliationGateResult {
  const reasons: string[] = [];

  if (input.implantedGrafts > input.extractedGrafts) {
    reasons.push("Implanted grafts cannot exceed extracted grafts.");
  }

  const expectedRemaining = computeRemainingGrafts(
    input.extractedGrafts,
    input.implantedGrafts,
    input.discardedGrafts,
  );
  if (input.remainingGrafts !== 0 || expectedRemaining !== 0) {
    reasons.push(
      `Graft balance unresolved: ${input.remainingGrafts} graft(s) unaccounted (extracted − implanted − discarded must equal zero).`,
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
}): void {
  const result = assessGraftReconciliationGate(input);
  if (!result.ok) {
    throw new Error(result.reasons.join(" "));
  }
}

export function shouldBlockSurgeryPhaseForGraftReconciliation(toPhase: string): boolean {
  return toPhase === "recovery" || toPhase === "complete";
}

export function buildGraftSummaryExport(input: {
  tenantName: string;
  patientLabel: string;
  surgeryId: string;
  exportedAt: string;
  totals: SurgeryOsGraftTotals;
  reconciliationStatus: SurgeryOsGraftReconciliationStatus;
  reconciledAt: string | null;
  reconciledByLabel: string | null;
  reconciliationNote: string | null;
  events: Array<{
    eventType: SurgeryOsGraftCountEventType;
    reviewStatus?: TrayReviewStatus | null;
    singles: number | null;
    doubles: number | null;
    triples: number | null;
    multiples: number | null;
    totalHairs: number | null;
    deltaDiscarded: number;
  }>;
}): SurgeryOsGraftSummaryExport {
  const trayBuckets = countTrayReviewBuckets(input.events);
  const confirmedTrayTotals = computeConfirmedTrayTotals(input.events);
  const correctionCount = input.events.filter((e) => e.eventType === "correction").length;

  return {
    tenantName: input.tenantName,
    patientLabel: input.patientLabel,
    surgeryId: input.surgeryId,
    exportedAt: input.exportedAt,
    targetGrafts: input.totals.targetGrafts,
    extractedGrafts: input.totals.extractedGrafts,
    implantedGrafts: input.totals.implantedGrafts,
    discardedGrafts: input.totals.discardedGrafts,
    remainingGrafts: input.totals.remainingGrafts,
    singles: input.totals.composition.singles,
    doubles: input.totals.composition.doubles,
    triples: input.totals.composition.triples,
    multiples: input.totals.composition.multiples,
    totalHairs: input.totals.totalHairs,
    averageHairsPerGraft: input.totals.averageHairsPerGraft,
    trayCounts: trayBuckets,
    confirmedTrayGrafts: computeGraftCompositionTotal(confirmedTrayTotals),
    correctionCount,
    reconciliationStatus: input.reconciliationStatus,
    reconciledAt: input.reconciledAt,
    reconciledByLabel: input.reconciledByLabel,
    reconciliationNote: input.reconciliationNote,
  };
}

export function deriveReconciliationStatus(
  extracted: number,
  implanted: number,
  discarded: number,
  remaining: number,
  explicitlyCompleted: boolean,
): SurgeryOsGraftReconciliationStatus {
  if (explicitlyCompleted) return "completed";
  if (remaining === 0 && extracted === implanted + discarded) return "balanced";
  if (remaining !== 0 || implanted + discarded > extracted) return "mismatch";
  return "pending";
}

export function validateGraftCountUpdate(input: {
  currentExtracted: number;
  currentImplanted: number;
  currentDiscarded: number;
  deltaExtracted: number;
  deltaImplanted: number;
  deltaDiscarded: number;
  allowOverImplantation?: boolean;
}): SurgeryOsGraftValidationResult {
  const { deltaExtracted, deltaImplanted, deltaDiscarded } = input;
  if (deltaExtracted < 0 || deltaImplanted < 0 || deltaDiscarded < 0) {
    return { ok: false, reason: "Graft count deltas cannot be negative.", code: "negative_count" };
  }
  if (deltaExtracted === 0 && deltaImplanted === 0 && deltaDiscarded === 0) {
    return { ok: false, reason: "At least one graft count delta is required.", code: "invalid_delta" };
  }

  const nextExtracted = input.currentExtracted + deltaExtracted;
  const nextImplanted = input.currentImplanted + deltaImplanted;
  const nextDiscarded = input.currentDiscarded + deltaDiscarded;

  if (nextExtracted < 0 || nextImplanted < 0 || nextDiscarded < 0) {
    return { ok: false, reason: "Graft counts cannot be negative.", code: "negative_count" };
  }

  if (!input.allowOverImplantation && nextImplanted > nextExtracted) {
    return {
      ok: false,
      reason: "Implanted grafts cannot exceed extracted grafts.",
      code: "over_implantation",
    };
  }

  if (nextImplanted + nextDiscarded > nextExtracted) {
    return {
      ok: false,
      reason: "Implanted plus discarded grafts cannot exceed extracted grafts.",
      code: "over_implantation",
    };
  }

  return { ok: true };
}

export function validateGraftCorrection(input: {
  extracted: number;
  implanted: number;
  discarded: number;
}): SurgeryOsGraftValidationResult {
  if (input.extracted < 0 || input.implanted < 0 || input.discarded < 0) {
    return { ok: false, reason: "Graft counts cannot be negative.", code: "negative_count" };
  }
  if (input.implanted > input.extracted) {
    return {
      ok: false,
      reason: "Implanted grafts cannot exceed extracted grafts.",
      code: "over_implantation",
    };
  }
  if (input.implanted + input.discarded > input.extracted) {
    return {
      ok: false,
      reason: "Implanted plus discarded grafts cannot exceed extracted grafts.",
      code: "over_implantation",
    };
  }
  return { ok: true };
}

export function buildGraftTotalsFromSession(input: {
  targetGrafts: number | null;
  extractedGrafts: number;
  implantedGrafts: number;
  discardedGrafts: number;
  singles: number;
  doubles: number;
  triples: number;
  multiples: number;
  totalHairs: number;
}): SurgeryOsGraftTotals {
  const remainingGrafts = computeRemainingGrafts(
    input.extractedGrafts,
    input.implantedGrafts,
    input.discardedGrafts,
  );
  const compositionTotal = computeGraftCompositionTotal({
    singles: input.singles,
    doubles: input.doubles,
    triples: input.triples,
    multiples: input.multiples,
  });
  const graftBasis = compositionTotal > 0 ? compositionTotal : input.extractedGrafts;

  return {
    targetGrafts: input.targetGrafts,
    extractedGrafts: input.extractedGrafts,
    implantedGrafts: input.implantedGrafts,
    discardedGrafts: input.discardedGrafts,
    remainingGrafts,
    totalHairs: input.totalHairs,
    averageHairsPerGraft: computeAverageHairsPerGraft(input.totalHairs, graftBasis),
    composition: {
      singles: input.singles,
      doubles: input.doubles,
      triples: input.triples,
      multiples: input.multiples,
    },
  };
}

export function deriveGraftAlerts(input: {
  surgeryId: string;
  patientLabel: string;
  procedurePhase: SurgeryOsProcedurePhase;
  totals: SurgeryOsGraftTotals;
  reconciliationStatus: SurgeryOsGraftReconciliationStatus;
  href: string | null;
  pendingTrayCount?: number;
  recentCorrectionMagnitude?: number | null;
}): Array<{
  id: string;
  kind: SurgeryOsGraftAlertKind;
  title: string;
  detail: string;
  severity: SurgeryOsSeverity;
  surgeryId: string;
  href: string | null;
}> {
  const alerts: Array<{
    id: string;
    kind: SurgeryOsGraftAlertKind;
    title: string;
    detail: string;
    severity: SurgeryOsSeverity;
    surgeryId: string;
    href: string | null;
  }> = [];

  const { totals, surgeryId, patientLabel, href } = input;
  const progress = computeGraftProgressPercent(totals.extractedGrafts, totals.targetGrafts);

  const targetExceedThreshold =
    totals.targetGrafts != null && totals.targetGrafts > 0
      ? Math.ceil(totals.targetGrafts * (1 + SURGERY_OS_GRAFT_TARGET_EXCEED_THRESHOLD_RATIO))
      : null;

  if (
    totals.targetGrafts != null &&
    totals.targetGrafts > 0 &&
    targetExceedThreshold != null &&
    totals.extractedGrafts > targetExceedThreshold
  ) {
    alerts.push({
      id: `${surgeryId}:graft_target_exceeded`,
      kind: "graft_target_exceeded",
      title: SURGERY_OS_GRAFT_ALERT_LABELS.graft_target_exceeded,
      detail: `${patientLabel} — extracted ${totals.extractedGrafts} vs target ${totals.targetGrafts} (threshold ${targetExceedThreshold}).`,
      severity: "warning",
      surgeryId,
      href,
    });
  }

  if (
    input.procedurePhase === "implantation" &&
    totals.targetGrafts != null &&
    totals.targetGrafts > 0 &&
    progress != null &&
    progress < SURGERY_OS_GRAFT_BEHIND_TARGET_RATIO * 100
  ) {
    alerts.push({
      id: `${surgeryId}:graft_count_behind_target`,
      kind: "graft_count_behind_target",
      title: SURGERY_OS_GRAFT_ALERT_LABELS.graft_count_behind_target,
      detail: `${patientLabel} — extraction at ${progress}% of ${totals.targetGrafts} target during implantation.`,
      severity: "critical",
      surgeryId,
      href,
    });
  }

  if (totals.implantedGrafts > totals.extractedGrafts) {
    alerts.push({
      id: `${surgeryId}:graft_extracted_implanted_mismatch`,
      kind: "graft_extracted_implanted_mismatch",
      title: SURGERY_OS_GRAFT_ALERT_LABELS.graft_extracted_implanted_mismatch,
      detail: `${patientLabel} — implantation exceeds extraction by ${totals.implantedGrafts - totals.extractedGrafts} graft(s).`,
      severity: "blocked",
      surgeryId,
      href,
    });
  } else if (totals.remainingGrafts !== 0 && totals.extractedGrafts > 0) {
    alerts.push({
      id: `${surgeryId}:graft_extracted_implanted_mismatch`,
      kind: "graft_extracted_implanted_mismatch",
      title: SURGERY_OS_GRAFT_ALERT_LABELS.graft_extracted_implanted_mismatch,
      detail: `${patientLabel} — ${totals.remainingGrafts} graft(s) unaccounted (extracted − implanted − discarded).`,
      severity: totals.remainingGrafts < 0 ? "blocked" : "warning",
      surgeryId,
      href,
    });
  }

  const discardedThreshold = Math.max(
    SURGERY_OS_GRAFT_DISCARDED_THRESHOLD_ABSOLUTE,
    Math.ceil(totals.extractedGrafts * SURGERY_OS_GRAFT_DISCARDED_THRESHOLD_PERCENT),
  );
  if (totals.discardedGrafts > 0 && totals.discardedGrafts >= discardedThreshold) {
    alerts.push({
      id: `${surgeryId}:graft_discarded_above_threshold`,
      kind: "graft_discarded_above_threshold",
      title: SURGERY_OS_GRAFT_ALERT_LABELS.graft_discarded_above_threshold,
      detail: `${patientLabel} — ${totals.discardedGrafts} discarded graft(s) (threshold ${discardedThreshold}).`,
      severity: "critical",
      surgeryId,
      href,
    });
  }

  if (
    totals.averageHairsPerGraft != null &&
    totals.averageHairsPerGraft < SURGERY_OS_GRAFT_LOW_HAIRS_PER_GRAFT &&
    totals.extractedGrafts > 0
  ) {
    alerts.push({
      id: `${surgeryId}:graft_average_hairs_low`,
      kind: "graft_average_hairs_low",
      title: SURGERY_OS_GRAFT_ALERT_LABELS.graft_average_hairs_low,
      detail: `${patientLabel} — average ${totals.averageHairsPerGraft} hairs/graft (below ${SURGERY_OS_GRAFT_LOW_HAIRS_PER_GRAFT}).`,
      severity: "warning",
      surgeryId,
      href,
    });
  }

  if ((input.pendingTrayCount ?? 0) > 0) {
    const severity = input.procedurePhase === "implantation" ? "critical" : "warning";
    alerts.push({
      id: `${surgeryId}:graft_pending_tray_review`,
      kind: "graft_pending_tray_review",
      title: SURGERY_OS_GRAFT_ALERT_LABELS.graft_pending_tray_review,
      detail: `${patientLabel} — ${input.pendingTrayCount} tray(s) awaiting nurse review.`,
      severity,
      surgeryId,
      href,
    });
  }

  if (
    input.recentCorrectionMagnitude != null &&
    requiresLargeCorrectionNote(input.recentCorrectionMagnitude)
  ) {
    alerts.push({
      id: `${surgeryId}:graft_correction_above_threshold`,
      kind: "graft_correction_above_threshold",
      title: SURGERY_OS_GRAFT_ALERT_LABELS.graft_correction_above_threshold,
      detail: `${patientLabel} — correction of ${input.recentCorrectionMagnitude} graft(s) logged (threshold ${SURGERY_OS_GRAFT_LARGE_CORRECTION_THRESHOLD}).`,
      severity: "warning",
      surgeryId,
      href,
    });
  }

  if (
    input.procedurePhase === "recovery" ||
    input.procedurePhase === "completed"
  ) {
    if (input.reconciliationStatus !== "completed" && input.reconciliationStatus !== "balanced") {
      alerts.push({
        id: `${surgeryId}:graft_reconciliation_incomplete`,
        kind: "graft_reconciliation_incomplete",
        title: SURGERY_OS_GRAFT_ALERT_LABELS.graft_reconciliation_incomplete,
        detail: `${patientLabel} — graft reconciliation is ${input.reconciliationStatus}.`,
        severity: "blocked",
        surgeryId,
        href,
      });
    }
  }

  return alerts;
}

export function graftEventTypeToTimelineKind(
  eventType: SurgeryOsGraftCountEventType,
): "graft_count_update" | "tray_count_recorded" | "graft_reconciliation_completed" | "graft_correction" {
  switch (eventType) {
    case "tray_count":
    case "tray_confirmed":
    case "tray_rejected":
      return "tray_count_recorded";
    case "graft_reconciliation":
      return "graft_reconciliation_completed";
    case "correction":
      return "graft_correction";
    default:
      return "graft_count_update";
  }
}

export function graftTimelineLabel(
  eventType: SurgeryOsGraftCountEventType,
  deltas: { extracted: number; implanted: number; discarded: number },
): string {
  switch (eventType) {
    case "tray_count":
      return "Tray count recorded";
    case "tray_confirmed":
      return "Tray count confirmed";
    case "tray_rejected":
      return "Tray count rejected";
    case "graft_reconciliation":
      return "Graft reconciliation completed";
    case "correction":
      return "Graft count corrected";
    case "discard_logged":
      return `Discarded ${deltas.discarded} graft(s)`;
    case "count_update":
      if (deltas.extracted > 0) return `Extraction +${deltas.extracted} graft(s)`;
      if (deltas.implanted > 0) return `Implantation +${deltas.implanted} graft(s)`;
      return "Graft count updated";
    default:
      return "Graft count updated";
  }
}
