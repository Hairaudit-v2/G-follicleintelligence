/**
 * ReceptionOS intelligence bridge — scaffold for future AI agent integration.
 * Uses @follicle/intelligence-core boundary types; no runtime AI calls in V1.
 */

import { defaultIntelligenceExportPolicy } from "@follicle/intelligence-core/policy";

import type {
  ReceptionOsAlertKind,
  ReceptionOsWidgetKey,
} from "@/src/lib/receptionOs/receptionOsBoardModel";

export type ReceptionOsIntelligenceSignalKind =
  | "patient_flow_bottleneck"
  | "deposit_collection_risk"
  | "consultation_follow_up_gap"
  | "surgery_readiness_escalation"
  | "communication_response_lag";

export type ReceptionOsIntelligenceHint = {
  signalKind: ReceptionOsIntelligenceSignalKind;
  title: string;
  summary: string;
  /** Related widget for UI anchoring */
  relatedWidget: ReceptionOsWidgetKey;
  /** 0–1 confidence placeholder for future model scoring */
  confidence: number;
  /** When true, hint may be surfaced to AI agents via intelligence-core export (future). */
  exportEligible: boolean;
};

export type ReceptionOsIntelligenceContext = {
  policy: ReturnType<typeof defaultIntelligenceExportPolicy>;
  hints: ReceptionOsIntelligenceHint[];
  generatedAt: string;
};

/** Safe defaults — AI export disabled until explicitly configured. */
export function createReceptionOsIntelligenceContext(): ReceptionOsIntelligenceContext {
  return {
    policy: defaultIntelligenceExportPolicy(),
    hints: [],
    generatedAt: new Date().toISOString(),
  };
}

/** Derive lightweight advisory hints from operational counts (rule-based V1; replace with AI later). */
export function deriveReceptionOsIntelligenceHints(input: {
  overdueDepositCount: number;
  surgeryRiskAlertCount: number;
  noFollowUpCount: number;
  missingFormsCount: number;
  patientsWaitingCount: number;
}): ReceptionOsIntelligenceHint[] {
  const hints: ReceptionOsIntelligenceHint[] = [];
  const policy = defaultIntelligenceExportPolicy();

  if (input.patientsWaitingCount >= 3) {
    hints.push({
      signalKind: "patient_flow_bottleneck",
      title: "Front desk flow pressure",
      summary: `${input.patientsWaitingCount} patients are waiting or in active flow — consider prioritising arrivals.`,
      relatedWidget: "todays_patients",
      confidence: 0.72,
      exportEligible: policy.canSendToFiOs,
    });
  }
  if (input.overdueDepositCount > 0) {
    hints.push({
      signalKind: "deposit_collection_risk",
      title: "Deposit collection attention",
      summary: `${input.overdueDepositCount} deposit${input.overdueDepositCount === 1 ? "" : "s"} overdue or pending collection.`,
      relatedWidget: "outstanding_deposits",
      confidence: 0.85,
      exportEligible: policy.canSendToFiOs,
    });
  }
  if (input.noFollowUpCount > 0) {
    hints.push({
      signalKind: "consultation_follow_up_gap",
      title: "Consultation follow-up gaps",
      summary: `${input.noFollowUpCount} completed consultation${input.noFollowUpCount === 1 ? "" : "s"} without recent follow-up.`,
      relatedWidget: "action_alerts",
      confidence: 0.78,
      exportEligible: policy.canSendToFiOs,
    });
  }
  if (input.surgeryRiskAlertCount > 0) {
    hints.push({
      signalKind: "surgery_readiness_escalation",
      title: "Surgery readiness risks",
      summary: `${input.surgeryRiskAlertCount} upcoming surger${input.surgeryRiskAlertCount === 1 ? "y needs" : "ies need"} attention before procedure day.`,
      relatedWidget: "upcoming_surgery",
      confidence: 0.88,
      exportEligible: policy.canSendToFiOs,
    });
  }
  if (input.missingFormsCount > 0) {
    hints.push({
      signalKind: "communication_response_lag",
      title: "Incomplete patient forms",
      summary: `${input.missingFormsCount} patient${input.missingFormsCount === 1 ? "" : "s"} with draft or missing consultation forms.`,
      relatedWidget: "action_alerts",
      confidence: 0.7,
      exportEligible: policy.canSendToFiOs,
    });
  }

  return hints;
}

export function mapAlertKindToIntelligenceSignal(
  kind: ReceptionOsAlertKind
): ReceptionOsIntelligenceSignalKind {
  switch (kind) {
    case "missing_deposit":
      return "deposit_collection_risk";
    case "no_follow_up_after_consultation":
      return "consultation_follow_up_gap";
    case "missing_forms":
      return "communication_response_lag";
    case "surgery_risk":
      return "surgery_readiness_escalation";
    default:
      return "patient_flow_bottleneck";
  }
}
