import "server-only";

import type { SupabaseClient } from "@supabase/supabase-js";
import { supabaseAdmin } from "@/lib/supabaseAdmin";
import { loadPathologyInboxDocument } from "@/src/lib/pathology/pathologyInboxLoad.server";
import type {
  PathologyExtractionJobRow,
  PathologyExtractionJobStatus,
  PathologyInboundDocumentEventType,
  PathologyInboundDocumentListItem,
  PathologyInboundExtractionStatus,
} from "@/src/lib/pathology/pathologyInboxTypes";
import { maybeAutoCreateDraftFromExtraction } from "@/src/lib/pathology/pathologyAutoDraftResult.server";
import { readPathologyExtractionEnabled } from "@/src/lib/pathology/pathologyExtractionEnv.server";
import {
  downloadInboundDocumentPdf,
  runPathologyExtractionOnPdf,
} from "@/src/lib/pathology/pathologyExtractionWorker.server";

function mapExtractionJob(row: Record<string, unknown>): PathologyExtractionJobRow {
  return {
    id: String(row.id),
    tenant_id: String(row.tenant_id),
    inbound_document_id: row.inbound_document_id != null ? String(row.inbound_document_id) : null,
    result_id: row.result_id != null ? String(row.result_id) : null,
    status: String(row.status) as PathologyExtractionJobRow["status"],
    provider: row.provider != null ? String(row.provider) : null,
    raw_extraction_json:
      row.raw_extraction_json && typeof row.raw_extraction_json === "object" && !Array.isArray(row.raw_extraction_json)
        ? (row.raw_extraction_json as Record<string, unknown>)
        : {},
    normalized_items_json: Array.isArray(row.normalized_items_json) ? row.normalized_items_json : [],
    error_message: row.error_message != null ? String(row.error_message) : null,
    idempotency_key: String(row.idempotency_key),
    started_at: row.started_at != null ? String(row.started_at) : null,
    completed_at: row.completed_at != null ? String(row.completed_at) : null,
    extracted_marker_count:
      row.extracted_marker_count != null ? Number(row.extracted_marker_count) : 0,
    skipped_marker_count: row.skipped_marker_count != null ? Number(row.skipped_marker_count) : 0,
    review_status: String(row.review_status ?? "pending_review") as PathologyExtractionJobRow["review_status"],
    raw_text_preview: row.raw_text_preview != null ? String(row.raw_text_preview) : null,
    medical_intelligence_preview_json:
      row.medical_intelligence_preview_json &&
      typeof row.medical_intelligence_preview_json === "object" &&
      !Array.isArray(row.medical_intelligence_preview_json)
        ? (row.medical_intelligence_preview_json as Record<string, unknown>)
        : {},
    created_at: String(row.created_at),
    updated_at: String(row.updated_at),
  };
}

export function buildPathologyExtractionIdempotencyKey(
  tenantId: string,
  documentId: string,
  retryToken?: string | null
): string {
  const base = `pathology-extract:${tenantId.trim()}:${documentId.trim()}`;
  const token = retryToken?.trim();
  return token ? `${base}:retry:${token}` : base;
}

async function appendInboundEvent(
  supabase: SupabaseClient,
  params: {
    tenantId: string;
    inboundDocumentId: string;
    eventType: PathologyInboundDocumentEventType;
    actorUserId: string | null;
    detail?: Record<string, unknown>;
  }
): Promise<void> {
  const { error } = await supabase.from("fi_pathology_inbound_document_events").insert({
    tenant_id: params.tenantId,
    inbound_document_id: params.inboundDocumentId,
    event_type: params.eventType,
    actor_user_id: params.actorUserId,
    detail: params.detail ?? {},
  });
  if (error) throw new Error(error.message);
}

export async function loadPathologyExtractionJobById(
  tenantId: string,
  jobId: string,
  client?: SupabaseClient
): Promise<PathologyExtractionJobRow | null> {
  const supabase = client ?? supabaseAdmin();
  const { data, error } = await supabase
    .from("fi_pathology_extraction_jobs")
    .select("*")
    .eq("tenant_id", tenantId.trim())
    .eq("id", jobId.trim())
    .maybeSingle();
  if (error) throw new Error(error.message);
  if (!data) return null;
  return mapExtractionJob(data as Record<string, unknown>);
}

export async function loadPathologyExtractionJobForDocument(
  tenantId: string,
  documentId: string,
  client?: SupabaseClient
): Promise<PathologyExtractionJobRow | null> {
  const supabase = client ?? supabaseAdmin();
  const { data, error } = await supabase
    .from("fi_pathology_inbound_documents")
    .select("extraction_job_id")
    .eq("tenant_id", tenantId.trim())
    .eq("id", documentId.trim())
    .maybeSingle();
  if (error) throw new Error(error.message);
  const jobId = (data as { extraction_job_id?: string | null } | null)?.extraction_job_id;
  if (!jobId) return null;
  return loadPathologyExtractionJobById(tenantId, jobId, supabase);
}

export type EnqueuePathologyExtractionInput = {
  tenantId: string;
  documentId: string;
  actingUserId: string | null;
  retryToken?: string | null;
};

export type EnqueuePathologyExtractionOutput = {
  job: PathologyExtractionJobRow;
  created: boolean;
};

/** Idempotent enqueue — returns existing job when idempotency_key matches. */
export async function enqueuePathologyExtractionJob(
  input: EnqueuePathologyExtractionInput,
  client?: SupabaseClient
): Promise<EnqueuePathologyExtractionOutput> {
  const supabase = client ?? supabaseAdmin();
  const tid = input.tenantId.trim();
  const did = input.documentId.trim();
  const idempotencyKey = buildPathologyExtractionIdempotencyKey(tid, did, input.retryToken);

  const { data: existing, error: exErr } = await supabase
    .from("fi_pathology_extraction_jobs")
    .select("*")
    .eq("idempotency_key", idempotencyKey)
    .maybeSingle();
  if (exErr) throw new Error(exErr.message);
  if (existing) {
    return { job: mapExtractionJob(existing as Record<string, unknown>), created: false };
  }

  const { data: inserted, error: insErr } = await supabase
    .from("fi_pathology_extraction_jobs")
    .insert({
      tenant_id: tid,
      inbound_document_id: did,
      status: "queued",
      idempotency_key: idempotencyKey,
      review_status: "pending_review",
    })
    .select("*")
    .single();
  if (insErr) throw new Error(insErr.message);

  const job = mapExtractionJob(inserted as Record<string, unknown>);

  await supabase
    .from("fi_pathology_inbound_documents")
    .update({
      extraction_status: "queued",
      extraction_job_id: job.id,
    })
    .eq("tenant_id", tid)
    .eq("id", did);

  await appendInboundEvent(supabase, {
    tenantId: tid,
    inboundDocumentId: did,
    eventType: "extraction_queued",
    actorUserId: input.actingUserId,
    detail: { extraction_job_id: job.id, idempotency_key: idempotencyKey },
  });

  return { job, created: true };
}

async function updateInboundExtractionStatus(
  supabase: SupabaseClient,
  tenantId: string,
  documentId: string,
  status: PathologyInboundExtractionStatus,
  extra?: Record<string, unknown>
): Promise<void> {
  const { error } = await supabase
    .from("fi_pathology_inbound_documents")
    .update({ extraction_status: status, ...extra })
    .eq("tenant_id", tenantId)
    .eq("id", documentId);
  if (error) throw new Error(error.message);
}

export type RunPathologyExtractionJobInput = {
  tenantId: string;
  documentId: string;
  jobId: string;
  actingUserId: string | null;
};

export async function runPathologyExtractionJob(
  input: RunPathologyExtractionJobInput,
  client?: SupabaseClient
): Promise<{ job: PathologyExtractionJobRow; inbound: PathologyInboundDocumentListItem | null }> {
  const supabase = client ?? supabaseAdmin();
  const tid = input.tenantId.trim();
  const did = input.documentId.trim();
  const jid = input.jobId.trim();
  const startedAt = new Date().toISOString();

  const job = await loadPathologyExtractionJobById(tid, jid, supabase);
  if (!job) throw new Error("Extraction job not found.");
  if (job.review_status === "dismissed") {
    throw new Error("Dismissed extraction jobs cannot be run.");
  }
  if (job.status === "succeeded") {
    const inbound = await loadPathologyInboxDocument(tid, did, supabase);
    return { job, inbound };
  }

  const { data: docRow, error: docErr } = await supabase
    .from("fi_pathology_inbound_documents")
    .select("*")
    .eq("tenant_id", tid)
    .eq("id", did)
    .maybeSingle();
  if (docErr) throw new Error(docErr.message);
  if (!docRow) throw new Error("Inbound document not found.");

  const storageBucket = (docRow as { storage_bucket?: string | null }).storage_bucket;
  const storagePath = (docRow as { storage_path?: string | null }).storage_path;
  if (!storageBucket || !storagePath) {
    throw new Error("Inbound document has no stored PDF.");
  }

  await supabase
    .from("fi_pathology_extraction_jobs")
    .update({ status: "running", started_at: startedAt, error_message: null })
    .eq("tenant_id", tid)
    .eq("id", jid);

  await updateInboundExtractionStatus(supabase, tid, did, "running");
  await appendInboundEvent(supabase, {
    tenantId: tid,
    inboundDocumentId: did,
    eventType: "extraction_started",
    actorUserId: input.actingUserId,
    detail: { extraction_job_id: jid },
  });

  try {
    const pdfBytes = await downloadInboundDocumentPdf(supabase, storageBucket, storagePath);
    const extraction = await runPathologyExtractionOnPdf(pdfBytes);
    const completedAt = new Date().toISOString();

    const finalStatus: PathologyExtractionJobStatus =
      extraction.extractedMarkerCount > 0 ? "succeeded" : "needs_review";
    const inboundExtractionStatus: PathologyInboundExtractionStatus =
      extraction.extractedMarkerCount > 0 ? "succeeded" : "needs_review";

    const { data: updatedJob, error: updErr } = await supabase
      .from("fi_pathology_extraction_jobs")
      .update({
        status: finalStatus,
        provider: extraction.provider,
        raw_extraction_json: extraction.rawExtractionJson,
        normalized_items_json: extraction.normalizedMarkers,
        extracted_marker_count: extraction.extractedMarkerCount,
        skipped_marker_count: extraction.skippedMarkerCount,
        raw_text_preview: extraction.rawTextPreview,
        medical_intelligence_preview_json: extraction.medicalIntelligencePreview ?? {},
        completed_at: completedAt,
        error_message: null,
      })
      .eq("tenant_id", tid)
      .eq("id", jid)
      .select("*")
      .single();
    if (updErr) throw new Error(updErr.message);

    await updateInboundExtractionStatus(supabase, tid, did, inboundExtractionStatus, {
      ready_for_review_at: completedAt,
    });

    await appendInboundEvent(supabase, {
      tenantId: tid,
      inboundDocumentId: did,
      eventType: "extraction_succeeded",
      actorUserId: input.actingUserId,
      detail: {
        extraction_job_id: jid,
        extracted_marker_count: extraction.extractedMarkerCount,
        skipped_marker_count: extraction.skippedMarkerCount,
        ocr_confidence: extraction.ocrConfidence,
        provider: extraction.provider,
      },
    });

    await appendInboundEvent(supabase, {
      tenantId: tid,
      inboundDocumentId: did,
      eventType: "ready_for_review",
      actorUserId: input.actingUserId,
      detail: { extraction_job_id: jid },
    });

    await maybeAutoCreateDraftFromExtraction(tid, did, input.actingUserId, supabase);

    const inbound = await loadPathologyInboxDocument(tid, did, supabase);
    return { job: mapExtractionJob(updatedJob as Record<string, unknown>), inbound };
  } catch (err) {
    const message = err instanceof Error ? err.message : "Extraction failed.";
    const completedAt = new Date().toISOString();

    const { data: failedJob, error: failErr } = await supabase
      .from("fi_pathology_extraction_jobs")
      .update({
        status: "failed",
        error_message: message,
        completed_at: completedAt,
      })
      .eq("tenant_id", tid)
      .eq("id", jid)
      .select("*")
      .single();
    if (failErr) throw new Error(failErr.message);

    await updateInboundExtractionStatus(supabase, tid, did, "failed");
    await appendInboundEvent(supabase, {
      tenantId: tid,
      inboundDocumentId: did,
      eventType: "extraction_failed",
      actorUserId: input.actingUserId,
      detail: { extraction_job_id: jid, error: message },
    });

    const inbound = await loadPathologyInboxDocument(tid, did, supabase);
    return { job: mapExtractionJob(failedJob as Record<string, unknown>), inbound };
  }
}

/** Enqueue (if needed) and run extraction for an inbound document. */
export async function runPathologyExtractionForDocument(
  tenantId: string,
  documentId: string,
  actingUserId: string | null,
  client?: SupabaseClient,
  options?: { retryToken?: string | null }
): Promise<{ job: PathologyExtractionJobRow; inbound: PathologyInboundDocumentListItem | null }> {
  if (!readPathologyExtractionEnabled()) {
    throw new Error("Pathology extraction is disabled.");
  }

  const { job } = await enqueuePathologyExtractionJob(
    { tenantId, documentId, actingUserId, retryToken: options?.retryToken },
    client
  );

  return runPathologyExtractionJob(
    { tenantId, documentId, jobId: job.id, actingUserId },
    client
  );
}

export async function retryPathologyExtractionJob(
  tenantId: string,
  jobId: string,
  actingUserId: string | null,
  client?: SupabaseClient
): Promise<{ job: PathologyExtractionJobRow; inbound: PathologyInboundDocumentListItem | null }> {
  const supabase = client ?? supabaseAdmin();
  const tid = tenantId.trim();
  const jid = jobId.trim();

  const existing = await loadPathologyExtractionJobById(tid, jid, supabase);
  if (!existing) throw new Error("Extraction job not found.");
  if (existing.review_status === "dismissed") {
    throw new Error("Dismissed extraction jobs cannot be retried.");
  }
  if (!existing.inbound_document_id) {
    throw new Error("Extraction job has no linked inbound document.");
  }

  const retryToken = `${Date.now()}`;
  return runPathologyExtractionForDocument(
    tid,
    existing.inbound_document_id,
    actingUserId,
    supabase,
    { retryToken }
  );
}

export async function dismissPathologyExtractionJob(
  tenantId: string,
  jobId: string,
  actingUserId: string | null,
  client?: SupabaseClient
): Promise<PathologyExtractionJobRow> {
  const supabase = client ?? supabaseAdmin();
  const tid = tenantId.trim();
  const jid = jobId.trim();

  const existing = await loadPathologyExtractionJobById(tid, jid, supabase);
  if (!existing) throw new Error("Extraction job not found.");

  const { data, error } = await supabase
    .from("fi_pathology_extraction_jobs")
    .update({ review_status: "dismissed" })
    .eq("tenant_id", tid)
    .eq("id", jid)
    .select("*")
    .single();
  if (error) throw new Error(error.message);

  if (existing.inbound_document_id) {
    await updateInboundExtractionStatus(supabase, tid, existing.inbound_document_id, "needs_review");
  }

  return mapExtractionJob(data as Record<string, unknown>);
}

/** Called after upload when PATHOLOGY_EXTRACTION_ENABLED=true. */
export async function maybeEnqueueAndRunPathologyExtractionAfterUpload(
  tenantId: string,
  documentId: string,
  actingUserId: string | null,
  client?: SupabaseClient
): Promise<PathologyExtractionJobRow | null> {
  if (!readPathologyExtractionEnabled()) return null;
  const { job } = await runPathologyExtractionForDocument(tenantId, documentId, actingUserId, client);
  return job;
}
