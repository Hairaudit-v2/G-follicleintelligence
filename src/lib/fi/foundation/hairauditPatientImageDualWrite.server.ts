import "server-only";

import type { SupabaseClient } from "@supabase/supabase-js";
import { randomUUID } from "node:crypto";
import { supabaseAdmin } from "@/lib/supabaseAdmin";
import { parseFiEventPayload } from "@/lib/fi/events/schema";
import type { FiEventEnvelope } from "@/src/types/fi-events";
import {
  planHairAuditPatientImageInsert,
  type HairAuditPatientImageInsertPlan,
} from "./hairauditPatientImageDualWriteCore";
import type { FoundationSupabase } from "./types";

const LOG_PREFIX = "[hairaudit-patient-image-dual-write]";

export type DualWriteHairAuditPatientImagesParams = {
  tenantId: string;
  fiEventId: string;
  fiCaseId: string;
  envelope: FiEventEnvelope;
  globalCaseId?: string | null;
  uploadIdsByStoragePath?: Record<string, string>;
  supabase?: FoundationSupabase;
};

export type DualWriteHairAuditPatientImagesResult = {
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
    plan: HairAuditPatientImageInsertPlan;
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
 * Dual-write HairAudit images into fi_patient_images after foundation ingest.
 * Never throws — failures are logged; primary fi_uploads ingest must succeed.
 */
export async function dualWriteHairAuditImagesToPatientLibrary(
  params: DualWriteHairAuditPatientImagesParams
): Promise<DualWriteHairAuditPatientImagesResult> {
  const { tenantId, fiEventId, fiCaseId, envelope, globalCaseId, uploadIdsByStoragePath } =
    params;
  const supabase: SupabaseClient = params.supabase ?? supabaseAdmin();
  const errors: string[] = [];
  let inserted = 0;
  let reused = 0;

  if (envelope.event_type !== "hairaudit.images.uploaded") {
    return { ok: false, skipped_reason: "unsupported_event_type", inserted, reused, errors };
  }

  const payloadResult = parseFiEventPayload(envelope.event_type, envelope.payload);
  if (!payloadResult.ok || !("images" in payloadResult.data)) {
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

    for (const image of payloadResult.data.images) {
      const storagePath = image.storage_path?.trim();
      if (!storagePath) continue;

      const plan = planHairAuditPatientImageInsert({
        image,
        fiEventId,
        sourceSystem: envelope.source_system,
        sourceCaseId,
        sourcePatientId,
        globalCaseId,
        fiUploadId: uploadIdsByStoragePath?.[storagePath] ?? null,
        occurredAt: envelope.occurred_at,
      });
      if (!plan) continue;

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