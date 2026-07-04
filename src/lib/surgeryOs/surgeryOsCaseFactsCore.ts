/**
 * FI-OUTCOME-INTELLIGENCE-SURGERY-CASE-FACTS-1 — SurgeryOS adapter for case intelligence facts.
 * Pure — maps SurgeryOS board payload shapes to outcome intelligence fact input.
 */

import {
  mapSurgeryCaseIntelligenceFacts,
  type SurgeryCaseIntelligenceFacts,
} from "@/src/lib/outcomeIntelligence/surgeryCaseFactsCore";
import type {
  SurgeryOsGraftSummary,
  SurgeryOsGraftTrayLinkSummary,
} from "./surgeryOsBoardModel.types";

export type { SurgeryCaseIntelligenceFacts } from "@/src/lib/outcomeIntelligence/surgeryCaseFactsCore";
export { SURGERY_CASE_INTELLIGENCE_FACTS_VERSION } from "@/src/lib/outcomeIntelligence/surgeryCaseFactsCore";

export type BuildSurgeryOsCaseIntelligenceFactsInput = {
  tenantId: string;
  patientId: string | null;
  caseId: string | null;
  surgeryId: string;
  bookingId: string | null;
  procedureDate: string | null;
  surgeonFiUserId: string | null;
  teamFiUserIds?: string[];
  surgeryStatus?: string | null;
  procedurePhase?: string | null;
  liveStatus?: string | null;
  graftSummary: SurgeryOsGraftSummary;
};

function mapTrayLink(link: SurgeryOsGraftTrayLinkSummary) {
  return {
    linkId: link.linkId,
    imageId: link.imageId,
    intelligenceSummary: link.intelligenceSummary,
  };
}

export function buildSurgeryOsCaseIntelligenceFacts(
  input: BuildSurgeryOsCaseIntelligenceFactsInput
): SurgeryCaseIntelligenceFacts | null {
  const graft = input.graftSummary;
  return mapSurgeryCaseIntelligenceFacts({
    tenantId: input.tenantId,
    patientId: input.patientId,
    caseId: input.caseId,
    surgeryId: input.surgeryId,
    bookingId: input.bookingId,
    procedureDate: input.procedureDate,
    surgeonFiUserId: input.surgeonFiUserId,
    teamFiUserIds: input.teamFiUserIds,
    surgeryStatus: input.surgeryStatus ?? null,
    procedurePhase: input.procedurePhase ?? null,
    liveStatus: input.liveStatus ?? null,
    graftSessionId: graft.sessionId,
    targetGrafts: graft.targetGrafts,
    extractedGrafts: graft.extractedGrafts,
    implantedGrafts: graft.implantedGrafts,
    discardedGrafts: graft.discardedGrafts,
    remainingGrafts: graft.remainingGrafts,
    reconciliationStatus: graft.reconciliationStatus,
    graftSessionPhase: graft.phase,
    reconciledAt: graft.reconciledAt,
    confirmedTrayGrafts: graft.confirmedTrayGrafts,
    trayImageLinks: graft.trayImageLinks.map(mapTrayLink),
    graftTrayIntelligence: graft.graftTrayIntelligence,
  });
}