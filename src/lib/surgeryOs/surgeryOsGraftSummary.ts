/**
 * SurgeryOS graft summary — end-of-surgery export/report assembly.
 */

import {
  computeGraftCompositionTotal,
  type SurgeryOsGraftCountEventType,
  type SurgeryOsGraftTotals,
} from "@/src/lib/surgeryOs/surgeryOsGraftCounting";
import {
  countTrayReviewBuckets,
  computeConfirmedTrayTotals,
  type SurgeryOsGraftReconciliationStatus,
  type TrayReviewStatus,
} from "@/src/lib/surgeryOs/surgeryOsGraftReconciliation";

export type SurgeryOsGraftSummaryExport = {
  tenantName: string;
  patientLabel: string;
  surgeryId: string;
  exportedAt: string;
  targetGrafts: number | null;
  extractedGrafts: number;
  implantedGrafts: number;
  discardedGrafts: number;
  remainingGrafts: number;
  singles: number;
  doubles: number;
  triples: number;
  multiples: number;
  totalHairs: number;
  averageHairsPerGraft: number | null;
  trayCounts: {
    total: number;
    confirmed: number;
    rejected: number;
    pending: number;
  };
  confirmedTrayGrafts: number;
  correctionCount: number;
  reconciliationStatus: SurgeryOsGraftReconciliationStatus;
  reconciledAt: string | null;
  reconciledByLabel: string | null;
  reconciliationNote: string | null;
};

export function buildGraftSummaryExport(input: {
  tenantName: string;
  patientLabel: string;
  surgeryId: string;
  exportedAt: string;
  totals: SurgeryOsGraftTotals;
  reconciliationStatus: SurgeryOsGraftReconciliationStatus;
  reconciledAt: string | null;
  reconciledByLabel: string | null;
  reconciliationNote: string | null;
  events: Array<{
    eventType: SurgeryOsGraftCountEventType;
    reviewStatus?: TrayReviewStatus | null;
    singles: number | null;
    doubles: number | null;
    triples: number | null;
    multiples: number | null;
    totalHairs: number | null;
    deltaDiscarded: number;
  }>;
}): SurgeryOsGraftSummaryExport {
  const trayBuckets = countTrayReviewBuckets(input.events);
  const confirmedTrayTotals = computeConfirmedTrayTotals(input.events);
  const correctionCount = input.events.filter((e) => e.eventType === "correction").length;

  return {
    tenantName: input.tenantName,
    patientLabel: input.patientLabel,
    surgeryId: input.surgeryId,
    exportedAt: input.exportedAt,
    targetGrafts: input.totals.targetGrafts,
    extractedGrafts: input.totals.extractedGrafts,
    implantedGrafts: input.totals.implantedGrafts,
    discardedGrafts: input.totals.discardedGrafts,
    remainingGrafts: input.totals.remainingGrafts,
    singles: input.totals.composition.singles,
    doubles: input.totals.composition.doubles,
    triples: input.totals.composition.triples,
    multiples: input.totals.composition.multiples,
    totalHairs: input.totals.totalHairs,
    averageHairsPerGraft: input.totals.averageHairsPerGraft,
    trayCounts: trayBuckets,
    confirmedTrayGrafts: computeGraftCompositionTotal(confirmedTrayTotals),
    correctionCount,
    reconciliationStatus: input.reconciliationStatus,
    reconciledAt: input.reconciledAt,
    reconciledByLabel: input.reconciledByLabel,
    reconciliationNote: input.reconciliationNote,
  };
}
