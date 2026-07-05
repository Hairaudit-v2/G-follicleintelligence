/**
 * SurgeryOS graft counting — vocabulary, pure counting math, and count validation.
 */

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

export const SURGERY_OS_GRAFT_COUNT_EVENT_TYPE_LABELS: Record<
  SurgeryOsGraftCountEventType,
  string
> = {
  count_update: "Count update",
  tray_count: "Tray count",
  tray_confirmed: "Tray confirmed",
  tray_rejected: "Tray rejected",
  graft_reconciliation: "Reconciliation",
  discard_logged: "Discarded",
  correction: "Correction",
};

/** Surgery statuses eligible for graft counting without admin override. */
export const SURGERY_OS_GRAFT_COUNTING_ELIGIBLE_STATUSES = [
  "scheduled",
  "pre_op",
  "in_progress",
  "paused",
] as const;
export type SurgeryOsGraftCountingEligibleStatus =
  (typeof SURGERY_OS_GRAFT_COUNTING_ELIGIBLE_STATUSES)[number];

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
  discarded: number
): number {
  return extracted - implanted - discarded;
}

export function computeAverageHairsPerGraft(totalHairs: number, graftCount: number): number | null {
  if (graftCount <= 0 || totalHairs <= 0) return null;
  return Math.round((totalHairs / graftCount) * 100) / 100;
}

export function computeGraftProgressPercent(
  extracted: number,
  target: number | null
): number | null {
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
  count: number
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
    Math.abs(input.next.discarded - input.previous.discarded)
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

export function isSurgeryStatusEligibleForGraftCounting(
  status: string,
  options?: { allowAdminOverride?: boolean }
): boolean {
  if (options?.allowAdminOverride) return true;
  return (SURGERY_OS_GRAFT_COUNTING_ELIGIBLE_STATUSES as readonly string[]).includes(status);
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
    return {
      ok: false,
      reason: "At least one graft count delta is required.",
      code: "invalid_delta",
    };
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
    input.discardedGrafts
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

export function graftEventTypeToTimelineKind(
  eventType: SurgeryOsGraftCountEventType
):
  | "graft_count_update"
  | "tray_count_recorded"
  | "graft_reconciliation_completed"
  | "graft_correction" {
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
  deltas: { extracted: number; implanted: number; discarded: number }
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
