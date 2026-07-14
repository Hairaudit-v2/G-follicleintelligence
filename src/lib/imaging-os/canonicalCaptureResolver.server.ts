import "server-only";

import type { SupabaseClient } from "@supabase/supabase-js";
import { randomUUID } from "node:crypto";

import { supabaseAdmin } from "@/lib/supabaseAdmin";
import { PROGRESS_META_KEY } from "./protocolSlotVocabulary";
import { loadResolvedProtocol } from "./protocolCatalogResolver.server";
import { buildProtocolCatalogCaptureMetadata } from "./protocolCaptureMetadataCore";
import { TREATMENT_IMAGING_PROTOCOL_SLUG } from "./treatmentImagingProtocol";
import {
  buildCanonicalCaptureAuditMetadata,
  isCanonicalCaptureLegacyExempt,
  normalizeCanonicalCaptureSource,
  resolveTemplateSlugForCaptureContext,
  staffCaptureRequiresProtocolSession,
  type CanonicalCaptureContext,
} from "./canonicalCaptureResolverCore";
import { loadOrCreateSurgeryDayVieSession } from "@/src/lib/surgeryOs/surgeryOsVieCapture.server";

export type ResolveCanonicalSessionInput = {
  tenantId: string;
  patientId: string;
  captureSource: string;
  templateSlug?: string | null;
  caseId?: string | null;
  bookingId?: string | null;
  consultationId?: string | null;
  surgeryId?: string | null;
  procedureDayId?: string | null;
  bookingType?: string | null;
  client?: SupabaseClient;
};

export type ResolveCanonicalSessionResult = {
  sessionId: string;
  templateSlug: string;
  created: boolean;
  auditMetadata: Record<string, unknown>;
};

async function findActiveSessionForTemplate(
  client: SupabaseClient,
  tenantId: string,
  patientId: string,
  templateSlug: string,
  caseId: string | null
): Promise<string | null> {
  const { data, error } = await client
    .from("fi_imaging_protocol_sessions")
    .select("id, progress, case_id")
    .eq("tenant_id", tenantId)
    .eq("patient_id", patientId)
    .eq("template_slug", templateSlug)
    .order("updated_at", { ascending: false })
    .limit(5);
  if (error) throw new Error(error.message);

  for (const row of data ?? []) {
    const r = row as Record<string, unknown>;
    const progress =
      r.progress && typeof r.progress === "object" && !Array.isArray(r.progress)
        ? (r.progress as Record<string, unknown>)
        : {};
    const meta = progress[PROGRESS_META_KEY];
    const status =
      meta && typeof meta === "object" && !Array.isArray(meta)
        ? String((meta as { status?: string }).status ?? "")
        : "";
    if (status === "completed") continue;
    const sessionCaseId = r.case_id != null ? String(r.case_id) : null;
    if (caseId && sessionCaseId && sessionCaseId !== caseId) continue;
    return String(r.id);
  }
  return null;
}

/**
 * Resolve or create a canonical fi_imaging_protocol_sessions row for staff capture.
 */
export async function resolveOrCreateCanonicalProtocolSession(
  input: ResolveCanonicalSessionInput
): Promise<ResolveCanonicalSessionResult> {
  const client = input.client ?? supabaseAdmin();
  const tid = input.tenantId.trim();
  const pid = input.patientId.trim();
  const captureSource = normalizeCanonicalCaptureSource(input.captureSource);
  const templateSlug = resolveTemplateSlugForCaptureContext({
    captureSource,
    templateSlugFromRequest: input.templateSlug ?? null,
    bookingType: input.bookingType ?? null,
  });

  const resolved = await loadResolvedProtocol(tid, templateSlug, client);
  const catalogMeta = buildProtocolCatalogCaptureMetadata(resolved);

  if (templateSlug === "surgery_day" && captureSource === "surgery_os") {
    const surgerySession = await loadOrCreateSurgeryDayVieSession({
      tenantId: tid,
      patientId: pid,
      caseId: input.caseId ?? null,
      bookingId: input.bookingId ?? null,
      procedureDayId: input.procedureDayId ?? null,
      surgeryId: input.surgeryId ?? null,
      client,
    });
    return {
      sessionId: surgerySession.sessionId,
      templateSlug,
      created: surgerySession.created,
      auditMetadata: mergeAudit(captureSource, catalogMeta, templateSlug, surgerySession.created),
    };
  }

  const existingId = await findActiveSessionForTemplate(
    client,
    tid,
    pid,
    templateSlug,
    input.caseId?.trim() || null
  );
  if (existingId) {
    return {
      sessionId: existingId,
      templateSlug,
      created: false,
      auditMetadata: mergeAudit(captureSource, catalogMeta, templateSlug, false, true),
    };
  }

  const now = new Date().toISOString();
  const progressMeta: Record<string, unknown> = {
    status: "active" as const,
    capture_source: captureSource,
    ...catalogMeta,
  };
  if (input.bookingId || input.procedureDayId || input.surgeryId) {
    progressMeta.surgery_context = {
      booking_id: input.bookingId?.trim() || null,
      procedure_day_id: input.procedureDayId?.trim() || null,
      surgery_id: input.surgeryId?.trim() || null,
      capture_surface: captureSource,
    };
  }
  if (templateSlug === TREATMENT_IMAGING_PROTOCOL_SLUG && input.bookingId?.trim()) {
    progressMeta.treatment_context = {
      booking_id: input.bookingId.trim(),
      image_context: "treatment",
      protocol_slug: templateSlug,
      capture_surface: captureSource,
    };
  }

  const { data: ins, error } = await client
    .from("fi_imaging_protocol_sessions")
    .insert({
      id: randomUUID(),
      tenant_id: tid,
      patient_id: pid,
      case_id: input.caseId?.trim() || null,
      consultation_id: input.consultationId?.trim() || null,
      template_slug: templateSlug,
      progress: { [PROGRESS_META_KEY]: progressMeta },
      created_at: now,
      updated_at: now,
    })
    .select("id")
    .single();
  if (error) throw new Error(error.message);

  return {
    sessionId: String((ins as { id: string }).id),
    templateSlug,
    created: true,
    auditMetadata: mergeAudit(captureSource, catalogMeta, templateSlug, true),
  };
}

function mergeAudit(
  captureSource: string,
  catalogMeta: Record<string, unknown>,
  templateSlug: string,
  created: boolean,
  reused = false
): Record<string, unknown> {
  return {
    ...catalogMeta,
    ...buildCanonicalCaptureAuditMetadata({
      captureSource,
      protocolCatalogSource:
        typeof catalogMeta.protocol_catalog_source === "string"
          ? catalogMeta.protocol_catalog_source
          : null,
      protocolCatalogVersion:
        typeof catalogMeta.protocol_catalog_version === "string"
          ? catalogMeta.protocol_catalog_version
          : null,
      protocolTemplateSlug: templateSlug,
      sessionCreated: created,
      sessionReused: reused,
    }),
  };
}

export type EnsureCanonicalCaptureInput = CanonicalCaptureContext & {
  tenantId: string;
  patientId: string;
  bookingType?: string | null;
  procedureDayId?: string | null;
  surgeryId?: string | null;
};

export type EnsureCanonicalCaptureResult = {
  protocolSessionId: string;
  protocolTemplateSlug: string;
  protocolSlotSlug: string;
  auditMetadata: Record<string, unknown>;
  sessionCreated: boolean;
};

/**
 * Ensures staff capture has protocol session + slot. Auto-resolves session when missing.
 */
export async function ensureCanonicalStaffCapture(
  input: EnsureCanonicalCaptureInput
): Promise<EnsureCanonicalCaptureResult> {
  const source = normalizeCanonicalCaptureSource(input.captureSource);
  if (isCanonicalCaptureLegacyExempt(source)) {
    const sessionId = input.protocolSessionId?.trim() || "";
    return {
      protocolSessionId: sessionId,
      protocolTemplateSlug: input.protocolTemplateSlug?.trim() || "",
      protocolSlotSlug: input.protocolSlotSlug?.trim() || "",
      auditMetadata: buildCanonicalCaptureAuditMetadata({ captureSource: source }),
      sessionCreated: false,
    };
  }

  if (!staffCaptureRequiresProtocolSession(source)) {
    return {
      protocolSessionId: input.protocolSessionId?.trim() || "",
      protocolTemplateSlug: input.protocolTemplateSlug?.trim() || "",
      protocolSlotSlug: input.protocolSlotSlug?.trim() || "",
      auditMetadata: {},
      sessionCreated: false,
    };
  }

  let sessionId = input.protocolSessionId?.trim() || "";
  let templateSlug = input.protocolTemplateSlug?.trim() || "";
  let auditMetadata: Record<string, unknown> = {};
  let sessionCreated = false;

  if (!sessionId) {
    const resolved = await resolveOrCreateCanonicalProtocolSession({
      tenantId: input.tenantId,
      patientId: input.patientId,
      captureSource: source,
      templateSlug: templateSlug || null,
      caseId: input.caseId ?? null,
      bookingId: input.bookingId ?? null,
      surgeryId: input.surgeryId ?? null,
      procedureDayId: input.procedureDayId ?? null,
      bookingType: input.bookingType ?? null,
    });
    sessionId = resolved.sessionId;
    templateSlug = resolved.templateSlug;
    auditMetadata = resolved.auditMetadata;
    sessionCreated = resolved.created;
  }

  const slotSlug = input.protocolSlotSlug?.trim() || "";
  if (!slotSlug) {
    throw new Error("Protocol slot is required for each clinical capture.");
  }
  if (!templateSlug) {
    templateSlug = resolveTemplateSlugForCaptureContext({
      captureSource: source,
      templateSlugFromRequest: null,
      bookingType: input.bookingType ?? null,
    });
  }

  return {
    protocolSessionId: sessionId,
    protocolTemplateSlug: templateSlug,
    protocolSlotSlug: slotSlug,
    auditMetadata,
    sessionCreated,
  };
}
