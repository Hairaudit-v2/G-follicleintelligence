import "server-only";

import type { SupabaseClient } from "@supabase/supabase-js";
import { supabaseAdmin } from "@/lib/supabaseAdmin";
import { displayFromPersonMetadata } from "@/src/lib/patients/patientLabels";
import { getPathologyTemplate } from "@/src/lib/pathology/pathologyTemplates";
import type {
  PathologyPdfBranding,
  PathologyRequestAuditEvent,
  PathologyRequestDetailBundle,
  PathologyRequestItemRow,
  PathologyRequestRow,
  PathologyPdfInput,
} from "@/src/lib/pathology/pathologyTypes";

function mapRequest(row: Record<string, unknown>): PathologyRequestRow {
  return {
    id: String(row.id),
    tenant_id: String(row.tenant_id),
    patient_id: String(row.patient_id),
    request_date: String(row.request_date),
    doctor_user_id: row.doctor_user_id != null ? String(row.doctor_user_id) : null,
    template_used: String(row.template_used) as PathologyRequestRow["template_used"],
    status: String(row.status) as PathologyRequestRow["status"],
    clinical_notes: row.clinical_notes != null ? String(row.clinical_notes) : null,
    emailed_to_patient_at: row.emailed_to_patient_at != null ? String(row.emailed_to_patient_at) : null,
    cancelled_at: row.cancelled_at != null ? String(row.cancelled_at) : null,
    pdf_storage_bucket: row.pdf_storage_bucket != null ? String(row.pdf_storage_bucket) : null,
    pdf_storage_path: row.pdf_storage_path != null ? String(row.pdf_storage_path) : null,
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

export async function loadPathologyRequestDetail(
  tenantId: string,
  patientId: string,
  requestId: string,
  client?: SupabaseClient
): Promise<PathologyRequestDetailBundle | null> {
  const supabase = client ?? supabaseAdmin();
  const tid = tenantId.trim();
  const pid = patientId.trim();
  const rid = requestId.trim();

  const { data: reqRow, error: re } = await supabase
    .from("fi_pathology_requests")
    .select("*")
    .eq("tenant_id", tid)
    .eq("patient_id", pid)
    .eq("id", rid)
    .maybeSingle();
  if (re) throw new Error(re.message);
  if (!reqRow) return null;

  const request = mapRequest(reqRow as Record<string, unknown>);

  const { data: itemRows, error: ie } = await supabase
    .from("fi_pathology_request_items")
    .select("*")
    .eq("tenant_id", tid)
    .eq("request_id", rid)
    .order("sort_order", { ascending: true });
  if (ie) throw new Error(ie.message);
  const items = ((itemRows ?? []) as Record<string, unknown>[]).map(mapItem);

  const { data: patRow, error: pe } = await supabase
    .from("fi_patients")
    .select("person_id, primary_clinic_id")
    .eq("tenant_id", tid)
    .eq("id", pid)
    .maybeSingle();
  if (pe) throw new Error(pe.message);
  if (!patRow) return null;
  const personId = String((patRow as { person_id: string }).person_id);
  const primaryClinicId = (patRow as { primary_clinic_id: string | null }).primary_clinic_id;

  const { data: personRow, error: perr } = await supabase
    .from("fi_persons")
    .select("metadata")
    .eq("tenant_id", tid)
    .eq("id", personId)
    .maybeSingle();
  if (perr) throw new Error(perr.message);
  const meta =
    personRow && typeof (personRow as { metadata: unknown }).metadata === "object" && !Array.isArray((personRow as { metadata: unknown }).metadata)
      ? ((personRow as { metadata: Record<string, unknown> }).metadata ?? {})
      : {};
  const { name, email, phone } = displayFromPersonMetadata(meta);
  const dobRaw = meta.date_of_birth;
  const dateOfBirth = typeof dobRaw === "string" && dobRaw.trim() ? dobRaw.trim() : null;

  let doctorDisplayName: string | null = null;
  if (request.doctor_user_id) {
    const uid = request.doctor_user_id;
    const { data: st } = await supabase
      .from("fi_staff")
      .select("full_name")
      .eq("tenant_id", tid)
      .eq("fi_user_id", uid)
      .maybeSingle();
    if (st && (st as { full_name: string }).full_name?.trim()) {
      doctorDisplayName = String((st as { full_name: string }).full_name).trim();
    } else {
      const { data: u } = await supabase.from("fi_users").select("email").eq("tenant_id", tid).eq("id", uid).maybeSingle();
      const em = u ? String((u as { email: string | null }).email ?? "").trim() : "";
      doctorDisplayName = em || `User ${uid.slice(0, 8)}…`;
    }
  }

  const { data: tenantRow } = await supabase.from("fi_tenants").select("name").eq("id", tid).maybeSingle();
  const tenantDisplayName = tenantRow ? String((tenantRow as { name: string }).name).trim() : "Clinic";

  const clinicLines: string[] = [];
  let clinicName = tenantDisplayName;
  let accentHex = "#C6A75E";
  if (primaryClinicId) {
    const { data: clinic } = await supabase.from("fi_clinics").select("display_name, metadata").eq("tenant_id", tid).eq("id", primaryClinicId).maybeSingle();
    if (clinic) {
      const dn = String((clinic as { display_name: string }).display_name ?? "").trim();
      if (dn) clinicName = dn;
      const cm = (clinic as { metadata: unknown }).metadata;
      if (cm && typeof cm === "object" && !Array.isArray(cm)) {
        const cmeta = cm as Record<string, unknown>;
        const ph = typeof cmeta.phone === "string" ? cmeta.phone.trim() : "";
        const ad = typeof cmeta.address === "string" ? cmeta.address.trim() : "";
        const web = typeof cmeta.website === "string" ? cmeta.website.trim() : "";
        if (ph) clinicLines.push(ph);
        if (ad) clinicLines.push(ad);
        if (web) clinicLines.push(web);
        const col = typeof cmeta.brand_color === "string" ? cmeta.brand_color.trim() : "";
        if (col.startsWith("#")) accentHex = col;
      }
    }
  }

  const tpl = getPathologyTemplate(request.template_used);
  const templateLabel = tpl?.label ?? request.template_used.replace(/_/g, " ");

  const branding: PathologyPdfBranding = {
    clinicName,
    accentHex,
    clinicLines,
  };

  return {
    request,
    items,
    patientName: name,
    dateOfBirth,
    patientEmail: email,
    patientPhone: phone,
    doctorDisplayName,
    branding,
    tenantDisplayName,
    templateLabel,
  };
}

export function buildPathologyPdfInputFromDetail(bundle: PathologyRequestDetailBundle): PathologyPdfInput {
  return {
    branding: bundle.branding,
    patientName: bundle.patientName,
    dateOfBirth: bundle.dateOfBirth,
    patientEmail: bundle.patientEmail,
    patientPhone: bundle.patientPhone,
    requestDate: bundle.request.request_date,
    templateLabel: bundle.templateLabel,
    doctorDisplayName: bundle.doctorDisplayName,
    clinicalNotes: bundle.request.clinical_notes,
    tests: bundle.items.map((i) => ({ code: i.test_code, label: i.test_label })),
    requestRef: bundle.request.id,
  };
}

export async function loadPathologyRequestAuditEvents(
  tenantId: string,
  patientId: string,
  requestId: string,
  client?: SupabaseClient
): Promise<PathologyRequestAuditEvent[]> {
  const supabase = client ?? supabaseAdmin();
  const tid = tenantId.trim();
  const pid = patientId.trim();
  const rid = requestId.trim();

  const { data, error } = await supabase
    .from("fi_crm_activity_events")
    .select("id, occurred_at, activity_kind, title, detail")
    .eq("tenant_id", tid)
    .eq("patient_id", pid)
    .order("occurred_at", { ascending: false })
    .limit(120);
  if (error) throw new Error(error.message);

  const out: PathologyRequestAuditEvent[] = [];
  for (const raw of data ?? []) {
    const r = raw as Record<string, unknown>;
    const detailRaw = r.detail;
    const detail =
      detailRaw && typeof detailRaw === "object" && !Array.isArray(detailRaw) ? (detailRaw as Record<string, unknown>) : {};
    const prid = detail.pathology_request_id;
    if (typeof prid !== "string" || prid.trim() !== rid) continue;
    out.push({
      id: String(r.id),
      occurred_at: String(r.occurred_at),
      activity_kind: String(r.activity_kind),
      title: r.title != null ? String(r.title) : null,
      detail,
    });
  }
  return out;
}

export const PATHOLOGY_PATIENT_PDF_BUCKET = "patient-images";

export function buildPathologyPdfStoragePath(tenantId: string, patientId: string, requestId: string): string {
  const tid = tenantId.trim();
  const pid = patientId.trim();
  const rid = requestId.trim();
  return `tenant/${tid}/patients/${pid}/pathology-request-${rid}.pdf`;
}
