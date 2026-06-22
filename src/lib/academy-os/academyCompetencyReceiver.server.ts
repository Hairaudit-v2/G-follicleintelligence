import type { SupabaseClient } from "@supabase/supabase-js";

import type { FiCompetencyExportItemV1, FiCompetencyExportPayload } from "@follicle/intelligence-core/contracts";

import { supabaseAdmin } from "@/lib/supabaseAdmin";
import { assertNonEmptyUuid } from "@/src/lib/crm/validation";
import { WORKFORCE_IDENTITY_SOURCE_SYSTEMS } from "@/src/lib/workforce-os/workforceIdentitySources";
import {
  getStaffIdentityLinksByExternalId,
  linkAcademyProfileToFiStaff,
  upsertStaffIdentityLink,
} from "@/src/lib/workforce-os/workforceIdentityLinks.server";
import { mergeWorkforceIdentityMetadata, sanitizeWorkforceIdentityMetadata } from "@/src/lib/workforce-os/workforceIdentityMetadata";

import { publishAcademyCompetencyAnalytics } from "./academyAnalyticsPublisher.server";
import type {
  CompetencyExportReceiveResult,
  FiStaffCompetencyProjectionRow,
  StaffIdentityResolutionResult,
} from "./academyCompetencyTypes";
import { validateCompetencyExportPayload } from "./academyCompetencyValidate";

function mapProjectionRow(raw: Record<string, unknown>): FiStaffCompetencyProjectionRow {
  return {
    id: String(raw.id),
    tenantId: String(raw.tenant_id),
    staffId: String(raw.staff_id),
    sourceSystem: String(raw.source_system),
    globalProfessionalId: raw.global_professional_id != null ? String(raw.global_professional_id) : null,
    iiohrUserId: raw.iiohr_user_id != null ? String(raw.iiohr_user_id) : null,
    academyProfileId: raw.academy_profile_id != null ? String(raw.academy_profile_id) : null,
    competencyKey: String(raw.competency_key),
    competencyStatus: String(raw.competency_status) as FiStaffCompetencyProjectionRow["competencyStatus"],
    readinessBand:
      raw.readiness_band != null ? (String(raw.readiness_band) as FiStaffCompetencyProjectionRow["readinessBand"]) : null,
    certificationLevel: raw.certification_level != null ? String(raw.certification_level) : null,
    evidenceCount: Number(raw.evidence_count ?? 0),
    latestCertificate: raw.latest_certificate != null ? String(raw.latest_certificate) : null,
    sourceExportEventId: raw.source_export_event_id != null ? String(raw.source_export_event_id) : null,
    metadata:
      raw.metadata && typeof raw.metadata === "object" && !Array.isArray(raw.metadata)
        ? (raw.metadata as Record<string, unknown>)
        : {},
    expiresAt: raw.expires_at != null ? String(raw.expires_at) : null,
    lastVerifiedAt: String(raw.last_verified_at),
    createdAt: String(raw.created_at),
    updatedAt: String(raw.updated_at),
  };
}

async function logCompetencyImportEvent(
  input: {
    tenantId: string | null;
    status: "processed" | "failed" | "unresolved_staff" | "validation_failed";
    payload: Record<string, unknown>;
    failureReason?: string | null;
  },
  client: SupabaseClient
): Promise<string> {
  const { data, error } = await client
    .from("fi_competency_import_events")
    .insert({
      tenant_id: input.tenantId,
      status: input.status,
      payload: input.payload,
      failure_reason: input.failureReason ?? null,
      processed_at: new Date().toISOString(),
    })
    .select("id")
    .single();

  if (error) throw new Error(error.message);
  return String((data as { id: string }).id);
}

/**
 * Resolves FI staff by global professional id across Nexus/HR/Academy metadata.
 */
export async function resolveStaffByGlobalProfessionalId(
  tenantId: string,
  globalProfessionalId: string,
  client?: SupabaseClient
): Promise<string | null> {
  const tid = assertNonEmptyUuid(tenantId, "tenantId");
  const gid = globalProfessionalId.trim();
  if (!gid) return null;

  const supabase = client ?? supabaseAdmin();

  const nexusLink = await getStaffIdentityLinksByExternalId(
    tid,
    WORKFORCE_IDENTITY_SOURCE_SYSTEMS.IIOHR_NEXUS,
    gid,
    supabase
  );
  if (nexusLink) return nexusLink.staffId;

  const { data, error } = await supabase
    .from("fi_staff_source_ids")
    .select("staff_id, metadata")
    .eq("tenant_id", tid)
    .limit(50);

  if (error) throw new Error(error.message);

  for (const row of data ?? []) {
    const md = (row as { metadata?: unknown }).metadata;
    if (md && typeof md === "object" && !Array.isArray(md)) {
      const metaGid = String((md as Record<string, unknown>).global_professional_id ?? "").trim();
      if (metaGid === gid) return String((row as { staff_id: string }).staff_id);
    }
  }

  return null;
}

/** Resolves FI staff by IIOHR Academy profile id. */
export async function resolveStaffByAcademyProfile(
  tenantId: string,
  academyProfileId: string,
  client?: SupabaseClient
): Promise<string | null> {
  const link = await getStaffIdentityLinksByExternalId(
    tenantId,
    WORKFORCE_IDENTITY_SOURCE_SYSTEMS.IIOHR_ACADEMY,
    academyProfileId,
    client
  );
  return link?.staffId ?? null;
}

/** Resolves FI staff by IIOHR user id stored in source-id metadata. */
export async function resolveStaffByIiohrUserId(
  tenantId: string,
  iiohrUserId: string,
  client?: SupabaseClient
): Promise<string | null> {
  const tid = assertNonEmptyUuid(tenantId, "tenantId");
  const uid = iiohrUserId.trim();
  if (!uid) return null;

  const supabase = client ?? supabaseAdmin();
  const { data, error } = await supabase
    .from("fi_staff_source_ids")
    .select("staff_id, metadata")
    .eq("tenant_id", tid);

  if (error) throw new Error(error.message);

  const matches: string[] = [];
  for (const row of data ?? []) {
    const md = (row as { metadata?: unknown }).metadata;
    if (md && typeof md === "object" && !Array.isArray(md)) {
      const metaUid = String((md as Record<string, unknown>).iiohr_user_id ?? "").trim();
      if (metaUid === uid) matches.push(String((row as { staff_id: string }).staff_id));
    }
  }

  return matches.length === 1 ? matches[0]! : null;
}

/** Resolves FI staff by exact email match (single active staff only). */
async function resolveStaffByEmailSafe(
  tenantId: string,
  email: string,
  client?: SupabaseClient
): Promise<string | null> {
  const tid = assertNonEmptyUuid(tenantId, "tenantId");
  const normalized = email.trim().toLowerCase();
  if (!normalized || !normalized.includes("@")) return null;

  const supabase = client ?? supabaseAdmin();
  const { data, error } = await supabase
    .from("fi_staff")
    .select("id, email, is_active")
    .eq("tenant_id", tid)
    .ilike("email", normalized);

  if (error) throw new Error(error.message);

  const active = (data ?? []).filter((r) => (r as { is_active?: boolean }).is_active !== false);
  if (active.length !== 1) return null;
  return String((active[0] as { id: string }).id);
}

/** Priority: global_professional_id → academy_profile_id → iiohr_user_id → staff email. */
export async function resolveStaffForCompetencyExport(
  payload: FiCompetencyExportPayload,
  client?: SupabaseClient
): Promise<StaffIdentityResolutionResult> {
  const tid = payload.tenantId;

  if (payload.globalProfessionalId?.trim()) {
    const staffId = await resolveStaffByGlobalProfessionalId(tid, payload.globalProfessionalId, client);
    if (staffId) return { ok: true, staffId, method: "global_professional_id" };
  }

  if (payload.academyProfileId?.trim()) {
    const staffId = await resolveStaffByAcademyProfile(tid, payload.academyProfileId, client);
    if (staffId) return { ok: true, staffId, method: "academy_profile_id" };
  }

  if (payload.iiohrUserId?.trim()) {
    const staffId = await resolveStaffByIiohrUserId(tid, payload.iiohrUserId, client);
    if (staffId) return { ok: true, staffId, method: "iiohr_user_id" };
  }

  if (payload.staffEmail?.trim()) {
    const staffId = await resolveStaffByEmailSafe(tid, payload.staffEmail, client);
    if (staffId) return { ok: true, staffId, method: "staff_email" };
  }

  return { ok: false, reason: "No matching FI staff identity found for export payload." };
}

async function syncAcademyIdentityMetadata(
  payload: FiCompetencyExportPayload,
  staffId: string,
  client: SupabaseClient
): Promise<void> {
  const now = payload.exportedAt;

  if (payload.academyProfileId?.trim()) {
    await linkAcademyProfileToFiStaff(
      {
        tenantId: payload.tenantId,
        staffId,
        academyProfileId: payload.academyProfileId.trim(),
        iiohrUserId: payload.iiohrUserId ?? null,
        lastSyncedAt: now,
      },
      client
    );
    return;
  }

  const metadataPatch = sanitizeWorkforceIdentityMetadata({
    competency_source: "iiohr_academy",
    sync_status: "active",
    ...(payload.globalProfessionalId?.trim() ? { global_professional_id: payload.globalProfessionalId.trim() } : {}),
    ...(payload.iiohrUserId?.trim() ? { iiohr_user_id: payload.iiohrUserId.trim() } : {}),
  });

  if (Object.keys(metadataPatch).length === 0) return;

  const existing = await getStaffIdentityLinksByExternalId(
    payload.tenantId,
    WORKFORCE_IDENTITY_SOURCE_SYSTEMS.IIOHR_ACADEMY,
    payload.globalProfessionalId ?? payload.iiohrUserId ?? staffId,
    client
  );

  if (existing) {
    await upsertStaffIdentityLink(
      {
        tenantId: payload.tenantId,
        staffId,
        sourceSystem: WORKFORCE_IDENTITY_SOURCE_SYSTEMS.IIOHR_ACADEMY,
        sourceStaffId: existing.sourceStaffId,
        metadata: mergeWorkforceIdentityMetadata(existing.metadata, metadataPatch),
        lastSyncedAt: now,
      },
      client
    );
  }
}

/** Upserts a single competency projection row (no orphan records without staff_id). */
export async function upsertCompetencyProjection(
  input: {
    tenantId: string;
    staffId: string;
    item: FiCompetencyExportItemV1;
    payload: FiCompetencyExportPayload;
  },
  client?: SupabaseClient
): Promise<FiStaffCompetencyProjectionRow> {
  const supabase = client ?? supabaseAdmin();
  const tid = assertNonEmptyUuid(input.tenantId, "tenantId");
  const sid = assertNonEmptyUuid(input.staffId, "staffId");
  const now = new Date().toISOString();

  const row = {
    tenant_id: tid,
    staff_id: sid,
    source_system: "iiohr_academy",
    global_professional_id: input.payload.globalProfessionalId?.trim() ?? null,
    iiohr_user_id: input.payload.iiohrUserId?.trim() ?? null,
    academy_profile_id: input.payload.academyProfileId?.trim() ?? null,
    competency_key: input.item.competencyKey,
    competency_status: input.item.competencyStatus,
    readiness_band: input.item.readinessBand ?? null,
    certification_level: input.item.certificationLevel ?? null,
    evidence_count: input.item.evidenceCount ?? 0,
    latest_certificate: input.item.latestCertificate ?? null,
    source_export_event_id: input.payload.exportEventId,
    metadata: input.item.metadata ?? {},
    expires_at: input.item.expiresAt ?? null,
    last_verified_at: input.item.lastVerifiedAt,
    updated_at: now,
  };

  const { data, error } = await supabase
    .from("fi_staff_competency_projections")
    .upsert(row, { onConflict: "tenant_id,staff_id,competency_key" })
    .select("*")
    .single();

  if (error) throw new Error(error.message);
  return mapProjectionRow(data as Record<string, unknown>);
}

/** Loads competency projections for a staff member (tenant-scoped). */
export async function loadStaffCompetencyProjections(
  tenantId: string,
  staffId: string,
  client?: SupabaseClient
): Promise<FiStaffCompetencyProjectionRow[]> {
  const tid = assertNonEmptyUuid(tenantId, "tenantId");
  const sid = assertNonEmptyUuid(staffId, "staffId");
  const supabase = client ?? supabaseAdmin();

  const { data, error } = await supabase
    .from("fi_staff_competency_projections")
    .select("*")
    .eq("tenant_id", tid)
    .eq("staff_id", sid)
    .order("competency_key", { ascending: true });

  if (error) throw new Error(error.message);
  return ((data ?? []) as Record<string, unknown>[]).map(mapProjectionRow);
}

export type ReceiveIiohrCompetencyExportOptions = {
  supabaseClient?: SupabaseClient;
  skipAnalytics?: boolean;
};

/**
 * Main ingestion entry — validates payload, resolves staff, upserts projections, logs audit trail.
 * Does not auto-create staff. Does not store certificate PDFs.
 */
export async function receiveIiohrCompetencyExport(
  rawPayload: unknown,
  options?: ReceiveIiohrCompetencyExportOptions
): Promise<CompetencyExportReceiveResult> {
  const client = options?.supabaseClient ?? supabaseAdmin();
  const payloadRecord =
    rawPayload && typeof rawPayload === "object" && !Array.isArray(rawPayload)
      ? (rawPayload as Record<string, unknown>)
      : {};

  const validated = validateCompetencyExportPayload(rawPayload);
  if (!validated.ok) {
    const importEventId = await logCompetencyImportEvent(
      {
        tenantId: trimUuid(payloadRecord.tenantId ?? payloadRecord.tenant_id),
        status: "validation_failed",
        payload: payloadRecord,
        failureReason: validated.error,
      },
      client
    );
    return { ok: false, status: "validation_failed", error: validated.error, importEventId };
  }

  const payload = validated.payload;

  const resolution = await resolveStaffForCompetencyExport(payload, client);
  if (!resolution.ok) {
    const importEventId = await logCompetencyImportEvent(
      {
        tenantId: payload.tenantId,
        status: "unresolved_staff",
        payload: payloadRecord,
        failureReason: resolution.reason,
      },
      client
    );
    return { ok: false, status: "unresolved_staff", error: resolution.reason, importEventId };
  }

  try {
    await syncAcademyIdentityMetadata(payload, resolution.staffId, client);

    const upserted: FiStaffCompetencyProjectionRow[] = [];
    for (const item of payload.competencies) {
      const projection = await upsertCompetencyProjection(
        { tenantId: payload.tenantId, staffId: resolution.staffId, item, payload },
        client
      );
      upserted.push(projection);
    }

    const importEventId = await logCompetencyImportEvent(
      {
        tenantId: payload.tenantId,
        status: "processed",
        payload: {
          exportEventId: payload.exportEventId,
          staffId: resolution.staffId,
          identityResolution: resolution.method,
          projectionsUpserted: upserted.length,
        },
      },
      client
    );

    if (!options?.skipAnalytics) {
      void publishAcademyCompetencyAnalytics({
        tenantId: payload.tenantId,
        staffId: resolution.staffId,
        projections: upserted,
        exportEventId: payload.exportEventId,
      }).catch(() => undefined);
    }

    return {
      ok: true,
      status: "processed",
      staffId: resolution.staffId,
      identityResolution: resolution.method,
      projectionsUpserted: upserted.length,
      exportEventId: payload.exportEventId,
      importEventId,
    };
  } catch (e: unknown) {
    const message = e instanceof Error ? e.message : "Competency export processing failed.";
    const importEventId = await logCompetencyImportEvent(
      {
        tenantId: payload.tenantId,
        status: "failed",
        payload: payloadRecord,
        failureReason: message,
      },
      client
    );
    return { ok: false, status: "failed", error: message, importEventId };
  }
}

function trimUuid(v: unknown): string | null {
  const s = typeof v === "string" ? v.trim() : "";
  return /^[0-9a-f-]{36}$/i.test(s) ? s : null;
}

export { validateCompetencyExportPayload };
