/**
 * Serializable FI OS medical intelligence display payload (UI + read models).
 * Clinical logic lives in @hairlongevity/medical-intelligence-core only.
 */

export type FiMedicalIntelligenceInterpretationStatus =
  | "optimal"
  | "normal"
  | "low"
  | "high"
  | "critical"
  | "unknown";

export type FiMedicalIntelligenceClinicalFlag = "Fe" | "T" | "A" | "⊕" | "!" | null;

export type FiMedicalIntelligenceInterpretedMarkerDisplay = {
  marker: string;
  value: number;
  unit: string | null;
  status: FiMedicalIntelligenceInterpretationStatus;
  clinical_flag: FiMedicalIntelligenceClinicalFlag;
  explanation: string;
};

export type FiMedicalIntelligenceDisplay = {
  source: "@hairlongevity/medical-intelligence-core";
  clinicianReviewRequired: true;
  computedAt: string;
  /** True when loaded from fi_pathology_results.metadata.medical_intelligence_snapshot. */
  fromSnapshot: boolean;
  interpretedMarkers: FiMedicalIntelligenceInterpretedMarkerDisplay[];
  skippedMarkerCount: number;
  /** Unique non-null clinical flags present on interpreted markers (Fe, T, A, etc.). */
  clinicalFlags: Array<Exclude<FiMedicalIntelligenceClinicalFlag, null>>;
  activeDrivers: string[];
  clinicianInsights: string[];
  patientSafeInsights: string[];
  followUpConsiderations: string[];
};

/** Compact summary for Patient Twin pathology card (optional — twin renders without it). */
export type FiMedicalIntelligenceTwinSummary = {
  pathology_result_id: string;
  result_date: string;
  status: string;
  interpreted_marker_count: number;
  clinical_flags: Array<Exclude<FiMedicalIntelligenceClinicalFlag, null>>;
  active_drivers: string[];
  insight_preview: string | null;
};

export const FI_MEDICAL_INTELLIGENCE_SOURCE = "@hairlongevity/medical-intelligence-core" as const;
