/**
 * Serializable initial payload for ConsultationTrichoscopySection (server → client).
 */

import type { ConsultationTrichoscopyCardSummary } from "@/src/lib/integrations/hliTrichoscopy/consultation/types";

export type ConsultationTrichoscopyHubInitial = {
  available: boolean;
  card: ConsultationTrichoscopyCardSummary;
  indication: Record<string, unknown> | null;
  findings: Array<Record<string, unknown>>;
  reviews: Array<Record<string, unknown>>;
  patientSafeSummaryText: string | null;
  canRequest: boolean;
  canReview: boolean;
  canAccept: boolean;
  historicalReadOnly: boolean;
};
