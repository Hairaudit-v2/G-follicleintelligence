/**
 * SurgeryOS graft alerts — threshold constants and alert derivation.
 */

import type {
  SurgeryOsProcedurePhase,
  SurgeryOsSeverity,
} from "@/src/lib/surgeryOs/surgeryOsBoardModel";
import {
  computeGraftProgressPercent,
  requiresLargeCorrectionNote,
  SURGERY_OS_GRAFT_LARGE_CORRECTION_THRESHOLD,
  type SurgeryOsGraftTotals,
} from "@/src/lib/surgeryOs/surgeryOsGraftCounting";
import type { SurgeryOsGraftReconciliationStatus } from "@/src/lib/surgeryOs/surgeryOsGraftReconciliation";

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
    Math.ceil(totals.extractedGrafts * SURGERY_OS_GRAFT_DISCARDED_THRESHOLD_PERCENT)
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

  if (input.procedurePhase === "recovery" || input.procedurePhase === "completed") {
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
