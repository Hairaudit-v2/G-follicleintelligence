import "server-only";

import type { SupabaseClient } from "@supabase/supabase-js";
import { supabaseAdmin } from "@/lib/supabaseAdmin";
import { PATHOLOGY_PATIENT_PDF_BUCKET } from "@/src/lib/pathology/pathologyRequestLoad.server";
import { loadPathologyInboxDocument } from "@/src/lib/pathology/pathologyInboxLoad.server";
import type {
  PathologyInboundDocumentEventType,
  PathologyInboundDocumentListItem,
  PathologyInboundDocumentRow,
  PathologyInboundSourceChannel,
} from "@/src/lib/pathology/pathologyInboxTypes";
import {
  createPathologyResult,
  type PathologyResultItemInput,
} from "@/src/lib/pathology/pathologyResultMutations.server";
import { suggestPathologyPatientMatch } from "@/src/lib/pathology/pathologyPatientMatch.server";

export const PATHOLOGY_INBOX_PDF_BUCKET = PATHOLOGY_PATIENT_PDF_BUCKET;

export function buildPathologyInboxStoragePath(tenantId: string, documentId: string): string {
  const tid = tenantId.trim();
  const did = documentId.trim();
  return `tenant/${tid}/pathology-inbox/${did}.pdf`;
}

function mapInboundDocument(row: Record<string, unknown>): PathologyInboundDocumentRow {
  return {
    id: String(row.id),
    tenant_id: String(row.tenant_id),
    source_channel: String(row.source_channel) as PathologyInboundSourceChannel,
    storage_bucket: row.storage_bucket != null ? String(row.storage_bucket) : null,
    storage_path: row.storage_path != null ? String(row.storage_path) : null,
    original_filename: row.original_filename != null ? String(row.original_filename) : null,
    content_type: row.content_type != null ? String(row.content_type) : null,
    match_status: String(row.match_status) as PathologyInboundDocumentRow["match_status"],
    suggested_patient_id:
      row.suggested_patient_id != null ? String(row.suggested_patient_id) : null,
    confirmed_patient_id:
      row.confirmed_patient_id != null ? String(row.confirmed_patient_id) : null,
    match_confidence: row.match_confidence != null ? Number(row.match_confidence) : null,
    match_evidence:
      row.match_evidence && typeof row.match_evidence === "object" && !Array.isArray(row.match_evidence)
        ? (row.match_evidence as Record<string, unknown>)
        : {},
    extracted_patient_name:
      row.extracted_patient_name != null ? String(row.extracted_patient_name) : null,
    extracted_dob: row.extracted_dob != null ? String(row.extracted_dob).slice(0, 10) : null,
    extracted_mrn: row.extracted_mrn != null ? String(row.extracted_mrn) : null,
    promoted_result_id: row.promoted_result_id != null ? String(row.promoted_result_id) : null,
    created_at: String(row.created_at),
    updated_at: String(row.updated_at),
  };
}

async function assertPatientInTenant(
  supabase: SupabaseClient,
  tenantId: string,
  patientId: string
): Promise<void> {
  const { data, error } = await supabase
    .from("fi_patients")
    .select("id")
    .eq("tenant_id", tenantId)
    .eq("id", patientId)
    .maybeSingle();
  if (error) throw new Error(error.message);
  if (!data) throw new Error("Patient not found for tenant.");
}

async function loadInboundDocumentRow(
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
  return mapInboundDocument(data as Record<string, unknown>);
}

async function appendInboundDocumentEvent(
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

function extractedHintsFromDocument(
  doc: PathologyInboundDocumentRow,
  overrides?: {
    extractedPatientName?: string | null;
    extractedDob?: string | null;
    extractedMrn?: string | null;
  }
) {
  return {
    patientName:
      overrides?.extractedPatientName?.trim() ||
      doc.extracted_patient_name?.trim() ||
      null,
    dob: overrides?.extractedDob?.trim() || doc.extracted_dob?.trim() || null,
    mrn: overrides?.extractedMrn?.trim() || doc.extracted_mrn?.trim() || null,
  };
}

async function applyMatchSuggestion(
  supabase: SupabaseClient,
  tenantId: string,
  documentId: string,
  doc: PathologyInboundDocumentRow,
  hints: ReturnType<typeof extractedHintsFromDocument>,
  actorUserId: string | null
): Promise<PathologyInboundDocumentRow> {
  const match = await suggestPathologyPatientMatch(tenantId, hints, supabase);

  const patch: Record<string, unknown> = {
    extracted_patient_name: hints.patientName,
    extracted_dob: hints.dob,
    extracted_mrn: hints.mrn,
    suggested_patient_id: match?.patientId ?? null,
    match_confidence: match?.confidence ?? null,
    match_evidence: match?.evidence ?? {},
  };

  const { data, error } = await supabase
    .from("fi_pathology_inbound_documents")
    .update(patch)
    .eq("tenant_id", tenantId)
    .eq("id", documentId)
    .select("*")
    .single();
  if (error) throw new Error(error.message);

  if (match) {
    await appendInboundDocumentEvent(supabase, {
      tenantId,
      inboundDocumentId: documentId,
      eventType: "match_suggested",
      actorUserId,
      detail: {
        suggested_patient_id: match.patientId,
        match_confidence: match.confidence,
        match_evidence: match.evidence,
      },
    });
  }

  return mapInboundDocument(data as Record<string, unknown>);
}

export type UploadInboundPathologyDocumentInput = {
  tenantId: string;
  pdfBytes: Uint8Array;
  originalFilename: string;
  contentType?: string;
  sourceChannel?: PathologyInboundSourceChannel;
  extractedPatientName?: string | null;
  extractedDob?: string | null;
  extractedMrn?: string | null;
  actingUserId: string | null;
};

export async function uploadInboundPathologyDocument(
  input: UploadInboundPathologyDocumentInput,
  client?: SupabaseClient
): Promise<PathologyInboundDocumentListItem> {
  const supabase = client ?? supabaseAdmin();
  const tid = input.tenantId.trim();

  const { data: insRow, error: insErr } = await supabase
    .from("fi_pathology_inbound_documents")
    .insert({
      tenant_id: tid,
      source_channel: input.sourceChannel ?? "manual_upload",
      match_status: "pending",
      original_filename: input.originalFilename.trim() || "inbound.pdf",
      content_type: input.contentType?.trim() || "application/pdf",
      extracted_patient_name: input.extractedPatientName?.trim() || null,
      extracted_dob: input.extractedDob?.trim() || null,
      extracted_mrn: input.extractedMrn?.trim() || null,
    })
    .select("*")
    .single();
  if (insErr) throw new Error(insErr.message);

  const doc = mapInboundDocument(insRow as Record<string, unknown>);
  const storagePath = buildPathologyInboxStoragePath(tid, doc.id);

  const { error: upErr } = await supabase.storage
    .from(PATHOLOGY_INBOX_PDF_BUCKET)
    .upload(storagePath, input.pdfBytes, {
      contentType: input.contentType?.trim() || "application/pdf",
      upsert: true,
    });
  if (upErr) throw new Error(upErr.message);

  const { data: storageUpd, error: storageErr } = await supabase
    .from("fi_pathology_inbound_documents")
    .update({
      storage_bucket: PATHOLOGY_INBOX_PDF_BUCKET,
      storage_path: storagePath,
    })
    .eq("tenant_id", tid)
    .eq("id", doc.id)
    .select("*")
    .single();
  if (storageErr) throw new Error(storageErr.message);

  await appendInboundDocumentEvent(supabase, {
    tenantId: tid,
    inboundDocumentId: doc.id,
    eventType: "created",
    actorUserId: input.actingUserId,
    detail: {
      source_channel: input.sourceChannel ?? "manual_upload",
      original_filename: input.originalFilename,
    },
  });

  let updated = mapInboundDocument(storageUpd as Record<string, unknown>);
  const hints = extractedHintsFromDocument(updated);
  if (hints.patientName || hints.dob || hints.mrn) {
    updated = await applyMatchSuggestion(supabase, tid, doc.id, updated, hints, input.actingUserId);
  }

  const loaded = await loadPathologyInboxDocument(tid, doc.id, supabase);
  if (!loaded) throw new Error("Failed to load inbound document after upload.");
  return loaded;
}

export type ConfirmInboundDocumentMatchInput = {
  tenantId: string;
  documentId: string;
  patientId: string;
  actingUserId: string | null;
};

export async function confirmInboundDocumentMatch(
  input: ConfirmInboundDocumentMatchInput,
  client?: SupabaseClient
): Promise<PathologyInboundDocumentListItem> {
  const supabase = client ?? supabaseAdmin();
  const tid = input.tenantId.trim();
  const did = input.documentId.trim();
  const pid = input.patientId.trim();

  const doc = await loadInboundDocumentRow(supabase, tid, did);
  if (doc.match_status === "promoted") throw new Error("Document has already been promoted.");
  if (doc.match_status === "rejected") throw new Error("Rejected documents cannot be matched.");

  await assertPatientInTenant(supabase, tid, pid);

  const { data, error } = await supabase
    .from("fi_pathology_inbound_documents")
    .update({
      confirmed_patient_id: pid,
      match_status: "matched",
    })
    .eq("tenant_id", tid)
    .eq("id", did)
    .select("*")
    .single();
  if (error) throw new Error(error.message);

  await appendInboundDocumentEvent(supabase, {
    tenantId: tid,
    inboundDocumentId: did,
    eventType: "match_confirmed",
    actorUserId: input.actingUserId,
    detail: { confirmed_patient_id: pid },
  });

  const loaded = await loadPathologyInboxDocument(tid, did, supabase);
  if (!loaded) throw new Error("Inbound document not found after confirm.");
  return loaded;
}

export type RejectInboundDocumentMatchInput = {
  tenantId: string;
  documentId: string;
  actingUserId: string | null;
  reason?: string | null;
};

export async function rejectInboundDocumentMatch(
  input: RejectInboundDocumentMatchInput,
  client?: SupabaseClient
): Promise<PathologyInboundDocumentListItem> {
  const supabase = client ?? supabaseAdmin();
  const tid = input.tenantId.trim();
  const did = input.documentId.trim();

  const doc = await loadInboundDocumentRow(supabase, tid, did);
  if (doc.match_status === "promoted") throw new Error("Document has already been promoted.");

  const { error } = await supabase
    .from("fi_pathology_inbound_documents")
    .update({
      match_status: "rejected",
      confirmed_patient_id: null,
    })
    .eq("tenant_id", tid)
    .eq("id", did);
  if (error) throw new Error(error.message);

  await appendInboundDocumentEvent(supabase, {
    tenantId: tid,
    inboundDocumentId: did,
    eventType: "match_rejected",
    actorUserId: input.actingUserId,
    detail: input.reason?.trim() ? { reason: input.reason.trim() } : {},
  });

  const loaded = await loadPathologyInboxDocument(tid, did, supabase);
  if (!loaded) throw new Error("Inbound document not found after reject.");
  return loaded;
}

export type RefreshInboundDocumentMatchInput = {
  tenantId: string;
  documentId: string;
  extractedPatientName?: string | null;
  extractedDob?: string | null;
  extractedMrn?: string | null;
  actingUserId: string | null;
};

export async function refreshInboundDocumentMatchSuggestion(
  input: RefreshInboundDocumentMatchInput,
  client?: SupabaseClient
): Promise<PathologyInboundDocumentListItem> {
  const supabase = client ?? supabaseAdmin();
  const tid = input.tenantId.trim();
  const did = input.documentId.trim();

  const doc = await loadInboundDocumentRow(supabase, tid, did);
  if (doc.match_status === "promoted") throw new Error("Document has already been promoted.");
  if (doc.match_status === "rejected") throw new Error("Rejected documents cannot be re-matched.");

  const hints = extractedHintsFromDocument(doc, {
    extractedPatientName: input.extractedPatientName,
    extractedDob: input.extractedDob,
    extractedMrn: input.extractedMrn,
  });

  await applyMatchSuggestion(supabase, tid, did, doc, hints, input.actingUserId);

  const loaded = await loadPathologyInboxDocument(tid, did, supabase);
  if (!loaded) throw new Error("Inbound document not found after match refresh.");
  return loaded;
}

export type PromoteInboundPathologyDocumentInput = {
  tenantId: string;
  documentId: string;
  patientId?: string;
  resultDate: string;
  providerName: string | null;
  clinicalSummary: string | null;
  status: "draft" | "reviewed";
  items: PathologyResultItemInput[];
  actingUserId: string | null;
};

export async function promoteInboundPathologyDocument(
  input: PromoteInboundPathologyDocumentInput,
  client?: SupabaseClient
): Promise<{
  inbound: PathologyInboundDocumentListItem;
  resultId: string;
}> {
  const supabase = client ?? supabaseAdmin();
  const tid = input.tenantId.trim();
  const did = input.documentId.trim();

  const doc = await loadInboundDocumentRow(supabase, tid, did);
  if (doc.match_status === "rejected") throw new Error("Rejected documents cannot be promoted.");
  if (doc.match_status === "promoted") throw new Error("Document has already been promoted.");
  if (doc.match_status !== "matched") {
    throw new Error("Document must be matched to a patient before promotion.");
  }

  const patientId = (input.patientId?.trim() || doc.confirmed_patient_id)?.trim();
  if (!patientId) throw new Error("Confirmed patient is required for promotion.");
  if (doc.confirmed_patient_id && doc.confirmed_patient_id !== patientId) {
    throw new Error("Patient id does not match confirmed patient.");
  }

  await assertPatientInTenant(supabase, tid, patientId);

  if (!doc.storage_bucket || !doc.storage_path) {
    throw new Error("Inbound document has no stored PDF.");
  }

  const { data: pdfBlob, error: dlErr } = await supabase.storage
    .from(doc.storage_bucket)
    .download(doc.storage_path);
  if (dlErr) throw new Error(dlErr.message);
  const pdfBytes = new Uint8Array(await pdfBlob.arrayBuffer());

  const { result } = await createPathologyResult(
    {
      tenantId: tid,
      patientId,
      resultDate: input.resultDate,
      providerName: input.providerName,
      pathologyRequestId: null,
      clinicalSummary: input.clinicalSummary,
      status: input.status,
      items: input.items,
      pdfBytes,
      originalFilename: doc.original_filename,
      actingUserId: input.actingUserId,
    },
    supabase
  );

  const { error: updErr } = await supabase
    .from("fi_pathology_inbound_documents")
    .update({
      match_status: "promoted",
      promoted_result_id: result.id,
      confirmed_patient_id: patientId,
    })
    .eq("tenant_id", tid)
    .eq("id", did);
  if (updErr) throw new Error(updErr.message);

  await appendInboundDocumentEvent(supabase, {
    tenantId: tid,
    inboundDocumentId: did,
    eventType: "promoted",
    actorUserId: input.actingUserId,
    detail: {
      promoted_result_id: result.id,
      patient_id: patientId,
      result_status: input.status,
    },
  });

  const loaded = await loadPathologyInboxDocument(tid, did, supabase);
  if (!loaded) throw new Error("Inbound document not found after promotion.");
  return { inbound: loaded, resultId: result.id };
}
