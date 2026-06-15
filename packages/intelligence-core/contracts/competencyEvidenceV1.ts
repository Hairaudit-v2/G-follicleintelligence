import type { OrganizationGlobalId, ProfessionalGlobalId } from "../identity/types";

/** IIOHR — minimal competency evidence boundary (not full ledger row). */
export const COMPETENCY_EVIDENCE_V1_VERSION = 1 as const;

export interface CompetencyEvidenceV1 {
  schemaVersion: typeof COMPETENCY_EVIDENCE_V1_VERSION;
  evidenceId: string;
  professionalId: ProfessionalGlobalId;
  issuingOrganizationId?: OrganizationGlobalId;
  competencyKey: string;
  recordedAt: string;
  /** Opaque reference to supporting artefact in IIOHR (not a public URL). */
  artefactRef?: string;
}
