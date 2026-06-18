/**
 * ReceptionOS Phase 8 — owner value dashboard (admin / director).
 */

import type { ReceptionOsViewerRole } from "@/src/lib/receptionOs/receptionOsBoardModel";
import type { ReceptionPilotManagerScores } from "@/src/lib/receptionOs/receptionPilotMetricsModel";
import type { ReceptionPilotReviewReport } from "@/src/lib/receptionOs/receptionPilotReviewModel";
import type { ReceptionPilotFeedbackKind } from "@/src/lib/receptionOs/receptionPilotFeedbackModel";

export type ReceptionOwnerValueDashboard = {
  estimatedRevenueProtected: number;
  currency: string;
  operationalRisksClosed: number;
  averageResponseTimeMinutes: number | null;
  conversionActionsTaken: number;
  staffAdoptionScore: number;
  pilotFeedbackScore: number;
};

export type ReceptionOwnerValuePayload = {
  visible: boolean;
  dashboard: ReceptionOwnerValueDashboard | null;
};

export function receptionOwnerValueVisible(role: ReceptionOsViewerRole): boolean {
  return role === "admin" || role === "clinic_manager";
}

export function buildPilotFeedbackScore(
  feedbackRows: ReadonlyArray<{ feedbackKind: ReceptionPilotFeedbackKind }>,
): number {
  if (feedbackRows.length === 0) return 0;
  const useful = feedbackRows.filter((f) => f.feedbackKind === "useful").length;
  const negative = feedbackRows.length - useful;
  const raw = Math.round((useful / feedbackRows.length) * 100 - negative * 5);
  return clampScore(raw);
}

export function buildReceptionOwnerValueDashboard(input: {
  report: ReceptionPilotReviewReport;
  managerScores: ReceptionPilotManagerScores;
  feedbackRows: ReadonlyArray<{ feedbackKind: ReceptionPilotFeedbackKind }>;
  conversionActionsTaken?: number;
}): ReceptionOwnerValueDashboard {
  const conversionActionsTaken =
    input.conversionActionsTaken ??
    input.report.depositsChased +
      input.report.communicationsSent +
      input.report.communicationsDryRun;

  const closureRatio =
    input.report.tasksCreated > 0 ? input.report.risksClosed / input.report.tasksCreated : 0;
  const estimatedRevenueProtected = Math.min(
    input.report.revenueAtRiskIdentified,
    Math.round(input.report.revenueAtRiskIdentified * Math.max(closureRatio, 0.15)),
  );

  return {
    estimatedRevenueProtected,
    currency: input.report.currency,
    operationalRisksClosed: input.report.risksClosed,
    averageResponseTimeMinutes: input.report.averageResponseTimeMinutes,
    conversionActionsTaken,
    staffAdoptionScore: input.managerScores.adoptionScore,
    pilotFeedbackScore: buildPilotFeedbackScore(input.feedbackRows),
  };
}

export function emptyReceptionOwnerValuePayload(visible: boolean): ReceptionOwnerValuePayload {
  return { visible, dashboard: null };
}

function clampScore(n: number): number {
  if (!Number.isFinite(n)) return 0;
  return Math.max(0, Math.min(100, Math.round(n)));
}
