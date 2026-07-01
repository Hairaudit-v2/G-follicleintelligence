import "server-only";

import type { SupabaseClient } from "@supabase/supabase-js";
import { randomUUID } from "node:crypto";
import { supabaseAdmin } from "@/lib/supabaseAdmin";
import { parseFiEventPayload } from "@/lib/fi/events/schema";
import type { FiEventEnvelope } from "@/src/types/fi-events";
import { evaluateImagingQuality } from "@/src/lib/imaging-os/imageQualityCore";
import { buildImagingQualityMetadataRecord } from "@/src/lib/imaging-os/imageQualityMetadata";
import { IMAGING_QUALITY_POLICY_DEFAULTS } from "@/src/lib/imaging-os/imageQualityPolicy";
import { loadImagingQualityPolicyForTenant } from "@/src/lib/imaging-os/imageQualityPolicy.server";
import type { ImagingQualityTenantPolicy } from "@/src/lib/imaging-os/imageQualityPolicy";
import {
  planHliPatientImageInsert,
  type HliPatientImageInsertPlan,
} from "./hliPatientImageDualWriteCore";
import type { FoundationSupabase } from "./types";

const LOG_PREFIX = "[hli-patient-image-dual-write]";

export type DualWriteHliDocumentToPatientLibraryParams = {
  tenantId: string;
  fiEventId: string;
  fiCaseId: string;
  envelope: FiEventEnvelope;
  globalCaseId?: string | null;
  fiUploadId?: string | null;
  imagingQualityPolicy?: ImagingQualityTenantPolicy;
  supabase?: FoundationSupabase;
};

export type DualWriteHliDocumentToPatientLibraryResult = {
  ok: boolean;
  skipped_reason?: string;
  inserted: number;
  reused: number;
  errors: string[];
};

function logDualWriteFailure(context: Record<string, unknown>, error: unknown): void {
  const message = error instanceof Error ? error.message : String(error);
  console.error(LOG_PREFIX, { ...context, message });
}

async function loadFoundationPatientForCase(
  supabase: SupabaseClient,
  tenantId: string,
  fiCaseId: string
): Promise<{ patientId: string; personId: string | null } | null> {
  const { data: caseRow, error: caseErr } = await supabase
    .from("fi_cases")
    .select("foundation_patient_id")
    .eq("tenant_id", tenantId)
    .eq("id", fiCaseId)
    .maybeSingle();
  if (caseErr) throw new Error(caseErr.message);

  const foundationPatientId = caseRow?.foundation_patient_id?.trim();
  if (!foundationPatientId) return null;

  const { data: patientRow, error: patientErr } = await supabase
    .from("fi_patients")
    .select("id, person_id")
    .eq("tenant_id", tenantId)
    .eq("id", foundationPatientId)
    .maybeSingle();
  if (patientErr) throw new Error(patientErr.message);
  if (!patientRow?.id) return null;

  return {
    patientId: String(patientRow.id),
    personId: patientRow.person_id == null ? null : String(patientRow.person_id),
  };
}

async function findExistingPatientImageId(
  supabase: SupabaseClient,
  storagePath: string
): Promise<string | null> {
  const { data, error } = await supabase
    .from("fi_patient_images")
    .select("id")
    .eq("storage_path", storagePath)
    .maybeSingle();
  if (error) throw new Error(error.message);
  return data?.id ? String(data.id) : null;
}

async function insertPatientImageRow(
  supabase: SupabaseClient,
  input: {
    tenantId: string;
    patientId: string;
    personId: string | null;
    fiCaseId: string;
    plan: HliPatientImageInsertPlan;
    occurredAt?: string | null;
  }
): Promise<"inserted" | "reused"> {
  const existingId = await findExistingPatientImageId(supabase, input.plan.storage_path);
  if (existingId) return "reused";

  const now = input.occurredAt?.trim() || new Date().toISOString();
  const { error } = await supabase.from("fi_patient_images").insert({
    id: randomUUID(),
    tenant_id: input.tenantId,
    patient_id: input.patientId,
    person_id: input.personId,
    case_id: input.fiCaseId,
    image_category: input.plan.image_category,
    image_status: "active",
    imaging_library_axis: input.plan.imaging_library_axis,
    storage_bucket: input.plan.storage_bucket,
    storage_path: input.plan.storage_path,
    original_filename: input.plan.original_filename,
    content_type: input.plan.content_type,
    file_size_bytes: input.plan.file_size_bytes,
    metadata: input.plan.metadata,
    taken_at: now,
    created_at: now,
    updated_at: now,
  });

  if (error?.code === "23505") return "reused";
  if (error) throw new Error(error.message);
  return "inserted";
}

/**
 * Dual-write HLI image documents into fi_patient_images after foundation ingest.
 * Never throws — failures are logged; primary fi_uploads ingest must succeed.
 */
export async function dualWriteHliDocumentToPatientLibrary(
  params: DualWriteHliDocumentToPatientLibraryParams
): Promise<DualWriteHliDocumentToPatientLibraryResult> {
  const { tenantId, fiEventId, fiCaseId, envelope, globalCaseId, fiUploadId } = params;
  const supabase: SupabaseClient = params.supabase ?? supabaseAdmin();
  const errors: string[] = [];
  let inserted = 0;
  let reused = 0;

  if (envelope.event_type !== "hli.document.uploaded") {
    return { ok: false, skipped_reason: "unsupported_event_type", inserted, reused, errors };
  }

  const payloadResult = parseFiEventPayload(envelope.event_type, envelope.payload);
  if (!payloadResult.ok || !("document" in payloadResult.data)) {
    return { ok: false, skipped_reason: "invalid_payload", inserted, reused, errors };
  }

  try {
    const patientCtx = await loadFoundationPatientForCase(supabase, tenantId, fiCaseId);
    if (!patientCtx) {
      return {
        ok: false,
        skipped_reason: "missing_foundation_patient",
        inserted,
        reused,
        errors,
      };
    }

    const sourceCaseId = envelope.identifiers?.source_case_id?.trim() || null;
    const sourcePatientId = envelope.identifiers?.source_patient_id?.trim() || null;
    const qualityPolicy =
      params.imagingQualityPolicy ??
      (await loadImagingQualityPolicyForTenant(tenantId, supabase).catch(
        () => IMAGING_QUALITY_POLICY_DEFAULTS
      ));

    const document = payloadResult.data.document;
    const storagePath = document.storage_path?.trim();
    if (!storagePath) {
      return { ok: true, skipped_reason: "no_storage_path", inserted, reused, errors };
    }

    const plan = planHliPatientImageInsert({
      document,
      fiEventId,
      sourceSystem: envelope.source_system,
      sourceCaseId,
      sourcePatientId,
      globalCaseId,
      fiUploadId: fiUploadId ?? null,
      occurredAt: envelope.occurred_at,
    });
    if (!plan) {
      return { ok: true, skipped_reason: "ineligible_document", inserted, reused, errors };
    }

    const qualityEvaluation = evaluateImagingQuality({
      image_metadata: {
        size_bytes: document.size_bytes ?? null,
        content_type: document.mime_type ?? null,
        missing_required_fields: ["dimensions"],
      },
      protocol_context: {
        capture_source: "hli",
        is_audit_context: false,
        slot_required: false,
      },
      policy: qualityPolicy,
    });
    plan.metadata = {
      ...plan.metadata,
      imaging_quality: buildImagingQualityMetadataRecord({
        evaluation: qualityEvaluation,
        blur_status: "unknown",
        exposure_status: "unknown",
        duplicate_status: "unique",
      }),
      classifier_status:
        typeof plan.metadata.classifier_status === "string"
          ? plan.metadata.classifier_status
          : qualityEvaluation.status,
    };

    try {
      const outcome = await insertPatientImageRow(supabase, {
        tenantId,
        patientId: patientCtx.patientId,
        personId: patientCtx.personId,
        fiCaseId,
        plan,
        occurredAt: envelope.occurred_at,
      });
      if (outcome === "inserted") inserted += 1;
      else reused += 1;
    } catch (imageErr: unknown) {
      const msg = imageErr instanceof Error ? imageErr.message : String(imageErr);
      errors.push(`${storagePath}: ${msg}`);
      logDualWriteFailure({ tenantId, fiEventId, fiCaseId, storagePath }, imageErr);
    }

    return {
      ok: errors.length === 0,
      inserted,
      reused,
      errors,
    };
  } catch (error: unknown) {
    logDualWriteFailure({ tenantId, fiEventId, fiCaseId }, error);
    return {
      ok: false,
      inserted,
      reused,
      errors: [error instanceof Error ? error.message : "Unknown dual-write error."],
    };
  }
}