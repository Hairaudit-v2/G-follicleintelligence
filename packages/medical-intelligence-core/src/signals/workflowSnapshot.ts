import type { ClinicalInsights } from "../insights/clinicalInsights";
import type { InterpretedMarker } from "../biomarkers/bloodInterpretation";
import type { MarkerTrendRow } from "../insights/bloodMarkerTrends";
import type { TriageFlags } from "../types/triage";
import type { LongevityQuestionnaireResponses } from "../types/questionnaire";

/** Minimal care-plan fields consumed by signal normalization. */
export type CarePlanSignalInput = {
  followUpTimingSuggestion?: string | null;
  gpFollowUpSuggested?: boolean;
};

/** Minimal scalp comparison fields consumed by signal normalization. */
export type ScalpImageComparisonSignalInput = {
  canCompareConfirmed?: boolean;
  comparisonStatus?: string | null;
  visualComparisonConfidence?: string | null;
  progressionSignals?: string[];
  visualProgressSummary?: string[];
  visualPersistentDrivers?: string[];
  visualFollowUpConsiderations?: string[];
  comparisonLimitedByImageQuality?: boolean;
};

/** Minimal case comparison fields consumed by signal normalization. */
export type CaseComparisonSignalInput = {
  persistentDrivers?: string[];
  scalpImageComparison?: ScalpImageComparisonSignalInput | null;
};

/**
 * Workflow snapshot shape shared across HLI orchestration and integration consumers.
 * Assembly from persistence remains in HLI; this type is the portable contract.
 */
export type LongevityWorkflowSnapshot = {
  profileId: string;
  intakeId: string;
  intakeCreatedAt: string | null;
  lastReviewedAt: string | null;
  patientVisibleReleasedAt: string | null;
  derivedFlags: TriageFlags;
  questionnaireResponses: LongevityQuestionnaireResponses;
  bloodResults: InterpretedMarker[];
  markerTrends: MarkerTrendRow[];
  bloodRequest: {
    id?: string;
    status?: string | null;
    recommended_by?: string | null;
    created_at?: string | null;
    updated_at?: string | null;
    approved_at?: string | null;
  } | null;
  caseComparison: CaseComparisonSignalInput | null;
  clinicalInsights: ClinicalInsights;
  carePlan: CarePlanSignalInput;
  followUpCadence: Record<string, unknown>;
  hasBloodResultUploadDocument: boolean;
  hasStructuredMarkers: boolean;
  treatmentAdherence: Record<string, unknown>;
  outcomeCorrelation: Record<string, unknown>;
};
