import type { ProfessionalGlobalId } from "../identity/types";

/** IIOHR Academy → FI OS competency export boundary (sanitized projection, not full ledger). */
export const FI_COMPETENCY_EXPORT_PAYLOAD_V1_VERSION = 1 as const;

export const FI_COMPETENCY_EXPORT_STATUSES = [
  "active",
  "expiring",
  "expired",
  "restricted",
  "suspended",
] as const;

export type FiCompetencyExportStatus = (typeof FI_COMPETENCY_EXPORT_STATUSES)[number];

export const FI_COMPETENCY_EXPORT_READINESS_BANDS = [
  "early",
  "developing",
  "supervised",
  "advanced",
] as const;

export type FiCompetencyExportReadinessBand = (typeof FI_COMPETENCY_EXPORT_READINESS_BANDS)[number];

/** Single competency row in an export batch — references only, no certificate PDFs. */
export interface FiCompetencyExportItemV1 {
  competencyKey: string;
  competencyStatus: FiCompetencyExportStatus;
  readinessBand?: FiCompetencyExportReadinessBand | null;
  certificationLevel?: string | null;
  evidenceCount?: number;
  /** Opaque certificate reference in IIOHR (not a public URL or PDF). */
  latestCertificate?: string | null;
  expiresAt?: string | null;
  lastVerifiedAt: string;
  metadata?: Record<string, unknown>;
}

/**
 * Batch export payload from IIOHR Stage 7 competency export system.
 * FI OS stores operational projections — IIOHR remains source of truth.
 */
export interface FiCompetencyExportPayload {
  schemaVersion: typeof FI_COMPETENCY_EXPORT_PAYLOAD_V1_VERSION;
  /** IIOHR export event id (`iiohr_fi_competency_export_events.id`). */
  exportEventId: string;
  tenantId: string;
  exportedAt: string;
  globalProfessionalId?: ProfessionalGlobalId | null;
  iiohrUserId?: string | null;
  academyProfileId?: string | null;
  /** Optional email hint for identity reconciliation (exact match only). */
  staffEmail?: string | null;
  competencies: FiCompetencyExportItemV1[];
}
