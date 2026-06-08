import "server-only";

import type { SupabaseClient } from "@supabase/supabase-js";
import { supabaseAdmin } from "@/lib/supabaseAdmin";
import { appendCrmActivityEvent } from "@/src/lib/crm/activity";
import { PATHOLOGY_PATIENT_PDF_BUCKET } from "@/src/lib/pathology/pathologyRequestLoad.server";
import type {
  PathologyResultItemFlag,
  PathologyResultItemRow,
  PathologyResultRow,
  PathologyResultSourceType,
  PathologyResultStatus,
} from "./pathologyResultTypes";

function mapResult(row: Record<string, unknown>): PathologyResultRow {
  return {
    id: String(row.id),
    tenant_id: String(row.tenant_id),
    patient_id: String(row.patient_id),
    pathology_request_id: row.pathology_request_id != null ? String(row.pathology_request_id) : null,
    result_date: String(row.result_date ?? "").slice(0, 10),
    provider_name: row.provider_name != null ? String(row.provider_name) : null,
    source_type: String(row.source_type) as PathologyResultRow["source_type"],
    uploaded_file_bucket: row.uploaded_file_bucket != null ? String(row.uploaded_file_bucket) : null,
    uploaded_file_path: row.uploaded_file_path != null ? String(row.uploaded_file_path) : null,
    status: String(row.status) as PathologyResultStatus,
    clinical_summary: row.clinical_summary != null ? String(row.clinical_summary) : null,
    reviewed_by_user_id: row.reviewed_by_user_id != null ? String(row.reviewed_by_user_id) : null,
    reviewed_at: row.reviewed_at != null ? String(row.reviewed_at) : null,
    metadata:
      row.metadata && typeof row.metadata === "object" && !Array.isArray(row.metadata)
        ? (row.metadata as Record<string, unknown>)
        : {},
    created_at: String(row.created_at),
    updated_at: String(row.updated_at),
  };
}

function mapItem(row: Record<string, unknown>): PathologyResultItemRow {
  return {
    id: String(row.id),
    tenant_id: String(row.tenant_id),
    result_id: String(row.result_id),
    test_code: row.test_code != null ? String(row.test_code) : null,
    test_label: String(row.test_label),
    result_value: String(row.result_value ?? ""),
    result_unit: row.result_unit != null ? String(row.result_unit) : null,
    reference_range: row.reference_range != null ? String(row.reference_range) : null,
    flag: String(row.flag) as PathologyResultItemFlag,
    sort_order: Number(row.sort_order ?? 0),
    metadata:
      row.metadata && typeof row.metadata === "object" && !Array.isArray(row.metadata)
        ? (row.metadata as Record<string, unknown>)
        : {},
    created_at: String(row.created_at),
  };
}

export function buildPathologyResultPdfStoragePath(tenantId: string, patientId: string, resultId: string): string {
  const tid = tenantId.trim();
  const pid = patientId.trim();
  const rid = resultId.trim();
  return `tenant/${tid}/patients/${pid}/pathology-results/${rid}.pdf`;
}

export type PathologyResultItemInput = {
  test_code?: string | null;
  test_label: string;
  result_value: string;
  result_unit?: string | null;
  reference_range?: string | null;
  flag: PathologyResultItemFlag;
};

async function assertPatientInTenant(supabase: SupabaseClient, tenantId: string, patientId: string): Promise<void> {
  const { data, error } = await supabase.from("fi_patients").select("id").eq("tenant_id", tenantId).eq("id", patientId).maybeSingle();
  if (error) throw new Error(error.message);
  if (!data) throw new Error("Patient not found for tenant.");
}

async function assertRequestInTenantPatient(
  supabase: SupabaseClient,
  tenantId: string,
  patientId: string,
  requestId: string
): Promise<void> {
  const { data, error } = await supabase
    .from("fi_pathology_requests")
    .select("id")
    .eq("tenant_id", tenantId)
    .eq("patient_id", patientId)
    .eq("id", requestId)
    .maybeSingle();
  if (error) throw new Error(error.message);
  if (!data) throw new Error("Pathology request not found for this patient.");
}

async function replaceResultItems(
  supabase: SupabaseClient,
  tenantId: string,
  resultId: string,
  items: PathologyResultItemInput[]
): Promise<PathologyResultItemRow[]> {
  const { error: delErr } = await supabase.from("fi_pathology_result_items").delete().eq("tenant_id", tenantId).eq("result_id", resultId);
  if (delErr) throw new Error(delErr.message);

  const filtered = items.filter((i) => i.test_label.trim().length > 0);
  if (filtered.length === 0) return [];

  const payloads = filtered.map((t, idx) => ({
    tenant_id: tenantId,
    result_id: resultId,
    sort_order: idx,
    test_code: t.test_code?.trim() ? t.test_code.trim() : null,
    test_label: t.test_label.trim(),
    result_value: t.result_value?.trim() ?? "",
    result_unit: t.result_unit?.trim() ? t.result_unit.trim() : null,
    reference_range: t.reference_range?.trim() ? t.reference_range.trim() : null,
    flag: t.flag,
    metadata: {},
  }));

  const { data: rows, error: insErr } = await supabase.from("fi_pathology_result_items").insert(payloads).select("*");
  if (insErr) throw new Error(insErr.message);
  return ((rows ?? []) as Record<string, unknown>[]).map(mapItem);
}

function deriveSourceType(hasPdf: boolean, itemCount: number): PathologyResultSourceType {
  if (hasPdf) return "uploaded_pdf";
  if (itemCount > 0) return "manual_entry";
  return "imported";
}

async function appendBloodResultUploaded(params: {
  tenantId: string;
  patientId: string;
  result: PathologyResultRow;
  markerCount: number;
}): Promise<void> {
  await appendCrmActivityEvent({
    tenantId: params.tenantId,
    patientId: params.patientId,
    activityKind: "pathology.blood_result.uploaded",
    title: "Blood result recorded",
    detail: {
      pathology_result_id: params.result.id,
      result_date: params.result.result_date,
      provider_name: params.result.provider_name,
      marker_count: params.markerCount,
      pathology_request_id: params.result.pathology_request_id,
    },
  });
}

async function appendBloodResultReviewed(params: {
  tenantId: string;
  patientId: string;
  result: PathologyResultRow;
  markerCount: number;
}): Promise<void> {
  await appendCrmActivityEvent({
    tenantId: params.tenantId,
    patientId: params.patientId,
    activityKind: "pathology.blood_result.reviewed",
    title: "Blood result reviewed",
    detail: {
      pathology_result_id: params.result.id,
      result_date: params.result.result_date,
      provider_name: params.result.provider_name,
      marker_count: params.markerCount,
      pathology_request_id: params.result.pathology_request_id,
    },
  });
}

async function appendBloodResultArchived(params: { tenantId: string; patientId: string; result: PathologyResultRow; markerCount: number }): Promise<void> {
  await appendCrmActivityEvent({
    tenantId: params.tenantId,
    patientId: params.patientId,
    activityKind: "pathology.blood_result.archived",
    title: "Blood result archived",
    detail: {
      pathology_result_id: params.result.id,
      result_date: params.result.result_date,
      provider_name: params.result.provider_name,
      marker_count: params.markerCount,
      pathology_request_id: params.result.pathology_request_id,
    },
  });
}

export type CreatePathologyResultInput = {
  tenantId: string;
  patientId: string;
  resultDate: string;
  providerName: string | null;
  pathologyRequestId: string | null;
  clinicalSummary: string | null;
  status: "draft" | "reviewed";
  items: PathologyResultItemInput[];
  /** Raw PDF bytes when supplied from multipart upload. */
  pdfBytes: Uint8Array | null;
  originalFilename: string | null;
  actingUserId: string | null;
};

export type CreatePathologyResultOutput = {
  result: PathologyResultRow;
  items: PathologyResultItemRow[];
};

export async function createPathologyResult(input: CreatePathologyResultInput, client?: SupabaseClient): Promise<CreatePathologyResultOutput> {
  const supabase = client ?? supabaseAdmin();
  const tid = input.tenantId.trim();
  const pid = input.patientId.trim();
  await assertPatientInTenant(supabase, tid, pid);

  let reqId: string | null = null;
  if (input.pathologyRequestId?.trim()) {
    reqId = input.pathologyRequestId.trim();
    await assertRequestInTenantPatient(supabase, tid, pid, reqId);
  }

  const itemCount = input.items.filter((i) => i.test_label.trim()).length;
  const hasPdf = Boolean(input.pdfBytes && input.pdfBytes.length > 0);
  const sourceType = deriveSourceType(hasPdf, itemCount);

  const metadata: Record<string, unknown> = {};
  if (input.originalFilename?.trim()) {
    metadata.original_filename = input.originalFilename.trim();
  }

  const initialStatus = input.status;
  const reviewedAt = initialStatus === "reviewed" ? new Date().toISOString() : null;
  const reviewedBy = initialStatus === "reviewed" ? input.actingUserId : null;

  const { data: insRow, error: insErr } = await supabase
    .from("fi_pathology_results")
    .insert({
      tenant_id: tid,
      patient_id: pid,
      pathology_request_id: reqId,
      result_date: input.resultDate,
      provider_name: input.providerName?.trim() ? input.providerName.trim() : null,
      source_type: sourceType,
      status: initialStatus,
      clinical_summary: input.clinicalSummary?.trim() ? input.clinicalSummary.trim() : null,
      reviewed_by_user_id: reviewedBy,
      reviewed_at: reviewedAt,
      metadata,
    })
    .select("*")
    .single();
  if (insErr) throw new Error(insErr.message);

  let result = mapResult(insRow as Record<string, unknown>);
  const items = await replaceResultItems(supabase, tid, result.id, input.items);

  if (hasPdf && input.pdfBytes) {
    const path = buildPathologyResultPdfStoragePath(tid, pid, result.id);
    const { error: upErr } = await supabase.storage.from(PATHOLOGY_PATIENT_PDF_BUCKET).upload(path, input.pdfBytes, {
      contentType: "application/pdf",
      upsert: true,
    });
    if (upErr) throw new Error(upErr.message);

    const nextMeta = { ...result.metadata, original_filename: input.originalFilename?.trim() || result.metadata.original_filename };
    const { data: upd, error: ue } = await supabase
      .from("fi_pathology_results")
      .update({
        uploaded_file_bucket: PATHOLOGY_PATIENT_PDF_BUCKET,
        uploaded_file_path: path,
        metadata: nextMeta,
        source_type: "uploaded_pdf",
      })
      .eq("tenant_id", tid)
      .eq("id", result.id)
      .select("*")
      .single();
    if (ue) throw new Error(ue.message);
    result = mapResult(upd as Record<string, unknown>);
  }

  await appendBloodResultUploaded({
    tenantId: tid,
    patientId: pid,
    result,
    markerCount: items.length,
  });

  if (initialStatus === "reviewed") {
    await appendBloodResultReviewed({ tenantId: tid, patientId: pid, result, markerCount: items.length });
  }

  return { result, items };
}

export async function patchPathologyResultDraft(
  tenantId: string,
  patientId: string,
  resultId: string,
  patch: {
    resultDate: string;
    providerName: string | null;
    pathologyRequestId: string | null;
    clinicalSummary: string | null;
    items: PathologyResultItemInput[];
  },
  client?: SupabaseClient
): Promise<{
  result: PathologyResultRow;
  items: PathologyResultItemRow[];
  linkedRequest: {
    id: string;
    request_date: string;
    template_used: string;
    status: string;
  } | null;
}> {
  const supabase = client ?? supabaseAdmin();
  const tid = tenantId.trim();
  const pid = patientId.trim();
  const rid = resultId.trim();

  const { data: cur, error: ce } = await supabase
    .from("fi_pathology_results")
    .select("*")
    .eq("tenant_id", tid)
    .eq("patient_id", pid)
    .eq("id", rid)
    .maybeSingle();
  if (ce) throw new Error(ce.message);
  if (!cur) throw new Error("Result not found.");
  const current = mapResult(cur as Record<string, unknown>);
  if (current.status !== "draft") throw new Error("Only draft results can be edited.");

  let reqId: string | null = null;
  const pr = patch.pathologyRequestId?.trim();
  if (pr) {
    reqId = pr;
    await assertRequestInTenantPatient(supabase, tid, pid, reqId);
  } else {
    reqId = null;
  }

  const hasPdf = Boolean(current.uploaded_file_path);
  const itemCount = patch.items.filter((i) => i.test_label.trim()).length;
  const sourceType = deriveSourceType(hasPdf, itemCount);

  const { data: upd, error: ue } = await supabase
    .from("fi_pathology_results")
    .update({
      result_date: patch.resultDate,
      provider_name: patch.providerName?.trim() ? patch.providerName.trim() : null,
      pathology_request_id: reqId,
      clinical_summary: patch.clinicalSummary?.trim() ? patch.clinicalSummary.trim() : null,
      source_type: sourceType,
    })
    .eq("tenant_id", tid)
    .eq("id", rid)
    .select("*")
    .single();
  if (ue) throw new Error(ue.message);

  const items = await replaceResultItems(supabase, tid, rid, patch.items);
  const result = mapResult(upd as Record<string, unknown>);

  let linkedRequest: {
    id: string;
    request_date: string;
    template_used: string;
    status: string;
  } | null = null;
  if (result.pathology_request_id) {
    const { data: rq } = await supabase
      .from("fi_pathology_requests")
      .select("id, request_date, template_used, status")
      .eq("tenant_id", tid)
      .eq("id", result.pathology_request_id)
      .maybeSingle();
    if (rq) {
      const x = rq as Record<string, unknown>;
      linkedRequest = {
        id: String(x.id),
        request_date: String(x.request_date ?? "").slice(0, 10),
        template_used: String(x.template_used ?? ""),
        status: String(x.status ?? ""),
      };
    }
  }

  return { result, items, linkedRequest };
}

export async function markPathologyResultReviewed(
  tenantId: string,
  patientId: string,
  resultId: string,
  clinicalSummary: string | null,
  actingUserId: string | null,
  client?: SupabaseClient
): Promise<PathologyResultRow> {
  const supabase = client ?? supabaseAdmin();
  const tid = tenantId.trim();
  const pid = patientId.trim();
  const rid = resultId.trim();

  const { data: cur, error: ce } = await supabase
    .from("fi_pathology_results")
    .select("*")
    .eq("tenant_id", tid)
    .eq("patient_id", pid)
    .eq("id", rid)
    .maybeSingle();
  if (ce) throw new Error(ce.message);
  if (!cur) throw new Error("Result not found.");
  const before = mapResult(cur as Record<string, unknown>);
  if (before.status !== "draft") throw new Error("Only draft results can be marked reviewed.");

  const reviewedAt = new Date().toISOString();
  const { data: upd, error: ue } = await supabase
    .from("fi_pathology_results")
    .update({
      status: "reviewed",
      reviewed_at: reviewedAt,
      reviewed_by_user_id: actingUserId,
      clinical_summary: clinicalSummary?.trim() ? clinicalSummary.trim() : before.clinical_summary,
    })
    .eq("tenant_id", tid)
    .eq("id", rid)
    .select("*")
    .single();
  if (ue) throw new Error(ue.message);
  const result = mapResult(upd as Record<string, unknown>);

  const { count: markerCount } = await supabase
    .from("fi_pathology_result_items")
    .select("id", { count: "exact", head: true })
    .eq("tenant_id", tid)
    .eq("result_id", rid);

  await appendBloodResultReviewed({
    tenantId: tid,
    patientId: pid,
    result,
    markerCount: typeof markerCount === "number" ? markerCount : 0,
  });
  return result;
}

export async function archivePathologyResult(tenantId: string, patientId: string, resultId: string, client?: SupabaseClient): Promise<PathologyResultRow> {
  const supabase = client ?? supabaseAdmin();
  const tid = tenantId.trim();
  const pid = patientId.trim();
  const rid = resultId.trim();

  const { data: cur, error: ce } = await supabase
    .from("fi_pathology_results")
    .select("*")
    .eq("tenant_id", tid)
    .eq("patient_id", pid)
    .eq("id", rid)
    .maybeSingle();
  if (ce) throw new Error(ce.message);
  if (!cur) throw new Error("Result not found.");
  const before = mapResult(cur as Record<string, unknown>);
  if (before.status === "archived") throw new Error("Result is already archived.");

  const { count } = await supabase
    .from("fi_pathology_result_items")
    .select("id", { count: "exact", head: true })
    .eq("tenant_id", tid)
    .eq("result_id", rid);

  const { data: upd, error: ue } = await supabase
    .from("fi_pathology_results")
    .update({ status: "archived" })
    .eq("tenant_id", tid)
    .eq("id", rid)
    .select("*")
    .single();
  if (ue) throw new Error(ue.message);
  const result = mapResult(upd as Record<string, unknown>);
  await appendBloodResultArchived({
    tenantId: tid,
    patientId: pid,
    result,
    markerCount: typeof count === "number" ? count : 0,
  });
  return result;
}
