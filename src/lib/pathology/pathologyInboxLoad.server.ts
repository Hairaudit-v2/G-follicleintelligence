import "server-only";

import type { SupabaseClient } from "@supabase/supabase-js";
import { supabaseAdmin } from "@/lib/supabaseAdmin";
import { personMetadataDisplayLabel } from "@/src/lib/crm/crmLeadListDisplay";
import type {
  PathologyInboundDocumentListItem,
  PathologyInboundDocumentRow,
  PathologyInboundMatchStatus,
} from "@/src/lib/pathology/pathologyInboxTypes";

function mapInboundDocument(row: Record<string, unknown>): PathologyInboundDocumentRow {
  return {
    id: String(row.id),
    tenant_id: String(row.tenant_id),
    source_channel: String(row.source_channel) as PathologyInboundDocumentRow["source_channel"],
    storage_bucket: row.storage_bucket != null ? String(row.storage_bucket) : null,
    storage_path: row.storage_path != null ? String(row.storage_path) : null,
    original_filename: row.original_filename != null ? String(row.original_filename) : null,
    content_type: row.content_type != null ? String(row.content_type) : null,
    match_status: String(row.match_status) as PathologyInboundMatchStatus,
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

async function loadPatientNameLabels(
  tenantId: string,
  patientIds: string[],
  client?: SupabaseClient
): Promise<Map<string, string>> {
  const ids = [...new Set(patientIds.filter(Boolean))];
  if (!ids.length) return new Map();
  const supabase = client ?? supabaseAdmin();

  const { data, error } = await supabase
    .from("fi_patients")
    .select("id, person_id")
    .eq("tenant_id", tenantId.trim())
    .in("id", ids);
  if (error) throw new Error(error.message);

  const personIds = [
    ...new Set((data ?? []).map((r) => String((r as { person_id: string }).person_id))),
  ];
  const personMeta = new Map<string, Record<string, unknown>>();
  if (personIds.length) {
    const { data: persons, error: pe } = await supabase
      .from("fi_persons")
      .select("id, metadata")
      .eq("tenant_id", tenantId.trim())
      .in("id", personIds);
    if (pe) throw new Error(pe.message);
    for (const row of persons ?? []) {
      const id = String((row as { id: string }).id);
      const m = (row as { metadata: unknown }).metadata;
      personMeta.set(
        id,
        m && typeof m === "object" && !Array.isArray(m) ? (m as Record<string, unknown>) : {}
      );
    }
  }

  const out = new Map<string, string>();
  for (const raw of data ?? []) {
    const r = raw as { id: string; person_id: string };
    const label = personMetadataDisplayLabel(personMeta.get(String(r.person_id)) ?? {});
    if (label && label !== "—") out.set(String(r.id), label);
  }
  return out;
}

function enrichListItem(
  doc: PathologyInboundDocumentRow,
  labels: Map<string, string>
): PathologyInboundDocumentListItem {
  return {
    ...doc,
    suggested_patient_name: doc.suggested_patient_id
      ? (labels.get(doc.suggested_patient_id) ?? null)
      : null,
    confirmed_patient_name: doc.confirmed_patient_id
      ? (labels.get(doc.confirmed_patient_id) ?? null)
      : null,
  };
}

export type PathologyInboxListFilters = {
  matchStatus?: PathologyInboundMatchStatus | "all";
};

export async function loadPathologyInboxDocuments(
  tenantId: string,
  filters: PathologyInboxListFilters = {},
  client?: SupabaseClient
): Promise<PathologyInboundDocumentListItem[]> {
  const supabase = client ?? supabaseAdmin();
  const tid = tenantId.trim();

  let query = supabase
    .from("fi_pathology_inbound_documents")
    .select("*")
    .eq("tenant_id", tid)
    .order("created_at", { ascending: false });

  const status = filters.matchStatus ?? "all";
  if (status !== "all") {
    query = query.eq("match_status", status);
  }

  const { data, error } = await query;
  if (error) throw new Error(error.message);

  const docs = ((data ?? []) as Record<string, unknown>[]).map(mapInboundDocument);
  const patientIds = docs.flatMap((d) =>
    [d.suggested_patient_id, d.confirmed_patient_id].filter(Boolean)
  ) as string[];
  const labels = await loadPatientNameLabels(tid, patientIds, supabase);
  return docs.map((d) => enrichListItem(d, labels));
}

export async function loadPathologyInboxDocument(
  tenantId: string,
  documentId: string,
  client?: SupabaseClient
): Promise<PathologyInboundDocumentListItem | null> {
  const supabase = client ?? supabaseAdmin();
  const tid = tenantId.trim();
  const did = documentId.trim();

  const { data, error } = await supabase
    .from("fi_pathology_inbound_documents")
    .select("*")
    .eq("tenant_id", tid)
    .eq("id", did)
    .maybeSingle();
  if (error) throw new Error(error.message);
  if (!data) return null;

  const doc = mapInboundDocument(data as Record<string, unknown>);
  const labels = await loadPatientNameLabels(
    tid,
    [doc.suggested_patient_id, doc.confirmed_patient_id].filter(Boolean) as string[],
    supabase
  );
  return enrichListItem(doc, labels);
}

export async function createInboundDocumentSignedUrl(
  tenantId: string,
  documentId: string,
  client?: SupabaseClient
): Promise<string | null> {
  const doc = await loadPathologyInboxDocument(tenantId, documentId, client);
  if (!doc?.storage_bucket || !doc.storage_path) return null;
  const supabase = client ?? supabaseAdmin();
  const { data, error } = await supabase.storage
    .from(doc.storage_bucket)
    .createSignedUrl(doc.storage_path, 3600);
  if (error) throw new Error(error.message);
  return data?.signedUrl ?? null;
}
