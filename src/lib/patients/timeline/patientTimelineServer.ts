import "server-only";

import type { SupabaseClient } from "@supabase/supabase-js";
import { supabaseAdmin } from "@/lib/supabaseAdmin";
import { mapFiCrmLeadRow } from "@/src/lib/crm/leadRow";
import { buildPatientTimeline, mapActivityRowForTimeline } from "./patientTimelineBuild";
import type {
  PatientTimelineBuildOptions,
  PatientTimelineBuildResult,
  PatientTimelineSourceBundle,
} from "./patientTimelineTypes";

const ACTIVITY_LIMIT = 150;

export type LoadPatientTimelineSourcesOptions = {
  client?: SupabaseClient;
  /** Cap raw CRM events loaded from DB before aggregation. */
  activityLimit?: number;
};

/**
 * Loads tenant-scoped rows required to build a patient treatment timeline.
 * Intended for standalone use; the patient profile loader may assemble the same bundle in-process.
 */
export async function loadPatientTimelineSources(
  tenantId: string,
  foundationPatientId: string,
  opts?: LoadPatientTimelineSourcesOptions
): Promise<PatientTimelineSourceBundle> {
  const supabase = opts?.client ?? supabaseAdmin();
  const tid = tenantId.trim();
  const pid = foundationPatientId.trim();
  const actLimit = Math.min(Math.max(opts?.activityLimit ?? ACTIVITY_LIMIT, 1), 300);

  const { data: patRow, error: pe } = await supabase
    .from("fi_patients")
    .select("id, tenant_id, patient_status, created_at, updated_at")
    .eq("tenant_id", tid)
    .eq("id", pid)
    .maybeSingle();
  if (pe) throw new Error(pe.message);
  if (!patRow) throw new Error("Patient not found.");

  const pr = patRow as Record<string, unknown>;
  const patient = {
    id: String(pr.id),
    created_at: String(pr.created_at),
    updated_at: String(pr.updated_at),
    patient_status: String(pr.patient_status ?? "unknown"),
  };

  const { data: clinicalRow } = await supabase
    .from("fi_patient_clinical_details")
    .select("patient_id, created_at, updated_at")
    .eq("tenant_id", tid)
    .eq("patient_id", pid)
    .maybeSingle();

  const { data: imgRows, error: ie } = await supabase
    .from("fi_patient_images")
    .select("id, image_category, image_status, caption, created_at, archived_at")
    .eq("tenant_id", tid)
    .eq("patient_id", pid)
    .order("created_at", { ascending: false })
    .limit(200);
  if (ie) throw new Error(ie.message);

  const images = (imgRows ?? []).map((r) => {
    const x = r as Record<string, unknown>;
    const st = String(x.image_status).toLowerCase();
    return {
      id: String(x.id),
      image_category: String(x.image_category),
      image_status: st === "archived" ? ("archived" as const) : ("active" as const),
      caption: x.caption != null ? String(x.caption) : null,
      created_at: String(x.created_at),
      archived_at: x.archived_at != null ? String(x.archived_at) : null,
    };
  });

  const { data: leadRows, error: le } = await supabase
    .from("fi_crm_leads")
    .select("*")
    .eq("tenant_id", tid)
    .eq("patient_id", pid)
    .order("updated_at", { ascending: false });
  if (le) throw new Error(le.message);

  const leadsMapped = (leadRows ?? []).map((r) => mapFiCrmLeadRow(r as Record<string, unknown>));
  const stageIds = Array.from(new Set(leadsMapped.map((l) => l.current_stage_id).filter(Boolean) as string[]));
  const stageLabelById = new Map<string, string>();
  if (stageIds.length) {
    const { data: stages, error: se } = await supabase.from("fi_crm_pipeline_stages").select("id, label").eq("tenant_id", tid).in("id", stageIds);
    if (se) throw new Error(se.message);
    for (const s of stages ?? []) {
      stageLabelById.set(String((s as { id: string }).id), String((s as { label: string }).label));
    }
  }

  const leads = leadsMapped.map((lead) => ({
    id: lead.id,
    created_at: lead.created_at,
    updated_at: lead.updated_at,
    status: lead.status,
    converted_at: lead.converted_at,
    converted_case_id: lead.converted_case_id,
    current_stage_id: lead.current_stage_id,
    stageLabel: lead.current_stage_id ? stageLabelById.get(lead.current_stage_id) ?? null : null,
  }));

  const { data: caseRows, error: ce } = await supabase
    .from("fi_cases")
    .select("id, status, metadata, created_at, foundation_patient_id")
    .eq("tenant_id", tid)
    .eq("foundation_patient_id", pid)
    .order("created_at", { ascending: false });
  if (ce) throw new Error(ce.message);

  const caseIds = (caseRows ?? []).map((c) => String((c as { id: string }).id));
  let leadForCases: { id: string; summary: string | null; case_id: string | null }[] = [];
  if (caseIds.length) {
    const { data: lrows, error: lce } = await supabase
      .from("fi_crm_leads")
      .select("id, summary, case_id")
      .eq("tenant_id", tid)
      .in("case_id", caseIds);
    if (lce) throw new Error(lce.message);
    leadForCases = (lrows ?? []) as { id: string; summary: string | null; case_id: string | null }[];
  }
  const leadByCaseId = new Map<string, { id: string; summary: string | null }>();
  for (const row of leadForCases) {
    const cid = row.case_id;
    if (!cid) continue;
    leadByCaseId.set(String(cid), { id: String(row.id), summary: row.summary != null ? String(row.summary) : null });
  }

  const cases = (caseRows ?? []).map((raw) => {
    const c = raw as { id: string; status: string; metadata: unknown; created_at: string };
    const meta =
      c.metadata && typeof c.metadata === "object" && !Array.isArray(c.metadata)
        ? (c.metadata as Record<string, unknown>)
        : {};
    const ct = meta.case_type ?? meta.event_type;
    const caseType = typeof ct === "string" ? ct : null;
    const link = leadByCaseId.get(String(c.id));
    return {
      id: String(c.id),
      status: String(c.status),
      case_type: caseType,
      created_at: String(c.created_at),
      sourceLeadId: link?.id ?? null,
    };
  });

  const { data: bookingRows, error: be } = await supabase
    .from("fi_bookings")
    .select("id, start_at, end_at, booking_status, booking_type, title, lead_id, case_id, created_at, updated_at, cancelled_at")
    .eq("tenant_id", tid)
    .eq("patient_id", pid)
    .order("start_at", { ascending: false });
  if (be) throw new Error(be.message);

  const bookings = (bookingRows ?? []).map((b) => ({
    id: String((b as { id: string }).id),
    booking_type: String((b as { booking_type: string }).booking_type),
    booking_status: String((b as { booking_status: string }).booking_status),
    title: (b as { title: string | null }).title != null ? String((b as { title: string | null }).title) : null,
    start_at: String((b as { start_at: string }).start_at),
    lead_id: (b as { lead_id: string | null }).lead_id != null ? String((b as { lead_id: string | null }).lead_id) : null,
    case_id: (b as { case_id: string | null }).case_id != null ? String((b as { case_id: string | null }).case_id) : null,
    created_at: String((b as { created_at: string }).created_at),
    updated_at: String((b as { updated_at: string }).updated_at),
    cancelled_at: (b as { cancelled_at: string | null }).cancelled_at != null ? String((b as { cancelled_at: string | null }).cancelled_at) : null,
  }));

  const leadIds = leadsMapped.map((l) => l.id);
  const orParts: string[] = [`patient_id.eq.${pid}`];
  if (leadIds.length) orParts.push(`lead_id.in.(${leadIds.join(",")})`);
  if (caseIds.length) orParts.push(`case_id.in.(${caseIds.join(",")})`);

  const { data: actRows, error: ae } = await supabase
    .from("fi_crm_activity_events")
    .select("id, occurred_at, activity_kind, title, lead_id, case_id, patient_id, detail")
    .eq("tenant_id", tid)
    .or(orParts.join(","))
    .order("occurred_at", { ascending: false })
    .limit(actLimit);

  if (ae) throw new Error(ae.message);
  const activity = (actRows ?? []).map((a) => mapActivityRowForTimeline(a as Record<string, unknown>));

  const clinical = clinicalRow
    ? {
        patient_id: String((clinicalRow as { patient_id: string }).patient_id),
        created_at: String((clinicalRow as { created_at: string }).created_at),
        updated_at: String((clinicalRow as { updated_at: string }).updated_at),
      }
    : null;

  return {
    tenantId: tid,
    foundationPatientId: pid,
    patient,
    leads,
    cases,
    bookings,
    activity,
    clinical,
    images,
  };
}

export async function loadPatientTimeline(
  tenantId: string,
  foundationPatientId: string,
  buildOptions?: Omit<PatientTimelineBuildOptions, "hrefContext"> & { hrefContext?: PatientTimelineBuildOptions["hrefContext"] },
  opts?: LoadPatientTimelineSourcesOptions
): Promise<PatientTimelineBuildResult> {
  const bundle = await loadPatientTimelineSources(tenantId, foundationPatientId, opts);
  const hrefContext = buildOptions?.hrefContext ?? { tenantId: bundle.tenantId };
  return buildPatientTimeline(bundle, {
    limit: buildOptions?.limit,
    offset: buildOptions?.offset,
    sort: buildOptions?.sort,
    hrefContext,
  });
}
