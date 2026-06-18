import "server-only";

import { supabaseAdmin } from "@/lib/supabaseAdmin";
import { assertNonEmptyUuid } from "@/src/lib/crm/validation";
import { loadConsultationConversionBoardPayload } from "@/src/lib/consultations/consultationConversionBoardLoader.server";
import { buildReceptionOsDailyBrief } from "@/src/lib/receptionOs/receptionDailyBriefModel";
import { loadReceptionOsBoardPayload } from "@/src/lib/receptionOs/receptionOsBoardLoader.server";
import type { ReceptionOsCommandCentrePayload } from "@/src/lib/receptionOs/receptionOsBoardModel.types";
import { inferDefaultOperatingMode } from "@/src/lib/receptionOs/receptionOperatingMode";
import {
  buildReceptionOsRevenueIntelligence,
  type ReceptionOsConversionEnrichmentCard,
  type ReceptionOsConversionEnrichmentColumnId,
} from "@/src/lib/receptionOs/receptionOsRevenueModel";
import { serializeReceptionTaskRows } from "@/src/lib/receptionOs/receptionTaskSerialize";
import { loadOpenReceptionTasksForTenant } from "@/src/lib/receptionOs/receptionTasks.server";
import { loadReceptionCloseoutSnapshotForCommandCentre } from "@/src/lib/receptionOs/receptionDailyCloseout.server";
import { buildReceptionOsSystemStatusFromPayload } from "@/src/lib/receptionOs/receptionOsPilotStatus.server";
import { loadReceptionPilotMetricsForCommandCentre } from "@/src/lib/receptionOs/receptionPilotMetrics.server";
import { emptyReceptionPilotMetricsPayload } from "@/src/lib/receptionOs/receptionPilotMetricsModel";
import { loadReceptionPhase8PayloadForCommandCentre } from "@/src/lib/receptionOs/receptionPilotReview.server";
import {
  emptyReceptionPilotReviewPayload,
  receptionPilotReviewVisible,
} from "@/src/lib/receptionOs/receptionPilotReviewModel";
import { emptyReceptionOwnerValuePayload } from "@/src/lib/receptionOs/receptionOwnerValueModel";
import {
  applyReceptionOsDemoModeForPayload,
  resolveReceptionOsDemoModeForViewer,
} from "@/src/lib/receptionOs/receptionOsDemoMode.server";
import {
  createEmptyReceptionOsModuleHealth,
  markReceptionOsModuleUnavailable,
  type ReceptionOsModuleHealth,
} from "@/src/lib/receptionOs/receptionOsModuleHealthModel";
import {
  buildFallbackReceptionOsSystemStatus,
  emptyReceptionCloseoutSnapshot,
  emptyRevenueIntelligenceForBoard,
  isMissingDatabaseRelationError,
  missingTableMessage,
  normalizeLoaderErrorMessage,
} from "@/src/lib/receptionOs/receptionOsLoaderResilience";

function mapConversionColumnsForRevenue(
  payload: Awaited<ReturnType<typeof loadConsultationConversionBoardPayload>>,
): Partial<Record<ReceptionOsConversionEnrichmentColumnId, readonly ReceptionOsConversionEnrichmentCard[]>> {
  const out: Partial<Record<ReceptionOsConversionEnrichmentColumnId, ReceptionOsConversionEnrichmentCard[]>> = {};
  for (const colId of Object.keys(payload.columns) as ReceptionOsConversionEnrichmentColumnId[]) {
    out[colId] = payload.columns[colId].map((card) => ({
      id: card.id,
      primaryColumn: card.primaryColumn,
      patientOrLeadLabel: card.patientOrLeadLabel,
      consultationDateYmd: card.consultationDateYmd,
      daysSinceConsultation: card.daysSinceConsultation,
      graftOrTreatmentLine: card.graftOrTreatmentLine,
      leadStageLabel: card.leadStageLabel,
      caseId: card.caseId,
      caseLabel: card.caseLabel,
      depositBoardLine: card.depositBoardLine,
      hrefs: card.hrefs,
    }));
  }
  return out;
}

async function loadTodayRevenueActivityCounts(
  tenantId: string,
  operationalDay: { localStartIso: string; localEndIso: string },
): Promise<{
  depositsCollectedToday: number;
  surgeryBookingsCreatedToday: number;
}> {
  const tid = assertNonEmptyUuid(tenantId, "tenantId").trim();
  const supabase = supabaseAdmin();
  const { localStartIso, localEndIso } = operationalDay;

  const [paymentsRes, bookingsRes] = await Promise.all([
    supabase
      .from("fi_payment_records")
      .select("id, status, updated_at")
      .eq("tenant_id", tid)
      .eq("status", "paid")
      .gte("updated_at", localStartIso)
      .lt("updated_at", localEndIso),
    supabase
      .from("fi_bookings")
      .select("id, booking_type, created_at")
      .eq("tenant_id", tid)
      .gte("created_at", localStartIso)
      .lt("created_at", localEndIso),
  ]);

  if (paymentsRes.error) {
    if (isMissingDatabaseRelationError(paymentsRes.error)) {
      return { depositsCollectedToday: 0, surgeryBookingsCreatedToday: 0 };
    }
    throw new Error(paymentsRes.error.message);
  }
  if (bookingsRes.error) {
    if (isMissingDatabaseRelationError(bookingsRes.error)) {
      return { depositsCollectedToday: 0, surgeryBookingsCreatedToday: 0 };
    }
    throw new Error(bookingsRes.error.message);
  }

  const surgeryBookingsCreatedToday = (bookingsRes.data ?? []).filter((raw) => {
    const type = String((raw as { booking_type?: string }).booking_type ?? "").trim().toLowerCase();
    return type.includes("surgery") || type.includes("procedure");
  }).length;

  return {
    depositsCollectedToday: (paymentsRes.data ?? []).length,
    surgeryBookingsCreatedToday,
  };
}

function logModuleFailure(scope: string, error: unknown): void {
  console.error(`[${scope}]`, normalizeLoaderErrorMessage(error));
}

function noteModuleFailure(
  health: ReceptionOsModuleHealth,
  module: Parameters<typeof markReceptionOsModuleUnavailable>[1],
  error: unknown,
  fallbackMessage: string,
): ReceptionOsModuleHealth {
  const message = isMissingDatabaseRelationError(error) ? fallbackMessage : normalizeLoaderErrorMessage(error);
  logModuleFailure(module, error);
  return markReceptionOsModuleUnavailable(health, module, message);
}

/**
 * Phase 2 command centre loader — composes V1 board payload + tasks + daily brief.
 * Optional Phase 3–8 modules degrade safely when migrations or queries fail.
 */
export type LoadReceptionOsCommandCentreOptions = {
  demoModeRequested?: boolean;
};

export async function loadReceptionOsCommandCentrePayload(
  tenantId: string,
  now: Date = new Date(),
  options: LoadReceptionOsCommandCentreOptions = {},
): Promise<ReceptionOsCommandCentrePayload> {
  let moduleHealth = createEmptyReceptionOsModuleHealth(false);

  const board = await loadReceptionOsBoardPayload(tenantId, now);
  moduleHealth = { ...moduleHealth, coreBoardLoaded: true };

  let openTasks: Awaited<ReturnType<typeof loadOpenReceptionTasksForTenant>> = [];
  try {
    openTasks = await loadOpenReceptionTasksForTenant(tenantId);
  } catch (error) {
    moduleHealth = noteModuleFailure(
      moduleHealth,
      "tasks",
      error,
      missingTableMessage("fi_reception_tasks"),
    );
  }

  const serializedTasks = serializeReceptionTaskRows(openTasks);
  const dailyBrief = buildReceptionOsDailyBrief(board, openTasks);
  const localHour = Number(
    new Intl.DateTimeFormat("en-GB", {
      timeZone: board.operationalDay.calendarTimezone,
      hour: "numeric",
      hour12: false,
    }).format(now),
  );

  let conversionPayload: Awaited<ReturnType<typeof loadConsultationConversionBoardPayload>>;
  try {
    conversionPayload = await loadConsultationConversionBoardPayload(tenantId, now);
  } catch (error) {
    logModuleFailure("loadConsultationConversionBoardPayload", error);
    conversionPayload = {
      window: {
        calendarTimezone: board.operationalDay.calendarTimezone,
        todayYmd: board.operationalDay.todayYmd,
        ymdPast90: board.operationalDay.todayYmd,
        ymdFuture30: board.operationalDay.todayYmd,
        rangeStartIso: board.operationalDay.localStartIso,
        rangeEndIso: board.operationalDay.localEndIso,
      },
      columns: {
        consultation_booked: [],
        consultation_completed: [],
        quote_drafted: [],
        quote_sent: [],
        quote_accepted: [],
        surgery_booked: [],
        lost: [],
      },
      kpis: {
        consultationsBookedNext30Days: 0,
        consultationsCompletedLast30Days: 0,
        quotesSent: 0,
        quotesAccepted: 0,
        surgeryBookedFromConsults: 0,
        conversionRateQuoteToSurgery: null,
        conversionRateLabel: "—",
      },
    };
  }

  let revenueIntelligence = emptyRevenueIntelligenceForBoard(board);
  try {
    const todayActivity = await loadTodayRevenueActivityCounts(tenantId, board.operationalDay);
    revenueIntelligence = buildReceptionOsRevenueIntelligence({
      board,
      conversionColumns: mapConversionColumnsForRevenue(conversionPayload),
      depositsCollectedToday: todayActivity.depositsCollectedToday,
      surgeryBookingsCreatedToday: todayActivity.surgeryBookingsCreatedToday,
    });
  } catch (error) {
    moduleHealth = noteModuleFailure(
      moduleHealth,
      "revenue_activity",
      error,
      "Revenue activity counters unavailable.",
    );
  }

  const partialPayload = {
    ...board,
    dailyBrief,
    receptionTasks: serializedTasks,
    suggestedOperatingMode: inferDefaultOperatingMode(Number.isFinite(localHour) ? localHour : 12),
    ...revenueIntelligence,
  };

  let endOfDayCloseout = emptyReceptionCloseoutSnapshot({
    board,
    tasks: serializedTasks,
    viewerRole: board.viewer.role,
  });
  try {
    endOfDayCloseout = await loadReceptionCloseoutSnapshotForCommandCentre(partialPayload, now);
  } catch (error) {
    moduleHealth = noteModuleFailure(
      moduleHealth,
      "closeout",
      error,
      missingTableMessage("fi_reception_daily_closeouts"),
    );
  }

  const withCloseout = { ...partialPayload, endOfDayCloseout };

  let systemStatus = buildFallbackReceptionOsSystemStatus(board.loadedAt);
  try {
    systemStatus = buildReceptionOsSystemStatusFromPayload(withCloseout);
  } catch (error) {
    moduleHealth = noteModuleFailure(
      moduleHealth,
      "system_status",
      error,
      "System status unavailable.",
    );
  }

  const phase8Visible = receptionPilotReviewVisible(board.viewer.role);
  const demoState = resolveReceptionOsDemoModeForViewer({
    viewerRole: board.viewer.role,
    demoRequested: options.demoModeRequested,
  });

  let pilotMetrics = emptyReceptionPilotMetricsPayload(phase8Visible);
  let pilotReview = emptyReceptionPilotReviewPayload(phase8Visible);
  let ownerValue = emptyReceptionOwnerValuePayload(phase8Visible);

  const payloadShell: ReceptionOsCommandCentrePayload = {
    ...withCloseout,
    systemStatus,
    pilotMetrics,
    pilotReview,
    ownerValue,
    demoMode: demoState,
    moduleHealth,
  };

  try {
    pilotMetrics = await loadReceptionPilotMetricsForCommandCentre(payloadShell, board.viewer.role);
  } catch (error) {
    moduleHealth = noteModuleFailure(
      moduleHealth,
      "pilot_metrics",
      error,
      missingTableMessage("fi_reception_usage_events"),
    );
  }

  const composedForPhase8: ReceptionOsCommandCentrePayload = {
    ...payloadShell,
    pilotMetrics,
    moduleHealth,
  };

  try {
    const phase8 = await loadReceptionPhase8PayloadForCommandCentre(composedForPhase8, board.viewer.role);
    pilotReview = phase8.pilotReview;
    ownerValue = phase8.ownerValue;
  } catch (error) {
    moduleHealth = noteModuleFailure(
      moduleHealth,
      "pilot_review",
      error,
      "Pilot review reporting unavailable.",
    );
    moduleHealth = markReceptionOsModuleUnavailable(
      moduleHealth,
      "owner_value",
      normalizeLoaderErrorMessage(error),
    );
  }

  let finalPayload: ReceptionOsCommandCentrePayload = {
    ...composedForPhase8,
    pilotReview,
    ownerValue,
    moduleHealth,
  };

  try {
    finalPayload = applyReceptionOsDemoModeForPayload(finalPayload, demoState);
  } catch (error) {
    moduleHealth = noteModuleFailure(
      moduleHealth,
      "demo_mode",
      error,
      "Demo mode sanitisation unavailable.",
    );
    finalPayload = {
      ...finalPayload,
      demoMode: demoState,
      moduleHealth,
    };
  }

  return { ...finalPayload, moduleHealth };
}
