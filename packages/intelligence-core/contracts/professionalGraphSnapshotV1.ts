import type { PseudonymousSubjectId } from "../identity/types";

export const PROFESSIONAL_GRAPH_SNAPSHOT_V1_VERSION = 1 as const;

/** Read-model snapshot for professional intelligence graph export (non-PHI). */
export interface ProfessionalGraphSnapshotV1 {
  schemaVersion: typeof PROFESSIONAL_GRAPH_SNAPSHOT_V1_VERSION;
  snapshotAt: string;
  nodes: Array<{
    id: PseudonymousSubjectId;
    labelKey?: string;
    edges?: Array<{ to: PseudonymousSubjectId; kind: string }>;
  }>;
}
