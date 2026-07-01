/**
 * SurgeryOS Sprint 2 — Surgical Risk Detection Engine (pure).
 * Composes procedural performance signals into live risk alerts.
 */

import type { ExtractionVelocitySnapshot } from "@/src/lib/surgeryOs/extractionVelocityCore";
import type { GraftIntelligenceSnapshot } from "@/src/lib/surgeryOs/graftIntelligenceCore";
import type { ImplantationSpeedSnapshot } from "@/src/lib/surgeryOs/implantationSpeedCore";
import type { LiveProcedureTimelineSnapshot } from "@/src/lib/surgeryOs/liveProcedureTimelineCore";
import type { TransectionMonitoringSnapshot } from "@/src/lib/surgeryOs/transectionMonitoringCore";

export type SurgicalRiskSeverity = "warning" | "critical";

export type SurgicalDetectedRisk = {
  title: string;
  severity: SurgicalRiskSeverity;
  recommendation: string;
};

export type SurgicalRiskDetectionInput = {
  surgeryId: string;
  patientLabel: string;
  extractionVelocity?: ExtractionVelocitySnapshot | null;
  transectionMonitoring?: TransectionMonitoringSnapshot | null;
  implantationSpeed?: ImplantationSpeedSnapshot | null;
  liveTimeline?: LiveProcedureTimelineSnapshot | null;
  graftIntelligence?: GraftIntelligenceSnapshot | null;
  now?: Date;
};

export type SurgicalRiskDetectionSnapshot = {
  surgeryId: string;
  patientLabel: string;
  totalRisks: number;
  criticalRisks: number;
  warningRisks: number;
  detectedRisks: SurgicalDetectedRisk[];
  summary: string;
};

export const DEFAULT_SURGICAL_RISK_THRESHOLDS = {
  extractionSlowingDeclinePercent: 15,
  transectionWatchRatePercent: 5,
  transectionCriticalRatePercent: 10,
  implantationDelayMinutes: 45,
  behindScheduleMinutes: 30,
} as const;

function buildSummary(input: {
  patientLabel: string;
  totalRisks: number;
  criticalRisks: number;
}): string {
  if (input.totalRisks === 0) {
    return "No active procedural risks detected.";
  }

  if (input.criticalRisks > 0) {
    return `${input.patientLabel} — ${input.totalRisks} procedural risk(s); ${input.criticalRisks} critical.`;
  }

  return `${input.patientLabel} — ${input.totalRisks} procedural warning(s) detected.`;
}

export function buildSurgicalRiskDetection(
  input: SurgicalRiskDetectionInput,
  thresholds: typeof DEFAULT_SURGICAL_RISK_THRESHOLDS = DEFAULT_SURGICAL_RISK_THRESHOLDS
): SurgicalRiskDetectionSnapshot {
  const nowMs = (input.now ?? new Date()).getTime();
  const detectedRisks: SurgicalDetectedRisk[] = [];

  const extraction = input.extractionVelocity;
  if (
    extraction &&
    extraction.efficiencyDeclinePercent != null &&
    extraction.efficiencyDeclinePercent >= thresholds.extractionSlowingDeclinePercent
  ) {
    detectedRisks.push({
      title: `Extraction velocity dropped ${extraction.efficiencyDeclinePercent}%`,
      severity:
        extraction.efficiencyDeclinePercent >= thresholds.extractionSlowingDeclinePercent * 1.5
          ? "critical"
          : "warning",
      recommendation: "Consider operator rotation, break, or technique review to restore extraction pace.",
    });
  }

  if (extraction?.fatigueSignal) {
    detectedRisks.push({
      title: "Possible operator fatigue",
      severity: "warning",
      recommendation: "Schedule a supervised break or rotate extraction staff before quality declines further.",
    });
  }

  const transection = input.transectionMonitoring;
  if (
    transection?.transectionRate != null &&
    transection.transectionRate >= thresholds.transectionWatchRatePercent
  ) {
    detectedRisks.push({
      title: "Transection rate above safe threshold",
      severity:
        transection.transectionRate >= thresholds.transectionCriticalRatePercent
          ? "critical"
          : "warning",
      recommendation: `Review punch depth, angle, and graft handling — current rate ${transection.transectionRate}%.`,
    });
  }

  const timeline = input.liveTimeline;
  const behindSchedule = timeline?.delaySignals.find((s) => s.kind === "behind_schedule");
  if (behindSchedule && behindSchedule.elapsedMinutes >= thresholds.behindScheduleMinutes) {
    detectedRisks.push({
      title: `Procedure running ${behindSchedule.elapsedMinutes} minutes behind`,
      severity: behindSchedule.severity === "critical" ? "critical" : "warning",
      recommendation: "Reconcile theatre pacing with coordinator and adjust downstream schedule commitments.",
    });
  }

  const graftIntel = input.graftIntelligence;
  if (graftIntel) {
    const inconsistencyWarnings = graftIntel.warnings.filter((w) =>
      ["composition_mismatch", "remaining_unaccounted", "over_implantation", "reconciliation_incomplete"].includes(
        w.kind
      )
    );
    if (inconsistencyWarnings.length > 0) {
      const critical = inconsistencyWarnings.some((w) => w.severity === "critical");
      detectedRisks.push({
        title: "Graft count inconsistency",
        severity: critical ? "critical" : "warning",
        recommendation: "Pause implantation until trays are reconciled and graft totals are verified.",
      });
    }
  }

  if (timeline && extraction) {
    const extractionComplete = timeline.timelineItems.find(
      (item) => item.stage === "extraction_completed"
    );
    const implantationStart = timeline.timelineItems.find(
      (item) => item.stage === "implantation_started"
    );
    const extractionMs = extractionComplete ? Date.parse(extractionComplete.occurredAt) : NaN;
    const implantationMs = implantationStart ? Date.parse(implantationStart.occurredAt) : NaN;

    if (
      Number.isFinite(extractionMs) &&
      !Number.isFinite(implantationMs) &&
      timeline.currentStage !== "implantation_started" &&
      timeline.currentStage !== "implantation_completed" &&
      timeline.status !== "completed"
    ) {
      const delayMinutes = Math.round((nowMs - extractionMs) / 60_000);
      if (delayMinutes >= thresholds.implantationDelayMinutes) {
        detectedRisks.push({
          title: "Prolonged implantation delay",
          severity: delayMinutes >= thresholds.implantationDelayMinutes * 2 ? "critical" : "warning",
          recommendation: "Confirm graft storage conditions and begin implantation or document clinical hold reason.",
        });
      }
    } else if (Number.isFinite(extractionMs) && Number.isFinite(implantationMs)) {
      const gapMinutes = Math.round((implantationMs - extractionMs) / 60_000);
      if (gapMinutes >= thresholds.implantationDelayMinutes) {
        detectedRisks.push({
          title: "Prolonged implantation delay",
          severity: gapMinutes >= thresholds.implantationDelayMinutes * 2 ? "critical" : "warning",
          recommendation: "Review out-of-body time protocol and graft hydration between extraction and implantation.",
        });
      }
    }
  }

  const implantation = input.implantationSpeed;
  if (
    implantation &&
    implantation.implantationRatePerHour != null &&
    implantation.efficiencyScore < 50 &&
    implantation.implantedGrafts >= 100
  ) {
    detectedRisks.push({
      title: "Implantation velocity below target",
      severity: "warning",
      recommendation: "Assess recipient site workflow, team allocation, and graft placement cadence.",
    });
  }

  const criticalRisks = detectedRisks.filter((r) => r.severity === "critical").length;
  const warningRisks = detectedRisks.filter((r) => r.severity === "warning").length;

  return {
    surgeryId: input.surgeryId,
    patientLabel: input.patientLabel,
    totalRisks: detectedRisks.length,
    criticalRisks,
    warningRisks,
    detectedRisks,
    summary: buildSummary({
      patientLabel: input.patientLabel,
      totalRisks: detectedRisks.length,
      criticalRisks,
    }),
  };
}

export function buildSurgicalRiskDetectionForSurgeries(
  inputs: SurgicalRiskDetectionInput[]
): SurgicalRiskDetectionSnapshot[] {
  return inputs.map((input) => buildSurgicalRiskDetection(input));
}
