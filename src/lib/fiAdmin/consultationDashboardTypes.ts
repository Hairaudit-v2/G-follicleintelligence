import type { ConsultationConversionBoardPayload } from "@/src/lib/consultations/consultationConversionBoardLoader.server";
import type { ConsultationIndexRow } from "@/src/lib/consultations/consultationLoaders.server";

export type ConsultationDashboardPayload = {
  todayYmd: string;
  calendarTimezone: string;
  consultations: ConsultationIndexRow[];
  conversion: ConsultationConversionBoardPayload;
};
