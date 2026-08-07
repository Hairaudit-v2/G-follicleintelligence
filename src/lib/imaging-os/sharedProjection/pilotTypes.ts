/** Client-safe pilot preflight record (no server imports). */

export type PilotPreflightRecord = {
  tenantId: string;
  caseId: string | null;
  planId: string;
  planVersion: number;
  hairlineId: string;
  hairlineVersion: number;
  sourceImageRef: string;
  treatmentMaskChecksum: string;
  graftTotal: number;
  assumptions: string[];
  estimatedCostUsd: number;
  providerId: string;
  modelVersion: string;
  view: string;
  mode: string;
  dpiaStatus: string;
};
