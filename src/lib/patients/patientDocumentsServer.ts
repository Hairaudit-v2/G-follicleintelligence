import "server-only";

import { randomUUID } from "node:crypto";

import type { SupabaseClient } from "@supabase/supabase-js";

import { supabaseAdmin } from "@/lib/supabaseAdmin";
import { publishPatientEvent } from "@/src/lib/analytics-os/analyticsModulePublishers";

import {
  buildPatientDocumentStoragePath,
  buildSafePatientDocumentFilename,
  isPatientConsentContentType,
  PATIENT_CONSENT_MAX_BYTES,
  PATIENT_DOCUMENTS_BUCKET_DEFAULT,
  type PatientDocumentType,
} from "./patientDocumentPolicy";

export type PatientDocumentRow = {
  id: string;
  tenant_id: string;
  patient_id: string;
  person_id: string | null;
  document_type: PatientDocumentType;
  storage_bucket: string;
  storage_path: string;
  original_filename: string | null;
  content_type: string | null;
  file_size_bytes: number | null;
  notes: string | null;
  metadata: Record<string, unknown>;
  uploaded_by_user_id: string | null;
  created_at: string;
  updated_at: string;
};

export type PatientDocumentWithSignedUrl = PatientDocumentRow & {
  signed_url: string | null;
};

function mapRow(data: Record<string, unknown>): PatientDocumentRow {
  const meta = data.metadata;
  return {
    id: String(data.id),
    tenant_id: String(data.tenant_id),
    patient_id: String(data.patient_id),
    person_id: data.person_id != null ? String(data.person_id) : null,
    document_type: String(data.document_type) as PatientDocumentType,
    storage_bucket: String(data.storage_bucket ?? PATIENT_DOCUMENTS_BUCKET_DEFAULT),
    storage_path: String(data.storage_path),
    original_filename: data.original_filename != null ? String(data.original_filename) : null,
    content_type: data.content_type != null ? String(data.content_type) : null,
    file_size_bytes:
      data.file_size_bytes != null && data.file_size_bytes !== ""
        ? Number(data.file_size_bytes)
        : null,
    notes: data.notes != null ? String(data.notes) : null,
    metadata:
      meta && typeof meta === "object" && !Array.isArray(meta)
        ? (meta as Record<string, unknown>)
        : {},
    uploaded_by_user_id:
      data.uploaded_by_user_id != null ? String(data.uploaded_by_user_id) : null,
    created_at: String(data.created_at),
    updated_at: String(data.updated_at),
  };
}

async function assertPatientInTenant(
  supabase: SupabaseClient,
  tenantId: string,
  patientId: string
): Promise<{ person_id: string }> {
  const { data, error } = await supabase
    .from("fi_patients")
    .select("id, person_id")
    .eq("tenant_id", tenantId)
    .eq("id", patientId)
    .maybeSingle();
  if (error) throw new Error(error.message);
  if (!data) throw new Error("Patient not found for tenant.");
  return { person_id: String((data as { person_id: string }).person_id) };
}

export async function listPatientDocuments(
  tenantId: string,
  patientId: string,
  opts?: { documentType?: PatientDocumentType },
  client?: SupabaseClient
): Promise<PatientDocumentWithSignedUrl[]> {
  const supabase = client ?? supabaseAdmin();
  const tid = tenantId.trim();
  const pid = patientId.trim();

  let q = supabase
    .from("fi_patient_documents")
    .select("*")
    .eq("tenant_id", tid)
    .eq("patient_id", pid)
    .order("created_at", { ascending: false });

  if (opts?.documentType) q = q.eq("document_type", opts.documentType);

  const { data, error } = await q;
  if (error) {
    if (error.message?.includes("does not exist") || error.message?.includes("schema cache")) {
      return [];
    }
    throw new Error(error.message);
  }

  const rows = (data ?? []).map((r) => mapRow(r as Record<string, unknown>));
  const out: PatientDocumentWithSignedUrl[] = [];

  for (const row of rows) {
    const { data: signed, error: signErr } = await supabase.storage
      .from(row.storage_bucket)
      .createSignedUrl(row.storage_path, 3600);
    out.push({
      ...row,
      signed_url: signErr ? null : (signed?.signedUrl ?? null),
    });
  }

  return out;
}

export async function uploadPatientConsentDocument(input: {
  tenantId: string;
  patientId: string;
  file: File;
  notes?: string | null;
  actingUserId?: string | null;
  client?: SupabaseClient;
}): Promise<PatientDocumentRow> {
  const supabase = input.client ?? supabaseAdmin();
  const tid = input.tenantId.trim();
  const pid = input.patientId.trim();
  if (!tid || !pid) throw new Error("tenantId and patientId are required.");
  if (!input.file?.size) throw new Error("Missing or empty file.");

  const contentType = (input.file.type || "application/octet-stream").trim().toLowerCase();
  if (!isPatientConsentContentType(contentType)) {
    throw new Error("Consent document must be PDF, JPEG, or PNG.");
  }
  if (input.file.size > PATIENT_CONSENT_MAX_BYTES) {
    throw new Error(`Consent document exceeds ${PATIENT_CONSENT_MAX_BYTES / (1024 * 1024)} MB limit.`);
  }

  const { person_id } = await assertPatientInTenant(supabase, tid, pid);
  const documentId = randomUUID();
  const safeName = buildSafePatientDocumentFilename(input.file.name);
  const storagePath = buildPatientDocumentStoragePath({
    tenantId: tid,
    patientId: pid,
    documentId,
    documentType: "consent",
    safeFilename: safeName,
  });
  const bucket = PATIENT_DOCUMENTS_BUCKET_DEFAULT;
  const now = new Date().toISOString();

  const { error: uploadErr } = await supabase.storage.from(bucket).upload(storagePath, input.file, {
    contentType,
    upsert: false,
  });
  if (uploadErr) throw new Error(`Storage upload failed: ${uploadErr.message}`);

  const notes = input.notes?.trim() ? input.notes.trim().slice(0, 2000) : null;

  const { data: ins, error: insErr } = await supabase
    .from("fi_patient_documents")
    .insert({
      id: documentId,
      tenant_id: tid,
      patient_id: pid,
      person_id,
      document_type: "consent",
      storage_bucket: bucket,
      storage_path: storagePath,
      original_filename: input.file.name || null,
      content_type: contentType,
      file_size_bytes: input.file.size,
      notes,
      metadata: { source: "fi_consent_vault_v1" },
      uploaded_by_user_id: input.actingUserId?.trim() || null,
      created_at: now,
      updated_at: now,
    })
    .select("*")
    .single();

  if (insErr) {
    await supabase.storage
      .from(bucket)
      .remove([storagePath])
      .catch(() => undefined);
    throw new Error(insErr.message);
  }

  const row = mapRow(ins as Record<string, unknown>);

  void publishPatientEvent({
    tenantId: tid,
    eventType: "patient_document_uploaded",
    entityId: row.id,
    entityType: "document",
    eventMetadata: {
      patient_id: pid,
      document_type: "consent",
    },
  });

  return row;
}