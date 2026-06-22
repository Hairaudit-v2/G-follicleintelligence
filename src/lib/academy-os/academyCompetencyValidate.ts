import {
  FI_COMPETENCY_EXPORT_PAYLOAD_V1_VERSION,
  FI_COMPETENCY_EXPORT_READINESS_BANDS,
  FI_COMPETENCY_EXPORT_STATUSES,
  type FiCompetencyExportItemV1,
  type FiCompetencyExportPayload,
} from "@follicle/intelligence-core/contracts";

import type { CompetencyExportValidationResult } from "./academyCompetencyTypes";

const COMPETENCY_KEY_PATTERN = /^[a-z0-9][a-z0-9_.-]{0,127}$/;

function isRecord(v: unknown): v is Record<string, unknown> {
  return typeof v === "object" && v !== null && !Array.isArray(v);
}

function trimStr(v: unknown): string {
  return typeof v === "string" ? v.trim() : "";
}

function isIsoLike(s: string): boolean {
  return s.length > 0 && !Number.isNaN(Date.parse(s));
}

function isUuidLike(s: string): boolean {
  return /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(s);
}

function parseCompetencyItem(raw: unknown, index: number): FiCompetencyExportItemV1 | null {
  if (!isRecord(raw)) return null;

  const competencyKey = trimStr(raw.competencyKey ?? raw.competency_key).toLowerCase();
  if (!competencyKey || !COMPETENCY_KEY_PATTERN.test(competencyKey)) return null;

  const statusRaw = trimStr(raw.competencyStatus ?? raw.competency_status).toLowerCase();
  if (!(FI_COMPETENCY_EXPORT_STATUSES as readonly string[]).includes(statusRaw)) return null;

  const lastVerifiedAt = trimStr(raw.lastVerifiedAt ?? raw.last_verified_at);
  if (!lastVerifiedAt || !isIsoLike(lastVerifiedAt)) return null;

  const readinessRaw = trimStr(raw.readinessBand ?? raw.readiness_band).toLowerCase();
  const readinessBand =
    readinessRaw && (FI_COMPETENCY_EXPORT_READINESS_BANDS as readonly string[]).includes(readinessRaw)
      ? (readinessRaw as FiCompetencyExportItemV1["readinessBand"])
      : null;

  const expiresAtRaw = trimStr(raw.expiresAt ?? raw.expires_at);
  const expiresAt = expiresAtRaw && isIsoLike(expiresAtRaw) ? expiresAtRaw : null;

  const evidenceCountRaw = raw.evidenceCount ?? raw.evidence_count;
  const evidenceCount =
    typeof evidenceCountRaw === "number" && Number.isFinite(evidenceCountRaw) && evidenceCountRaw >= 0
      ? Math.floor(evidenceCountRaw)
      : 0;

  const certificationLevel = trimStr(raw.certificationLevel ?? raw.certification_level) || null;
  const latestCertificate = trimStr(raw.latestCertificate ?? raw.latest_certificate) || null;

  const metadataRaw = raw.metadata;
  const metadata =
    metadataRaw && isRecord(metadataRaw) ? (metadataRaw as Record<string, unknown>) : undefined;

  return {
    competencyKey,
    competencyStatus: statusRaw as FiCompetencyExportItemV1["competencyStatus"],
    readinessBand,
    certificationLevel,
    evidenceCount,
    latestCertificate,
    expiresAt,
    lastVerifiedAt,
    ...(metadata ? { metadata } : {}),
  };
}

/**
 * Validates inbound IIOHR competency export payload structure.
 * Accepts snake_case aliases for interoperability with Stage 7 export system.
 */
export function validateCompetencyExportPayload(input: unknown): CompetencyExportValidationResult {
  if (!isRecord(input)) {
    return { ok: false, error: "Payload must be a JSON object." };
  }

  const schemaVersion = input.schemaVersion ?? input.schema_version;
  if (schemaVersion !== FI_COMPETENCY_EXPORT_PAYLOAD_V1_VERSION) {
    return { ok: false, error: `Unsupported schemaVersion; expected ${FI_COMPETENCY_EXPORT_PAYLOAD_V1_VERSION}.` };
  }

  const exportEventId = trimStr(input.exportEventId ?? input.export_event_id);
  if (!exportEventId) {
    return { ok: false, error: "exportEventId is required." };
  }

  const tenantId = trimStr(input.tenantId ?? input.tenant_id);
  if (!tenantId || !isUuidLike(tenantId)) {
    return { ok: false, error: "tenantId must be a valid UUID." };
  }

  const exportedAt = trimStr(input.exportedAt ?? input.exported_at);
  if (!exportedAt || !isIsoLike(exportedAt)) {
    return { ok: false, error: "exportedAt must be a valid ISO-8601 timestamp." };
  }

  const competenciesRaw = input.competencies;
  if (!Array.isArray(competenciesRaw) || competenciesRaw.length === 0) {
    return { ok: false, error: "competencies must be a non-empty array." };
  }

  const competencies: FiCompetencyExportItemV1[] = [];
  for (let i = 0; i < competenciesRaw.length; i++) {
    const item = parseCompetencyItem(competenciesRaw[i], i);
    if (!item) {
      return { ok: false, error: `Invalid competency item at index ${i}.` };
    }
    competencies.push(item);
  }

  const globalProfessionalId = trimStr(input.globalProfessionalId ?? input.global_professional_id) || null;
  const iiohrUserId = trimStr(input.iiohrUserId ?? input.iiohr_user_id) || null;
  const academyProfileId = trimStr(input.academyProfileId ?? input.academy_profile_id) || null;
  const staffEmail = trimStr(input.staffEmail ?? input.staff_email) || null;

  if (!globalProfessionalId && !iiohrUserId && !academyProfileId && !staffEmail) {
    return {
      ok: false,
      error: "At least one identity field is required (globalProfessionalId, academyProfileId, iiohrUserId, or staffEmail).",
    };
  }

  const payload: FiCompetencyExportPayload = {
    schemaVersion: FI_COMPETENCY_EXPORT_PAYLOAD_V1_VERSION,
    exportEventId,
    tenantId,
    exportedAt,
    competencies,
    ...(globalProfessionalId ? { globalProfessionalId } : {}),
    ...(iiohrUserId ? { iiohrUserId } : {}),
    ...(academyProfileId ? { academyProfileId } : {}),
    ...(staffEmail ? { staffEmail } : {}),
  };

  return { ok: true, payload };
}
