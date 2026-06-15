import type { PatientGlobalId } from "../identity/types";

export const OUTCOME_SIGNAL_V1_VERSION = 1 as const;

/** FI OS — coarse outcome or progression signal (clinical boundary; minimize fields). */
export interface OutcomeSignalV1 {
  schemaVersion: typeof OUTCOME_SIGNAL_V1_VERSION;
  patientId: PatientGlobalId;
  recordedAt: string;
  outcomeKey: string;
  /** Discrete stage only — no free-text clinical notes in shared export. */
  stage?: string;
}
