import "server-only";

import type { SupabaseClient } from "@supabase/supabase-js";
import { supabaseAdmin } from "@/lib/supabaseAdmin";
import { createPathologyResult, type PathologyResultItemInput } from "@/src/lib/pathology/pathologyResultMutations.server";
import { loadPathologyInboxDocument } from "@/src/lib/pathology/pathologyInboxLoad.server";
import type {
  PathologyExtractionJobRow,
  PathologyInboundDocumentListItem,
  PathologyInboundDocumentRow,
} from "@/src/lib/pathology/pathologyInboxTypes";
import {
  normalizedMarkersToResultItemInputs,
  type NormalizedPathologyMarker,
} from "@/src/lib/pathology/pathologyMarkerNormalize";
import { readPathologyAutoDraftEnabled } from "@/src/lib/pathology/pathologyExtractionEnv.server";
import { loadPathologyExtractionJobById } from "@/src/lib/pathology/pathologyExtractionJobRunner.server";

function markersFromJob(job: PathologyExtractionJobRow): NormalizedPathologyMarker[] {
  const raw = job.normalized_items_json;
  if (!Array.isArray(raw)) return [];
  return raw
    .filter((row) => row && typeof row === "object" && !Array.isArray(row))
    .map((row) => {
      const r = row as Record<string, unknown>;
      return {
        test_code: r.test_code != null ? String(r.test_code) : null,
        test_label: String(r.test_label ?? ""),
        result_value: String(r.result_value ?? ""),
        result_unit: r.result_unit != null ? String(r.result_unit) : null,
        reference_range: r.reference_range != null ? String(r.reference_range) : null,
        flag: (String(r.flag ?? "unknown") as NormalizedPathologyMarker["flag"]),
        confidence:
          typeof r.confidence === "number" && Number.isFinite(r.confidence) ? r.confidence : null,
        source: "extraction" as const,
      };
    })
    .filter((m) => m.test_label.trim().length > 0);
}

function resultItemsFromNormalized(markers: NormalizedPathologyMarker[]): PathologyResultItemInput[] {
  return normalizedMarkersToResultItemInputs(markers);
}

export type CreateDraftFromExtractionInput = {
  tenantId: string;
  documentId: string;
  actingUserId: string | null;
  resultDate?: string;
  providerName?: string | null;
  clinicalSummary?: string | null;
};

export type CreateDraftFromExtractionOutput = {
  inbound: PathologyInboundDocumentListItem;
  resultId: string;
  created: boolean;
};

async function loadInboundRow(
  supabase: SupabaseClient,
  tenantId: string,
  documentId: string
): Promise<PathologyInboundDocumentRow> {
  const { data, error } = await supabase
    .from("fi_pathology_inbound_documents")
    .select("*")
    .eq("tenant_id", tenantId)
    .eq("id", documentId)
    .maybeSingle();
  if (error) throw new Error(error.message);
  if (!data) throw new Error("Inbound document not found.");
  return data as unknown as PathologyInboundDocumentRow;
}

/** Create draft pathology result from latest successful extraction when patient is matched. */
export async function createDraftPathologyResultFromExtraction(
  input: CreateDraftFromExtractionInput,
  client?: SupabaseClient
): Promise<CreateDraftFromExtractionOutput> {
  const supabase = client ?? supabaseAdmin();
  const tid = input.tenantId.trim();
  const did = input.documentId.trim();

  const doc = await loadInboundRow(supabase, tid, did);
  if (doc.match_status !== "matched") {
    throw new Error("Document must be matched to a patient before creating a draft result.");
  }
  if (!doc.confirmed_patient_id) {
    throw new Error("Confirmed patient is required.");
  }
  if (doc.draft_result_id) {
    const loaded = await loadPathologyInboxDocument(tid, did, supabase);
    if (!loaded) throw new Error("Inbound document not found.");
    return { inbound: loaded, resultId: doc.draft_result_id, created: false };
  }
  if (!doc.extraction_job_id) {
    throw new Error("No extraction job linked to this document.");
  }

  const job = await loadPathologyExtractionJobById(tid, doc.extraction_job_id, supabase);
  if (!job) throw new Error("Extraction job not found.");
  if (job.review_status === "dismissed") {
    throw new Error("Dismissed extractions cannot create draft results.");
  }
  if (job.status !== "succeeded" && job.status !== "needs_review") {
    throw new Error("Extraction must succeed before creating a draft result.");
  }

  const markers = markersFromJob(job);
  const items = resultItemsFromNormalized(markers);

  if (!doc.storage_bucket || !doc.storage_path) {
    throw new Error("Inbound document has no stored PDF.");
  }
  const { data: pdfBlob, error: dlErr } = await supabase.storage
    .from(doc.storage_bucket)
    .download(doc.storage_path);
  if (dlErr) throw new Error(dlErr.message);
  const pdfBytes = new Uint8Array(await pdfBlob.arrayBuffer());

  const resultDate = input.resultDate?.trim() || new Date().toISOString().slice(0, 10);

  const { result } = await createPathologyResult(
    {
      tenantId: tid,
      patientId: doc.confirmed_patient_id,
      resultDate,
      providerName: input.providerName ?? null,
      pathologyRequestId: null,
      clinicalSummary: input.clinicalSummary ?? null,
      status: "draft",
      items,
      pdfBytes,
      originalFilename: doc.original_filename,
      actingUserId: input.actingUserId,
    },
    supabase
  );

  const { error: updErr } = await supabase
    .from("fi_pathology_inbound_documents")
    .update({ draft_result_id: result.id })
    .eq("tenant_id", tid)
    .eq("id", did);
  if (updErr) throw new Error(updErr.message);

  await supabase.from("fi_pathology_extraction_jobs").update({ result_id: result.id }).eq("tenant_id", tid).eq("id", job.id);

  await supabase.from("fi_pathology_inbound_document_events").insert({
    tenant_id: tid,
    inbound_document_id: did,
    event_type: "draft_result_created",
    actor_user_id: input.actingUserId,
    detail: {
      draft_result_id: result.id,
      extraction_job_id: job.id,
      marker_count: items.length,
    },
  });

  const loaded = await loadPathologyInboxDocument(tid, did, supabase);
  if (!loaded) throw new Error("Inbound document not found after draft creation.");
  return { inbound: loaded, resultId: result.id, created: true };
}

/** Auto-create draft when flag enabled and patient already matched after extraction. */
export async function maybeAutoCreateDraftFromExtraction(
  tenantId: string,
  documentId: string,
  actingUserId: string | null,
  client?: SupabaseClient
): Promise<CreateDraftFromExtractionOutput | null> {
  if (!readPathologyAutoDraftEnabled()) return null;

  const supabase = client ?? supabaseAdmin();
  const doc = await loadInboundRow(supabase, tenantId.trim(), documentId.trim());
  if (doc.match_status !== "matched" || doc.draft_result_id) return null;
  if (doc.extraction_status !== "succeeded" && doc.extraction_status !== "needs_review") return null;

  return createDraftPathologyResultFromExtraction(
    { tenantId, documentId, actingUserId },
    supabase
  );
}
