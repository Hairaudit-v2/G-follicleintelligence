import "server-only";

import type { SupabaseClient } from "@supabase/supabase-js";
import { supabaseAdmin } from "@/lib/supabaseAdmin";
import type {
  PathologyRequestOptionRow,
  PathologyResultDetailBundle,
  PathologyResultItemRow,
  PathologyResultRow,
} from "./pathologyResultTypes";

function mapResult(row: Record<string, unknown>): PathologyResultRow {
  return {
    id: String(row.id),
    tenant_id: String(row.tenant_id),
    patient_id: String(row.patient_id),
    pathology_request_id:
      row.pathology_request_id != null ? String(row.pathology_request_id) : null,
    result_date: String(row.result_date ?? "").slice(0, 10),
    provider_name: row.provider_name != null ? String(row.provider_name) : null,
    source_type: String(row.source_type) as PathologyResultRow["source_type"],
    uploaded_file_bucket:
      row.uploaded_file_bucket != null ? String(row.uploaded_file_bucket) : null,
    uploaded_file_path: row.uploaded_file_path != null ? String(row.uploaded_file_path) : null,
    status: String(row.status) as PathologyResultRow["status"],
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
    flag: String(row.flag) as PathologyResultItemRow["flag"],
    sort_order: Number(row.sort_order ?? 0),
    metadata:
      row.metadata && typeof row.metadata === "object" && !Array.isArray(row.metadata)
        ? (row.metadata as Record<string, unknown>)
        : {},
    created_at: String(row.created_at),
  };
}

export async function loadPathologyRequestOptionsForPatient(
  tenantId: string,
  patientId: string,
  client?: SupabaseClient
): Promise<PathologyRequestOptionRow[]> {
  const supabase = client ?? supabaseAdmin();
  const tid = tenantId.trim();
  const pid = patientId.trim();
  const { data, error } = await supabase
    .from("fi_pathology_requests")
    .select("id, request_date, template_used")
    .eq("tenant_id", tid)
    .eq("patient_id", pid)
    .order("created_at", { ascending: false })
    .limit(80);
  if (error) throw new Error(error.message);
  return (data ?? []).map((r) => {
    const x = r as Record<string, unknown>;
    return {
      id: String(x.id),
      request_date: String(x.request_date ?? "").slice(0, 10),
      template_used: String(x.template_used ?? ""),
    };
  });
}

async function resolveUserDisplayName(
  supabase: SupabaseClient,
  tenantId: string,
  userId: string
): Promise<string | null> {
  const { data: st } = await supabase
    .from("fi_staff")
    .select("full_name")
    .eq("tenant_id", tenantId)
    .eq("fi_user_id", userId)
    .maybeSingle();
  if (st && (st as { full_name: string }).full_name?.trim()) {
    return String((st as { full_name: string }).full_name).trim();
  }
  const { data: u } = await supabase
    .from("fi_users")
    .select("email")
    .eq("tenant_id", tenantId)
    .eq("id", userId)
    .maybeSingle();
  const em = u ? String((u as { email: string | null }).email ?? "").trim() : "";
  return em || `User ${userId.slice(0, 8)}…`;
}

export async function loadPathologyResultDetail(
  tenantId: string,
  patientId: string,
  resultId: string,
  client?: SupabaseClient
): Promise<PathologyResultDetailBundle | null> {
  const supabase = client ?? supabaseAdmin();
  const tid = tenantId.trim();
  const pid = patientId.trim();
  const rid = resultId.trim();

  const { data: resRow, error: re } = await supabase
    .from("fi_pathology_results")
    .select("*")
    .eq("tenant_id", tid)
    .eq("patient_id", pid)
    .eq("id", rid)
    .maybeSingle();
  if (re) throw new Error(re.message);
  if (!resRow) return null;

  const result = mapResult(resRow as Record<string, unknown>);

  const { data: itemRows, error: ie } = await supabase
    .from("fi_pathology_result_items")
    .select("*")
    .eq("tenant_id", tid)
    .eq("result_id", rid)
    .order("sort_order", { ascending: true });
  if (ie) throw new Error(ie.message);
  const items = ((itemRows ?? []) as Record<string, unknown>[]).map(mapItem);

  let linkedRequest: PathologyResultDetailBundle["linkedRequest"] = null;
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

  let reviewerDisplayName: string | null = null;
  if (result.reviewed_by_user_id) {
    reviewerDisplayName = await resolveUserDisplayName(supabase, tid, result.reviewed_by_user_id);
  }

  let pdfSignedUrl: string | null = null;
  const bucket = result.uploaded_file_bucket?.trim();
  const path = result.uploaded_file_path?.trim();
  if (bucket && path) {
    const { data: signed, error: se } = await supabase.storage
      .from(bucket)
      .createSignedUrl(path, 3600);
    if (!se && signed?.signedUrl) {
      pdfSignedUrl = signed.signedUrl;
    }
  }

  return { result, items, linkedRequest, reviewerDisplayName, pdfSignedUrl };
}
