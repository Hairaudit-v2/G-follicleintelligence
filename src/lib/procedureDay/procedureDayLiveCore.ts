import type { ProcedureDayScheduleCard } from "@/src/lib/surgery/procedureDayBoardLoader.server";

import {
  buildProcedureDayChecklist,
  buildProcedureDaySafetyWarnings,
  deriveProcedureDayStageFromBooking,
  nextProcedureDayStage,
  PROCEDURE_DAY_STAGE_LABELS,
} from "./procedureDayWorkflowCore";
import type { ProcedureDayLiveCardState, ProcedureDaySessionRow } from "./procedureDayWorkflowTypes";

function parseMetrics(metadata: Record<string, unknown>) {
  return {
    graftsExtracted:
      typeof metadata.graftsExtracted === "number" ? metadata.graftsExtracted : null,
    graftsImplanted:
      typeof metadata.graftsImplanted === "number" ? metadata.graftsImplanted : null,
    hairsCounted: typeof metadata.hairsCounted === "number" ? metadata.hairsCounted : null,
    transectionRate:
      typeof metadata.transectionRate === "number" ? metadata.transectionRate : null,
    punchSize: typeof metadata.punchSize === "string" ? metadata.punchSize : null,
    extractionMethod:
      typeof metadata.extractionMethod === "string" ? metadata.extractionMethod : null,
    implantationMethod:
      typeof metadata.implantationMethod === "string" ? metadata.implantationMethod : null,
    medicationsGiven: Array.isArray(metadata.medicationsGiven)
      ? metadata.medicationsGiven.map(String)
      : null,
    adverseEvents: Array.isArray(metadata.adverseEvents)
      ? metadata.adverseEvents.map(String)
      : null,
    notes: typeof metadata.notes === "string" ? metadata.notes : null,
  };
}

export function buildProcedureDayLiveCardState(
  card: ProcedureDayScheduleCard,
  session: ProcedureDaySessionRow | null
): ProcedureDayLiveCardState {
  const derived = deriveProcedureDayStageFromBooking({
    bookingStatus: card.bookingStatus,
    procedureStatus: card.procedureProgress.statusRaw,
  });
  const currentStage = session?.currentStage ?? derived;
  const metrics = session ? parseMetrics(session.metadata) : parseMetrics({});
  const financialBlocked = card.financialClearance?.financially_safe_to_proceed === false;
  const missingSurgeon = !card.procedureSurgeonLabel?.trim() && !card.calendarAssigneeLabel?.trim();

  return {
    bookingId: card.bookingId,
    sessionId: session?.id ?? null,
    currentStage,
    stageLabel: PROCEDURE_DAY_STAGE_LABELS[currentStage],
    startedAt: session?.startedAt ?? null,
    completedAt: session?.completedAt ?? null,
    metrics,
    isLive: Boolean(session?.startedAt),
    canStart: !session && currentStage === "scheduled",
    nextStage: nextProcedureDayStage(currentStage),
    safetyWarnings: buildProcedureDaySafetyWarnings({
      stage: currentStage,
      graftsExtracted: metrics.graftsExtracted,
      graftsImplanted: metrics.graftsImplanted,
      transectionRate: metrics.transectionRate,
      adverseEvents: metrics.adverseEvents,
      financialClearanceBlocked: financialBlocked,
      missingSurgeon,
    }),
    checklist: buildProcedureDayChecklist(currentStage, {
      graftsExtracted: metrics.graftsExtracted,
      graftsImplanted: metrics.graftsImplanted,
      preOpComplete:
        card.preOp.consentProxy &&
        card.preOp.pathologyReviewed &&
        card.preOp.depositOkOrUntracked &&
        card.preOp.procedurePlanComplete &&
        card.preOp.surgeonAssigned &&
        card.preOp.roomOk,
      consentSigned: card.preOp.consentProxy,
    }),
    postOpSummary:
      typeof session?.metadata.post_op_summary === "string"
        ? session.metadata.post_op_summary
        : null,
  };
}