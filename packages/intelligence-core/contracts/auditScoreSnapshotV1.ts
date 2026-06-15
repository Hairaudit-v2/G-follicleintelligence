import type { AuditCaseGlobalId } from "../identity/types";

export const AUDIT_SCORE_SNAPSHOT_V1_VERSION = 1 as const;

/** HairAudit — scoring snapshot at a point in time (boundary). */
export interface AuditScoreSnapshotV1 {
  schemaVersion: typeof AUDIT_SCORE_SNAPSHOT_V1_VERSION;
  auditCaseId: AuditCaseGlobalId;
  capturedAt: string;
  scoreKind: string;
  /** Normalized score bucket — avoid raw proprietary rubrics in shared export. */
  scoreBand: "low" | "mid" | "high" | "unknown";
  manifestRef?: string;
}
