import type { PatientGlobalId } from "../identity/types";

export const HLI_LONGEVITY_SIGNAL_V1_VERSION = 1 as const;

/**
 * HLI / Hair Longevity Institute — diagnostics or pathway signal (boundary).
 * Keep lab values out of shared exports; use bands or coded keys only.
 */
export interface HliLongevitySignalV1 {
  schemaVersion: typeof HLI_LONGEVITY_SIGNAL_V1_VERSION;
  patientId: PatientGlobalId;
  recordedAt: string;
  pathwayKey: string;
  signalKey: string;
  severityOrStage?: "low" | "moderate" | "high" | "unknown";
  supportingMetricKeys?: string[];
}
