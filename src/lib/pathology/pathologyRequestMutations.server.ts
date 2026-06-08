import "server-only";

import type { SupabaseClient } from "@supabase/supabase-js";
import { supabaseAdmin } from "@/lib/supabaseAdmin";
import { appendCrmActivityEvent } from "@/src/lib/crm/activity";
import type {
  PathologyRequestItemRow,
  PathologyRequestRow,
  PathologyRequestStatus,
  PathologyTemplateId,
} from "./pathologyTypes";

function mapRequest(row: Record<string, unknown>): PathologyRequestRow {
  return {
    id: String(row.id),
    tenant_id: String(row.tenant_id),
    patient_id: String(row.patient_id),
    request_date: String(row.request_date),
    doctor_user_id: row.doctor_user_id != null ? String(row.doctor_user_id) : null,
    template_used: String(row.template_used) as PathologyTemplateId,
    status: String(row.status) as PathologyRequestStatus,
    metadata:
      row.metadata && typeof row.metadata === "object" && !Array.isArray(row.metadata)
        ? (row.metadata as Record<string, unknown>)
        : {},
    created_at: String(row.created_at),
    updated_at: String(row.updated_at),
  };
}

function mapItem(row: Record<string, unknown>): PathologyRequestItemRow {
  return {
    id: String(row.id),
    tenant_id: String(row.tenant_id),
    request_id: String(row.request_id),
    sort_order: Number(row.sort_order ?? 0),
    test_code: row.test_code != null ? String(row.test_code) : null,
    test_label: String(row.test_label),
    created_at: String(row.created_at),
  };
}

export type CreatePathologyRequestInput = {
  tenantId: string;
  patientId: string;
  templateUsed: PathologyTemplateId;
  requestDate: string;
  doctorUserId: string | null;
  tests: { code: string | null; label: string }[];
};

export type CreatePathologyRequestResult = {
  request: PathologyRequestRow;
  items: PathologyRequestItemRow[];
};

/**
 * Persists a blood/pathology request and appends CRM activity for profile Activity + treatment timeline.
 */
export async function createPathologyRequest(
  input: CreatePathologyRequestInput,
  client?: SupabaseClient
): Promise<CreatePathologyRequestResult> {
  const supabase = client ?? supabaseAdmin();
  const tid = input.tenantId.trim();
  const pid = input.patientId.trim();

  const { data: patient, error: pe } = await supabase
    .from("fi_patients")
    .select("id")
    .eq("tenant_id", tid)
    .eq("id", pid)
    .maybeSingle();
  if (pe) throw new Error(pe.message);
  if (!patient) throw new Error("Patient not found for tenant.");

  const { data: reqRow, error: re } = await supabase
    .from("fi_pathology_requests")
    .insert({
      tenant_id: tid,
      patient_id: pid,
      request_date: input.requestDate,
      doctor_user_id: input.doctorUserId,
      template_used: input.templateUsed,
      status: "saved",
      metadata: {},
    })
    .select("*")
    .single();
  if (re) throw new Error(re.message);

  const request = mapRequest(reqRow as Record<string, unknown>);

  const itemPayloads = input.tests.map((t, idx) => ({
    tenant_id: tid,
    request_id: request.id,
    sort_order: idx,
    test_code: t.code?.trim() ? t.code.trim() : null,
    test_label: t.label.trim(),
  }));

  const { data: itemRows, error: ie } = await supabase.from("fi_pathology_request_items").insert(itemPayloads).select("*");
  if (ie) throw new Error(ie.message);

  const items = ((itemRows ?? []) as Record<string, unknown>[]).map(mapItem);

  await appendCrmActivityEvent({
    tenantId: tid,
    activityKind: "pathology.blood_request.created",
    title: "Blood request created",
    patientId: pid,
    detail: {
      pathology_request_id: request.id,
      template_used: input.templateUsed,
      test_count: items.length,
    },
    occurredAt: new Date().toISOString(),
  });

  return { request, items };
}
