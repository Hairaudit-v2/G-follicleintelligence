/**
 * ReceptionOS loader resilience — missing-table detection and safe fallbacks (pure).
 */

import type { ConsultationConversionBoardColumnId } from "@/src/lib/consultations/consultationConversionBoardModel";
import type { ConsultationConversionBoardPayload } from "@/src/lib/consultations/consultationConversionBoardLoader.server";
import type { SurgeryReadinessBoardColumnId } from "@/src/lib/surgery/surgeryReadinessBoardModel";
import type { SurgeryReadinessBoardPayload } from "@/src/lib/surgery/surgeryReadinessBoardLoader.server";
import { buildReceptionCloseoutSnapshot } from "@/src/lib/receptionOs/receptionDailyCloseoutModel";
import type { ReceptionCloseoutSnapshot } from "@/src/lib/receptionOs/receptionDailyCloseoutModel";
import { buildReceptionOsRevenueIntelligence } from "@/src/lib/receptionOs/receptionOsRevenueModel";
import type {
  ReceptionOsBoardPayload,
  ReceptionOsTaskItem,
} from "@/src/lib/receptionOs/receptionOsBoardModel.types";
import type { ReceptionOsViewerRole } from "@/src/lib/receptionOs/receptionOsBoardModel";
import { buildReceptionOsSystemStatus } from "@/src/lib/receptionOs/receptionOsPilotStatusModel";
import type { ReceptionOsSystemStatus } from "@/src/lib/receptionOs/receptionOsPilotStatusModel";
import { receptionCloseoutCloseDayAllowed } from "@/src/lib/receptionOs/receptionCloseoutPolicy";
import { emptyPipelineCounts } from "@/src/lib/receptionOs/receptionOsBoardPayloadSchema";

const CONVERSION_COLUMNS: ConsultationConversionBoardColumnId[] = [
  "consultation_booked",
  "consultation_completed",
  "quote_drafted",
  "quote_sent",
  "quote_accepted",
  "surgery_booked",
  "lost",
];

const SURGERY_COLUMNS: SurgeryReadinessBoardColumnId[] = [
  "ready",
  "needs_attention",
  "high_risk",
  "missing_pathology",
  "missing_consent",
  "on_hold_not_linked",
];

export function isMissingDatabaseRelationError(error: unknown): boolean {
  const message = normalizeLoaderErrorMessage(error).toLowerCase();
  return (
    message.includes("does not exist") ||
    message.includes("could not find the table") ||
    message.includes("relation") && message.includes("does not exist") ||
    message.includes("schema cache") ||
    message.includes("42p01") ||
    message.includes("pgrst205")
  );
}

export function normalizeLoaderErrorMessage(error: unknown): string {
  if (error instanceof Error) return error.message.trim() || "Unknown error";
  if (typeof error === "string") return error.trim() || "Unknown error";
  return "Unknown error";
}

export function missingTableMessage(tableName: string): string {
  return `${tableName} is not available (apply ReceptionOS migrations).`;
}

export function emptyConsultationConversionBoardPayload(
  calendarTimezone = "UTC",
  todayYmd = new Date().toISOString().slice(0, 10),
): ConsultationConversionBoardPayload {
  const columns = {} as Record<ConsultationConversionBoardColumnId, ConsultationConversionBoardPayload["columns"][ConsultationConversionBoardColumnId]>;
  for (const col of CONVERSION_COLUMNS) columns[col] = [];
  return {
    window: {
      calendarTimezone,
      todayYmd,
      ymdPast90: todayYmd,
      ymdFuture30: todayYmd,
      rangeStartIso: new Date().toISOString(),
      rangeEndIso: new Date().toISOString(),
    },
    columns,
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

export function emptySurgeryReadinessBoardPayload(
  calendarTimezone = "UTC",
  todayYmd = new Date().toISOString().slice(0, 10),
): SurgeryReadinessBoardPayload {
  const columns = {} as Record<SurgeryReadinessBoardColumnId, SurgeryReadinessBoardPayload["columns"][SurgeryReadinessBoardColumnId]>;
  for (const col of SURGERY_COLUMNS) columns[col] = [];
  return {
    window: {
      calendarTimezone,
      todayYmd,
      windowEndYmd: todayYmd,
      rangeStartIso: new Date().toISOString(),
      rangeEndIso: new Date().toISOString(),
    },
    columns,
    kpis: {
      upcomingNext14Days: 0,
      ready: 0,
      needsAttention: 0,
      highRisk: 0,
      missingPathology: 0,
      missingConsent: 0,
      surgeryPaymentRecordsTracked: 0,
      surgeryDepositsPending: 0,
    },
  };
}

export function emptyReceptionCloseoutSnapshot(input: {
  board: Pick<ReceptionOsBoardPayload, "tenantId" | "operationalDay" | "outstandingDeposits" | "upcomingSurgeries" | "actionAlerts">;
  tasks?: readonly ReceptionOsTaskItem[];
  viewerRole: ReceptionOsViewerRole;
}): ReceptionCloseoutSnapshot {
  return buildReceptionCloseoutSnapshot({
    board: input.board,
    tasks: input.tasks ?? [],
    failedCommunications: [],
    tomorrowFirstPatient: null,
    canCloseDay: receptionCloseoutCloseDayAllowed(input.viewerRole),
    existingCloseout: null,
  });
}

export function buildFallbackReceptionOsSystemStatus(loadedAt: string): ReceptionOsSystemStatus {
  return buildReceptionOsSystemStatus({
    dryRunEnabled: true,
    emailSendEnabled: false,
    smsSendEnabled: false,
    resendConfigured: false,
    twilioConfigured: false,
    loadedAt,
    closeout: {
      operatingDate: loadedAt.slice(0, 10),
      itemCounts: {
        info: 0,
        warning: 0,
        critical: 0,
        blocked: 0,
        total: 0,
        failed_communications: 0,
      },
      failedCommunications: [],
      existingCloseoutId: null,
    },
  });
}

export function emptyRevenueIntelligenceForBoard(board: ReceptionOsBoardPayload) {
  return buildReceptionOsRevenueIntelligence({
    board,
    depositsCollectedToday: 0,
    surgeryBookingsCreatedToday: 0,
  });
}

export function emptyConsultationPipelineFromBoard() {
  const columns = {} as ReceptionOsBoardPayload["consultationPipeline"]["columns"];
  for (const [key] of Object.entries(emptyPipelineCounts())) {
    columns[key as keyof typeof columns] = [];
  }
  return { columns, counts: emptyPipelineCounts() };
}
