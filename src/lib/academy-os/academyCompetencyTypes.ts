/**
 * AcademyOS competency projection types — FI OS operational store (not IIOHR ledger).
 */

export const ACADEMY_COMPETENCY_STATUSES = [
  "active",
  "expiring",
  "expired",
  "restricted",
  "suspended",
] as const;

export type AcademyCompetencyStatus = (typeof ACADEMY_COMPETENCY_STATUSES)[number];

export const ACADEMY_READINESS_BANDS = ["early", "developing", "supervised", "advanced"] as const;

export type AcademyReadinessBand = (typeof ACADEMY_READINESS_BANDS)[number];

export const COMPETENCY_IMPORT_EVENT_STATUSES = [
  "processed",
  "failed",
  "unresolved_staff",
  "validation_failed",
] as const;

export type CompetencyImportEventStatus = (typeof COMPETENCY_IMPORT_EVENT_STATUSES)[number];

export type FiStaffCompetencyProjectionRow = {
  id: string;
  tenantId: string;
  staffId: string;
  sourceSystem: string;
  globalProfessionalId: string | null;
  iiohrUserId: string | null;
  academyProfileId: string | null;
  competencyKey: string;
  competencyStatus: AcademyCompetencyStatus;
  readinessBand: AcademyReadinessBand | null;
  certificationLevel: string | null;
  evidenceCount: number;
  latestCertificate: string | null;
  sourceExportEventId: string | null;
  metadata: Record<string, unknown>;
  expiresAt: string | null;
  lastVerifiedAt: string;
  createdAt: string;
  updatedAt: string;
};

export type CompetencyExportValidationResult =
  | { ok: true; payload: import("@follicle/intelligence-core/contracts").FiCompetencyExportPayload }
  | { ok: false; error: string };

export type CompetencyExportReceiveResult =
  | {
      ok: true;
      status: "processed";
      staffId: string;
      identityResolution: string;
      projectionsUpserted: number;
      exportEventId: string;
      importEventId: string;
    }
  | {
      ok: false;
      status: CompetencyImportEventStatus;
      error: string;
      importEventId?: string;
    };

export type StaffIdentityResolutionResult =
  | { ok: true; staffId: string; method: "global_professional_id" | "academy_profile_id" | "iiohr_user_id" | "staff_email" }
  | { ok: false; reason: string };
