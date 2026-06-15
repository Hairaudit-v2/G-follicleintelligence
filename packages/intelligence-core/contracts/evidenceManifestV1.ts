import type { AuditCaseGlobalId } from "../identity/types";

export const EVIDENCE_MANIFEST_V1_VERSION = 1 as const;

/** HairAudit — evidence manifest pointer bundle (boundary). */
export interface EvidenceManifestV1 {
  schemaVersion: typeof EVIDENCE_MANIFEST_V1_VERSION;
  manifestId: string;
  auditCaseId: AuditCaseGlobalId;
  createdAt: string;
  /** Stable content addressing or storage keys — opaque strings only. */
  artefactRefs: string[];
}
