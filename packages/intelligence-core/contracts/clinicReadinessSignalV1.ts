import type { ClinicGlobalId } from "../identity/types";

export const CLINIC_READINESS_SIGNAL_V1_VERSION = 1 as const;

/** FI OS — operational readiness without patient identifiers. */
export interface ClinicReadinessSignalV1 {
  schemaVersion: typeof CLINIC_READINESS_SIGNAL_V1_VERSION;
  clinicId: ClinicGlobalId;
  evaluatedAt: string;
  readinessKey: string;
  status: "not_ready" | "partial" | "ready" | "unknown";
}
