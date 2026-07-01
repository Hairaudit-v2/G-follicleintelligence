/**
 * SurgeryOS loader resilience — missing-table detection and safe fallbacks (pure).
 */

import type { SurgeryOsCommandCentrePayload } from "@/src/lib/surgeryOs/surgeryOsBoardModel.types";
import type { SurgeryOsViewerRole } from "@/src/lib/surgeryOs/surgeryOsBoardModel";
import { visibleWidgetsForSurgeryOsRole } from "@/src/lib/surgeryOs/surgeryOsBoardModel";

export function isMissingDatabaseRelationError(error: unknown): boolean {
  const message = normalizeLoaderErrorMessage(error).toLowerCase();
  return (
    message.includes("does not exist") ||
    message.includes("could not find the table") ||
    (message.includes("relation") && message.includes("does not exist")) ||
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
  return `${tableName} is not available (apply SurgeryOS migrations).`;
}

export function emptySurgeryOsIntelligence(): SurgeryOsCommandCentrePayload["intelligence"] {
  return {
    policy: {
      canExportCompetencyData: false,
      canExportAuditData: false,
      canBuildProfessionalGraph: false,
      canSendToFiOs: false,
      requiresConsent: true,
      exportMode: "disabled",
    },
    hints: [],
    generatedAt: new Date().toISOString(),
  };
}

export function emptySurgeryOsCommandCentrePayload(input: {
  tenantId: string;
  tenantName: string;
  calendarTimezone: string;
  todayYmd: string;
  localStartIso: string;
  localEndIso: string;
  role: SurgeryOsViewerRole;
}): SurgeryOsCommandCentrePayload {
  return {
    tenantId: input.tenantId,
    tenantName: input.tenantName,
    loadedAt: new Date().toISOString(),
    operationalDay: {
      calendarTimezone: input.calendarTimezone,
      todayYmd: input.todayYmd,
      localStartIso: input.localStartIso,
      localEndIso: input.localEndIso,
    },
    viewer: {
      role: input.role,
      staffRole: null,
      visibleWidgets: visibleWidgetsForSurgeryOsRole(input.role),
    },
    liveSurgeries: [],
    readinessSnapshots: [],
    procedureTimeline: [],
    teamAssignments: [],
    alerts: [],
    operationalNotes: [],
    graftSummary: [],
    graftEvents: [],
    vieCapture: [],
    liveTimeline: [],
    graftIntelligence: [],
    intelligence: emptySurgeryOsIntelligence(),
  };
}
