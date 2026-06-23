import "server-only";

import { loadTenantOperationalCalendarSettings } from "@/src/lib/calendar/tenantOperationalCalendarSettings.server";
import { loadConsultationConversionBoardPayload } from "@/src/lib/consultations/consultationConversionBoardLoader.server";
import { computeConsultationConversionBoardWindow } from "@/src/lib/consultations/consultationConversionBoardModel";
import { listConsultationsForTenant } from "@/src/lib/consultations/consultationLoaders.server";

import type { ConsultationDashboardPayload } from "./consultationDashboardTypes";

export type { ConsultationDashboardPayload } from "./consultationDashboardTypes";

const CONSULTATION_INDEX_LIMIT = 200;

export async function loadConsultationDashboardPayload(tenantId: string): Promise<ConsultationDashboardPayload> {
  const tid = tenantId.trim();
  const [calendarSettings, consultations, conversion] = await Promise.all([
    loadTenantOperationalCalendarSettings(tid),
    listConsultationsForTenant(tid, { limit: CONSULTATION_INDEX_LIMIT }),
    loadConsultationConversionBoardPayload(tid),
  ]);

  const tz = calendarSettings.calendarTimezone.trim();
  const window = computeConsultationConversionBoardWindow(new Date(), tz);

  return {
    todayYmd: window.todayYmd,
    calendarTimezone: tz,
    consultations,
    conversion,
  };
}
