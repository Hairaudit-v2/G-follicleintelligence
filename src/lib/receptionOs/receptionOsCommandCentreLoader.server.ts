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

  if (paymentsRes.error) throw new Error(paymentsRes.error.message);
  if (bookingsRes.error) throw new Error(bookingsRes.error.message);

  const surgeryBookingsCreatedToday = (bookingsRes.data ?? []).filter((raw) => {
    const type = String((raw as { booking_type?: string }).booking_type ?? "").trim().toLowerCase();
    return type.includes("surgery") || type.includes("procedure");
  }).length;

  return {
    depositsCollectedToday: (paymentsRes.data ?? []).length,
    surgeryBookingsCreatedToday,
  };
}

/**
 * Phase 2 command centre loader — composes V1 board payload + tasks + daily brief.
 * Phase 3 adds revenue intelligence without modifying {@link loadReceptionOsBoardPayload}.
 */
export type LoadReceptionOsCommandCentreOptions = {
  demoModeRequested?: boolean;
};

export async function loadReceptionOsCommandCentrePayload(
  tenantId: string,
  now: Date = new Date(),
  options: LoadReceptionOsCommandCentreOptions = {},
): Promise<ReceptionOsCommandCentrePayload> {
  const [board, openTasks, conversionPayload] = await Promise.all([
    loadReceptionOsBoardPayload(tenantId, now),
    loadOpenReceptionTasksForTenant(tenantId),
    loadConsultationConversionBoardPayload(tenantId, now),
  ]);

  const dailyBrief = buildReceptionOsDailyBrief(board, openTasks);
  const localHour = Number(
    new Intl.DateTimeFormat("en-GB", {
      timeZone: board.operationalDay.calendarTimezone,
      hour: "numeric",
      hour12: false,
    }).format(now),
  );

  const todayActivity = await loadTodayRevenueActivityCounts(tenantId, board.operationalDay);

  const revenueIntelligence = buildReceptionOsRevenueIntelligence({
    board,
    conversionColumns: mapConversionColumnsForRevenue(conversionPayload),
    depositsCollectedToday: todayActivity.depositsCollectedToday,
    surgeryBookingsCreatedToday: todayActivity.surgeryBookingsCreatedToday,
  });

  const partialPayload = {
    ...board,
    dailyBrief,
    receptionTasks: serializeReceptionTaskRows(openTasks),
    suggestedOperatingMode: inferDefaultOperatingMode(Number.isFinite(localHour) ? localHour : 12),
    ...revenueIntelligence,
  };

  const endOfDayCloseout = await loadReceptionCloseoutSnapshotForCommandCentre(partialPayload, now);
  const withCloseout = { ...partialPayload, endOfDayCloseout };
  const systemStatus = buildReceptionOsSystemStatusFromPayload(withCloseout);
  const phase8Visible = receptionPilotReviewVisible(board.viewer.role);
  const phase8Placeholders = {
    pilotMetrics: emptyReceptionPilotMetricsPayload(phase8Visible),
    pilotReview: emptyReceptionPilotReviewPayload(phase8Visible),
    ownerValue: emptyReceptionOwnerValuePayload(phase8Visible),
    demoMode: resolveReceptionOsDemoModeForViewer({
      viewerRole: board.viewer.role,
      demoRequested: options.demoModeRequested,
    }),
  };
  const payloadShell: ReceptionOsCommandCentrePayload = {
    ...withCloseout,
    systemStatus,
    ...phase8Placeholders,
  };

  let pilotMetrics = phase8Placeholders.pilotMetrics;
  try {
    pilotMetrics = await loadReceptionPilotMetricsForCommandCentre(payloadShell, board.viewer.role);
  } catch (e) {
    console.error("[loadReceptionPilotMetricsForCommandCentre]", e instanceof Error ? e.message : "unknown error");
  }

  let pilotReview = phase8Placeholders.pilotReview;
  let ownerValue = phase8Placeholders.ownerValue;
  const composedForPhase8: ReceptionOsCommandCentrePayload = {
    ...payloadShell,
    pilotMetrics,
  };

  try {
    const phase8 = await loadReceptionPhase8PayloadForCommandCentre(composedForPhase8, board.viewer.role);
    pilotReview = phase8.pilotReview;
    ownerValue = phase8.ownerValue;
  } catch (e) {
    console.error("[loadReceptionPhase8PayloadForCommandCentre]", e instanceof Error ? e.message : "unknown error");
  }

  const withPhase8: ReceptionOsCommandCentrePayload = {
    ...composedForPhase8,
    pilotReview,
    ownerValue,
  };

  return applyReceptionOsDemoModeForPayload(
    withPhase8,
    resolveReceptionOsDemoModeForViewer({
      viewerRole: board.viewer.role,
      demoRequested: options.demoModeRequested,
    }),
  );
}
