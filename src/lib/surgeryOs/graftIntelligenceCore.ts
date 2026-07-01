/**
 * SurgeryOS Sprint 1 — Graft Intelligence Engine (pure).
 * Composes graft session/counting/reconciliation data into surgical intelligence.
 */

import {
  computeGraftCompositionTotal,
  computeGraftProgressPercent,
  type SurgeryOsGraftReconciliationStatus,
} from "@/src/lib/surgeryOs/surgeryOsGraftModel";

export type GraftIntelligenceWarning = {
  kind:
    | "no_data"
    | "composition_mismatch"
    | "remaining_unaccounted"
    | "over_implantation"
    | "pending_tray_review"
    | "reconciliation_incomplete"
    | "low_confidence";
  message: string;
  severity: "info" | "warning" | "critical";
};

export type GraftIntelligenceInput = {
  surgeryId: string;
  patientLabel: string;
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
  reconciliationStatus: SurgeryOsGraftReconciliationStatus;
  pendingTrayCount: number;
};

export type GraftIntelligenceSnapshot = {
  surgeryId: string;
  patientLabel: string;
  totalGrafts: number;
  totalHairs: number;
  averageHairsPerGraft: number | null;
  singles: number;
  doubles: number;
  triples: number;
  multiples: number;
  multiHairGrafts: number;
  graftCountConfidence: number;
  reconciliationStatus: SurgeryOsGraftReconciliationStatus;
  extractionProgressPercent: number | null;
  implantationProgressPercent: number | null;
  summary: string;
  warnings: GraftIntelligenceWarning[];
};

function clampPercent(value: number | null): number | null {
  if (value == null || !Number.isFinite(value)) return null;
  return Math.min(100, Math.max(0, Math.round(value)));
}

function safeAverage(totalHairs: number, graftCount: number): number | null {
  if (graftCount <= 0 || totalHairs <= 0 || !Number.isFinite(totalHairs)) return null;
  const avg = totalHairs / graftCount;
  if (!Number.isFinite(avg)) return null;
  return Math.round(avg * 100) / 100;
}

function hasGraftData(input: GraftIntelligenceInput): boolean {
  return (
    input.extractedGrafts > 0 ||
    input.implantedGrafts > 0 ||
    input.discardedGrafts > 0 ||
    input.totalHairs > 0 ||
    computeGraftCompositionTotal({
      singles: input.singles,
      doubles: input.doubles,
      triples: input.triples,
      multiples: input.multiples,
    }) > 0
  );
}

function computeGraftCountConfidence(input: {
  extractedGrafts: number;
  compositionTotal: number;
  pendingTrayCount: number;
  reconciliationStatus: SurgeryOsGraftReconciliationStatus;
}): number {
  if (input.extractedGrafts <= 0) return 0;

  let score = 40;

  const compositionDelta = Math.abs(input.compositionTotal - input.extractedGrafts);
  if (input.compositionTotal > 0 && compositionDelta <= Math.max(5, input.extractedGrafts * 0.02)) {
    score += 20;
  } else if (input.compositionTotal > 0) {
    score += 10;
  }

  if (input.pendingTrayCount === 0) {
    score += 20;
  } else {
    score += Math.max(0, 20 - input.pendingTrayCount * 5);
  }

  if (input.reconciliationStatus === "completed" || input.reconciliationStatus === "balanced") {
    score += 20;
  } else if (input.reconciliationStatus === "mismatch") {
    score += 5;
  }

  return clampPercent(score) ?? 0;
}

function deriveWarnings(input: GraftIntelligenceInput & { compositionTotal: number }): GraftIntelligenceWarning[] {
  const warnings: GraftIntelligenceWarning[] = [];

  if (!hasGraftData(input)) {
    warnings.push({
      kind: "no_data",
      message: "No graft intelligence available yet.",
      severity: "info",
    });
    return warnings;
  }

  if (input.implantedGrafts > input.extractedGrafts) {
    warnings.push({
      kind: "over_implantation",
      message: `Implanted grafts (${input.implantedGrafts}) exceed extracted (${input.extractedGrafts}).`,
      severity: "critical",
    });
  }

  if (input.remainingGrafts !== 0) {
    warnings.push({
      kind: "remaining_unaccounted",
      message: `${input.remainingGrafts} graft(s) unaccounted (extracted − implanted − discarded).`,
      severity: input.remainingGrafts < 0 ? "critical" : "warning",
    });
  }

  const compositionDelta = Math.abs(input.compositionTotal - input.extractedGrafts);
  if (
    input.compositionTotal > 0 &&
    input.extractedGrafts > 0 &&
    compositionDelta > Math.max(5, Math.round(input.extractedGrafts * 0.05))
  ) {
    warnings.push({
      kind: "composition_mismatch",
      message: `Composition total (${input.compositionTotal}) differs from extracted grafts (${input.extractedGrafts}).`,
      severity: "warning",
    });
  }

  if (input.pendingTrayCount > 0) {
    warnings.push({
      kind: "pending_tray_review",
      message: `${input.pendingTrayCount} tray(s) awaiting nurse review.`,
      severity: "warning",
    });
  }

  if (
    input.reconciliationStatus !== "completed" &&
    input.reconciliationStatus !== "balanced" &&
    input.extractedGrafts > 0 &&
    input.implantedGrafts > 0
  ) {
    warnings.push({
      kind: "reconciliation_incomplete",
      message: `Graft reconciliation is ${input.reconciliationStatus}.`,
      severity: input.reconciliationStatus === "mismatch" ? "critical" : "warning",
    });
  }

  return warnings;
}

function buildSummary(input: {
  patientLabel: string;
  totalGrafts: number;
  totalHairs: number;
  reconciliationStatus: SurgeryOsGraftReconciliationStatus;
  extractionProgressPercent: number | null;
  hasData: boolean;
  warningCount: number;
}): string {
  if (!input.hasData) {
    return "No graft intelligence available yet.";
  }

  const progressPart =
    input.extractionProgressPercent != null
      ? `${input.extractionProgressPercent}% extraction progress`
      : "extraction progress pending";

  if (input.warningCount > 0) {
    return `${input.patientLabel} — ${input.totalGrafts} grafts, ${input.totalHairs} hairs; ${progressPart}; ${input.reconciliationStatus}; ${input.warningCount} warning(s).`;
  }

  return `${input.patientLabel} — ${input.totalGrafts} grafts, ${input.totalHairs} hairs; ${progressPart}; reconciliation ${input.reconciliationStatus}.`;
}

export function buildGraftIntelligence(input: GraftIntelligenceInput): GraftIntelligenceSnapshot {
  const compositionTotal = computeGraftCompositionTotal({
    singles: input.singles,
    doubles: input.doubles,
    triples: input.triples,
    multiples: input.multiples,
  });
  const hasData = hasGraftData(input);
  const totalGrafts = Math.max(0, input.extractedGrafts);
  const totalHairs = Math.max(0, input.totalHairs);
  const graftBasis = compositionTotal > 0 ? compositionTotal : totalGrafts;
  const averageHairsPerGraft =
    input.averageHairsPerGraft ?? safeAverage(totalHairs, graftBasis);
  const extractionProgressPercent = clampPercent(
    computeGraftProgressPercent(input.extractedGrafts, input.targetGrafts)
  );
  const implantationProgressPercent =
    input.targetGrafts != null && input.targetGrafts > 0
      ? clampPercent((input.implantedGrafts / input.targetGrafts) * 100)
      : input.extractedGrafts > 0
        ? clampPercent((input.implantedGrafts / input.extractedGrafts) * 100)
        : null;
  const graftCountConfidence = computeGraftCountConfidence({
    extractedGrafts: input.extractedGrafts,
    compositionTotal,
    pendingTrayCount: input.pendingTrayCount,
    reconciliationStatus: input.reconciliationStatus,
  });
  const warnings = deriveWarnings({ ...input, compositionTotal });

  if (graftCountConfidence < 50 && hasData) {
    warnings.push({
      kind: "low_confidence",
      message: `Graft count confidence is ${graftCountConfidence}% — verify trays and reconciliation.`,
      severity: "info",
    });
  }

  return {
    surgeryId: input.surgeryId,
    patientLabel: input.patientLabel,
    totalGrafts,
    totalHairs,
    averageHairsPerGraft,
    singles: Math.max(0, input.singles),
    doubles: Math.max(0, input.doubles),
    triples: Math.max(0, input.triples),
    multiples: Math.max(0, input.multiples),
    multiHairGrafts: Math.max(0, input.doubles + input.triples + input.multiples),
    graftCountConfidence,
    reconciliationStatus: input.reconciliationStatus,
    extractionProgressPercent,
    implantationProgressPercent,
    summary: buildSummary({
      patientLabel: input.patientLabel,
      totalGrafts,
      totalHairs,
      reconciliationStatus: input.reconciliationStatus,
      extractionProgressPercent,
      hasData,
      warningCount: warnings.filter((w) => w.kind !== "no_data").length,
    }),
    warnings,
  };
}

export function buildGraftIntelligenceForSurgeries(
  inputs: GraftIntelligenceInput[]
): GraftIntelligenceSnapshot[] {
  return inputs.map((input) => buildGraftIntelligence(input));
}
