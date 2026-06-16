import "server-only";

import type { SupabaseClient } from "@supabase/supabase-js";
import { supabaseAdmin } from "@/lib/supabaseAdmin";
import { mapFiCrmLeadRow } from "@/src/lib/crm/leadRow";
import type { FiCrmLeadRow } from "@/src/lib/crm/types";
import { computePatientProfileSummaryMetrics, sortActivityEventsNewestFirst, splitBookingsUpcomingPast } from "./patientProfileSummary";
import { normalizePatientStatus, type PatientStatusValue } from "./patientPolicy";

function normalizePreferredContact(raw: unknown): "email" | "sms" | "both" | null {
  if (raw == null) return null;
  const t = String(raw).trim().toLowerCase();
  if (t === "email" || t === "sms" || t === "both") return t;
  return null;
}
import type { PatientClinicalDetailsRow } from "./clinicalDetailsServer";
import { loadPatientClinicalDetails } from "./clinicalDetailsServer";
import type { PatientImagesProfileBundle } from "@/src/lib/patientImages/patientImageTypes";
import { loadPatientImagesProfileBundle } from "@/src/lib/patientImages/patientImagesServer";
import { buildPatientTimeline, mapActivityRowForTimeline } from "@/src/lib/patients/timeline/patientTimelineBuild";
import type { PatientTimelineBuildResult } from "@/src/lib/patients/timeline/patientTimelineTypes";

export type PatientProfilePerson = {
  id: string;
  metadata: Record<string, unknown>;
  created_at: string;
  updated_at: string;
};

export type PatientProfilePatientRow = {
  id: string;
  tenant_id: string;
  person_id: string;
  primary_clinic_id: string | null;
  metadata: Record<string, unknown>;
  admin_note: string | null;
  patient_status: PatientStatusValue;
  reminder_consent: boolean;
  preferred_contact_method: "email" | "sms" | "both" | null;
  created_at: string;
  updated_at: string;
};

export type PatientProfileLeadCard = {
  lead: FiCrmLeadRow;
  stageLabel: string | null;
  ownerLabel: string | null;
};

export type PatientProfileCaseCard = {
  id: string;
  status: string;
  case_type: string | null;
  created_at: string;
  sourceLeadId: string | null;
  sourceLeadSummary: string | null;
};

export type PatientProfileBookingCard = {
  id: string;
  start_at: string;
  end_at: string;
  booking_status: string;
  booking_type: string;
  title: string | null;
  lead_id: string | null;
  case_id: string | null;
  created_at: string;
  updated_at: string;
  cancelled_at: string | null;
};

export type PatientProfileActivityItem = {
  id: string;
  occurred_at: string;
  activity_kind: string;
  title: string | null;
  lead_id: string | null;
  case_id: string | null;
};

export type PatientClinicalDetailsProfileView = {
  row: PatientClinicalDetailsRow | null;
  updatedByLabel: string | null;
};

export type PatientProfileFoundationData = {
  tenantId: string;
  foundationPatientId: string;
  patient: PatientProfilePatientRow;
  person: PatientProfilePerson;
  clinicalDetails: PatientClinicalDetailsProfileView;
  patientImages: PatientImagesProfileBundle;
  leads: PatientProfileLeadCard[];
  cases: PatientProfileCaseCard[];
  bookings: { upcoming: PatientProfileBookingCard[]; past: PatientProfileBookingCard[] };
  activity: PatientProfileActivityItem[];
  patientTimeline: PatientTimelineBuildResult;
  summary: ReturnType<typeof computePatientProfileSummaryMetrics>;
};

export type PatientProfileLegacyGlobalData = {
  tenantId: string;
  globalPatientId: string;
};

export type PatientProfileLoadResult =
  | { ok: true; mode: "foundation"; data: PatientProfileFoundationData }
  | { ok: true; mode: "legacy_global"; data: PatientProfileLegacyGlobalData }
  | { ok: false; error: "not_found" };

async function resolveSlugToFoundationOrGlobal(
  supabase: SupabaseClient,
  tenantId: string,
  slug: string
): Promise<
  | { kind: "foundation"; foundationPatientId: string }
  | { kind: "legacy_global"; globalPatientId: string }
  | { kind: "none" }
> {
  const tid = tenantId.trim();
  const s = slug.trim();
  const { data: asPatient, error: pErr } = await supabase.from("fi_patients").select("id").eq("tenant_id", tid).eq("id", s).maybeSingle();
  if (pErr) throw new Error(pErr.message);
  if (asPatient) return { kind: "foundation", foundationPatientId: s };

  const { data: asGlobal, error: gErr } = await supabase.from("fi_global_patients").select("id").eq("tenant_id", tid).eq("id", s).maybeSingle();
  if (gErr) throw new Error(gErr.message);
  if (!asGlobal) return { kind: "none" };

  const { data: resRows, error: rErr } = await supabase
    .from("v_fi_patient_resolution")
    .select("foundation_patient_id")
    .eq("tenant_id", tid)
    .eq("global_patient_id", s);
  if (rErr) throw new Error(rErr.message);
  const fids = (resRows ?? [])
    .map((r) => (r as { foundation_patient_id: string | null }).foundation_patient_id)
    .filter((x): x is string => Boolean(x));
  if (fids.length > 0) return { kind: "foundation", foundationPatientId: fids[0]! };

  return { kind: "legacy_global", globalPatientId: s };
}

function mapPerson(row: Record<string, unknown>): PatientProfilePerson {
  const meta = row.metadata;
  return {
    id: String(row.id),
    metadata:
      meta && typeof meta === "object" && !Array.isArray(meta) ? (meta as Record<string, unknown>) : {},
    created_at: String(row.created_at),
    updated_at: String(row.updated_at),
  };
}

export async function loadPatientProfile(
  tenantId: string,
  patientSlug: string,
  client?: SupabaseClient
): Promise<PatientProfileLoadResult> {
  const supabase = client ?? supabaseAdmin();
  const tid = tenantId.trim();
  const anchor = await resolveSlugToFoundationOrGlobal(supabase, tid, patientSlug);
  if (anchor.kind === "none") return { ok: false, error: "not_found" };
  if (anchor.kind === "legacy_global") {
    return { ok: true, mode: "legacy_global", data: { tenantId: tid, globalPatientId: anchor.globalPatientId } };
  }

  const foundationPatientId = anchor.foundationPatientId;

  const { data: patRow, error: pe } = await supabase
    .from("fi_patients")
    .select("id, tenant_id, person_id, primary_clinic_id, metadata, admin_note, patient_status, reminder_consent, preferred_contact_method, created_at, updated_at")
    .eq("tenant_id", tid)
    .eq("id", foundationPatientId)
    .maybeSingle();
  if (pe) throw new Error(pe.message);
  if (!patRow) return { ok: false, error: "not_found" };

  const pr = patRow as Record<string, unknown>;
  const personId = String(pr.person_id);

  const { data: personRow, error: perr } = await supabase
    .from("fi_persons")
    .select("id, metadata, created_at, updated_at")
    .eq("tenant_id", tid)
    .eq("id", personId)
    .maybeSingle();
  if (perr) throw new Error(perr.message);
  if (!personRow) return { ok: false, error: "not_found" };

  const patient: PatientProfilePatientRow = {
    id: String(pr.id),
    tenant_id: String(pr.tenant_id),
    person_id: personId,
    primary_clinic_id: pr.primary_clinic_id != null ? String(pr.primary_clinic_id) : null,
    metadata:
      pr.metadata && typeof pr.metadata === "object" && !Array.isArray(pr.metadata)
        ? (pr.metadata as Record<string, unknown>)
        : {},
    admin_note: pr.admin_note != null ? String(pr.admin_note) : null,
    patient_status: normalizePatientStatus(pr.patient_status != null ? String(pr.patient_status) : undefined),
    reminder_consent: Boolean(pr.reminder_consent),
    preferred_contact_method: normalizePreferredContact(pr.preferred_contact_method),
    created_at: String(pr.created_at),
    updated_at: String(pr.updated_at),
  };

  const person = mapPerson(personRow as Record<string, unknown>);

  const clinicalRow = await loadPatientClinicalDetails(tid, foundationPatientId, supabase);
  const patientImages = await loadPatientImagesProfileBundle(tid, foundationPatientId, supabase);
  let clinicalDetailsUpdatedByLabel: string | null = null;
  if (clinicalRow?.updated_by_user_id) {
    const { data: updater, error: ueUp } = await supabase
      .from("fi_users")
      .select("email")
      .eq("tenant_id", tid)
      .eq("id", clinicalRow.updated_by_user_id)
      .maybeSingle();
    if (!ueUp && updater) {
      const em = String((updater as { email: string | null }).email ?? "").trim();
      clinicalDetailsUpdatedByLabel = em || clinicalRow.updated_by_user_id.slice(0, 8);
    }
  }

  const { data: leadRows, error: le } = await supabase
    .from("fi_crm_leads")
    .select("*")
    .eq("tenant_id", tid)
    .eq("patient_id", foundationPatientId)
    .order("updated_at", { ascending: false });
  if (le) throw new Error(le.message);

  const leadsMapped = (leadRows ?? []).map((r) => mapFiCrmLeadRow(r as Record<string, unknown>));
  const stageIds = Array.from(new Set(leadsMapped.map((l) => l.current_stage_id).filter(Boolean) as string[]));
  const ownerIds = Array.from(new Set(leadsMapped.map((l) => l.primary_owner_user_id).filter(Boolean) as string[]));

  const stageLabelById = new Map<string, string>();
  if (stageIds.length) {
    const { data: stages, error: se } = await supabase.from("fi_crm_pipeline_stages").select("id, label").eq("tenant_id", tid).in("id", stageIds);
    if (se) throw new Error(se.message);
    for (const s of stages ?? []) {
      stageLabelById.set(String((s as { id: string }).id), String((s as { label: string }).label));
    }
  }

  const ownerLabelById = new Map<string, string>();
  if (ownerIds.length) {
    const { data: users, error: ue } = await supabase.from("fi_users").select("id, email, role").eq("tenant_id", tid).in("id", ownerIds);
    if (ue) throw new Error(ue.message);
    for (const u of users ?? []) {
      const id = String((u as { id: string }).id);
      const em = (u as { email: string | null }).email;
      ownerLabelById.set(id, em?.trim() || id.slice(0, 8));
    }
  }

  const leads: PatientProfileLeadCard[] = leadsMapped.map((lead) => ({
    lead,
    stageLabel: lead.current_stage_id ? stageLabelById.get(lead.current_stage_id) ?? null : null,
    ownerLabel: lead.primary_owner_user_id ? ownerLabelById.get(lead.primary_owner_user_id) ?? null : null,
  }));

  const { data: caseRows, error: ce } = await supabase
    .from("fi_cases")
    .select("id, status, metadata, created_at, foundation_patient_id")
    .eq("tenant_id", tid)
    .eq("foundation_patient_id", foundationPatientId)
    .is("deleted_at", null)
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
    leadByCaseId.set(String(cid), {
      id: String(row.id),
      summary: row.summary != null ? String(row.summary) : null,
    });
  }

  const cases: PatientProfileCaseCard[] = (caseRows ?? []).map((raw) => {
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
      sourceLeadSummary: link?.summary ?? null,
    };
  });

  const { data: bookingRows, error: be } = await supabase
    .from("fi_bookings")
    .select("id, start_at, end_at, booking_status, booking_type, title, lead_id, case_id, created_at, updated_at, cancelled_at")
    .eq("tenant_id", tid)
    .eq("patient_id", foundationPatientId)
    .order("start_at", { ascending: false });
  if (be) throw new Error(be.message);

  const bookingsRaw: PatientProfileBookingCard[] = (bookingRows ?? []).map((b) => ({
    id: String((b as { id: string }).id),
    start_at: String((b as { start_at: string }).start_at),
    end_at: String((b as { end_at: string }).end_at),
    booking_status: String((b as { booking_status: string }).booking_status),
    booking_type: String((b as { booking_type: string }).booking_type),
    title: (b as { title: string | null }).title != null ? String((b as { title: string | null }).title) : null,
    lead_id: (b as { lead_id: string | null }).lead_id != null ? String((b as { lead_id: string | null }).lead_id) : null,
    case_id: (b as { case_id: string | null }).case_id != null ? String((b as { case_id: string | null }).case_id) : null,
    created_at: String((b as { created_at: string }).created_at),
    updated_at: String((b as { updated_at: string }).updated_at),
    cancelled_at: (b as { cancelled_at: string | null }).cancelled_at != null ? String((b as { cancelled_at: string | null }).cancelled_at) : null,
  }));

  const split = splitBookingsUpcomingPast(bookingsRaw);

  const leadIds = leadsMapped.map((l) => l.id);

  let actRows: Record<string, unknown>[] | null = null;
  let ae: { message: string } | null = null;

  if (leadIds.length === 0 && caseIds.length === 0) {
    const res = await supabase
      .from("fi_crm_activity_events")
      .select("id, occurred_at, activity_kind, title, lead_id, case_id, patient_id, detail")
      .eq("tenant_id", tid)
      .eq("patient_id", foundationPatientId)
      .order("occurred_at", { ascending: false })
      .limit(200);
    actRows = res.data as Record<string, unknown>[] | null;
    ae = res.error;
  } else {
    const orParts: string[] = [`patient_id.eq.${foundationPatientId}`];
    if (leadIds.length) orParts.push(`lead_id.in.(${leadIds.join(",")})`);
    if (caseIds.length) orParts.push(`case_id.in.(${caseIds.join(",")})`);
    const res = await supabase
      .from("fi_crm_activity_events")
      .select("id, occurred_at, activity_kind, title, lead_id, case_id, patient_id, detail")
      .eq("tenant_id", tid)
      .or(orParts.join(","))
      .order("occurred_at", { ascending: false })
      .limit(200);
    actRows = res.data as Record<string, unknown>[] | null;
    ae = res.error;
  }

  if (ae) throw new Error(ae.message);

  const activityMapped = (actRows ?? []).map((a) => ({
    id: String((a as { id: string }).id),
    occurred_at: String((a as { occurred_at: string }).occurred_at),
    activity_kind: String((a as { activity_kind: string }).activity_kind),
    title: (a as { title: string | null }).title != null ? String((a as { title: string | null }).title) : null,
    lead_id: (a as { lead_id: string | null }).lead_id != null ? String((a as { lead_id: string | null }).lead_id) : null,
    case_id: (a as { case_id: string | null }).case_id != null ? String((a as { case_id: string | null }).case_id) : null,
  }));

  const activity: PatientProfileActivityItem[] = sortActivityEventsNewestFirst(activityMapped).slice(0, 80);

  const timelineActivity = (actRows ?? []).slice(0, 120).map((a) => mapActivityRowForTimeline(a as Record<string, unknown>));

  const timelineImages = [
    ...patientImages.activeWithSignedUrls.map(({ image }) => ({
      id: image.id,
      image_category: image.image_category,
      image_status: image.image_status,
      caption: image.caption,
      created_at: image.created_at,
      archived_at: image.archived_at,
    })),
    ...patientImages.archived.map((image) => ({
      id: image.id,
      image_category: image.image_category,
      image_status: image.image_status,
      caption: image.caption,
      created_at: image.created_at,
      archived_at: image.archived_at,
    })),
  ];

  const patientTimeline: PatientTimelineBuildResult = buildPatientTimeline(
    {
      tenantId: tid,
      foundationPatientId,
      patient: {
        id: patient.id,
        created_at: patient.created_at,
        updated_at: patient.updated_at,
        patient_status: patient.patient_status,
      },
      leads: leadsMapped.map((lead) => ({
        id: lead.id,
        created_at: lead.created_at,
        updated_at: lead.updated_at,
        status: lead.status,
        converted_at: lead.converted_at,
        converted_case_id: lead.converted_case_id,
        current_stage_id: lead.current_stage_id,
        stageLabel: lead.current_stage_id ? stageLabelById.get(lead.current_stage_id) ?? null : null,
      })),
      cases: cases.map((c) => ({
        id: c.id,
        status: c.status,
        case_type: c.case_type,
        created_at: c.created_at,
        sourceLeadId: c.sourceLeadId,
      })),
      bookings: bookingsRaw.map((b) => ({
        id: b.id,
        booking_type: b.booking_type,
        booking_status: b.booking_status,
        title: b.title,
        start_at: b.start_at,
        lead_id: b.lead_id,
        case_id: b.case_id,
        created_at: b.created_at,
        updated_at: b.updated_at,
        cancelled_at: b.cancelled_at,
      })),
      activity: timelineActivity,
      clinical: clinicalRow
        ? {
            patient_id: clinicalRow.patient_id,
            created_at: clinicalRow.created_at,
            updated_at: clinicalRow.updated_at,
            norwood_scale: clinicalRow.norwood_scale,
            ludwig_scale: clinicalRow.ludwig_scale,
            hairline_pattern: clinicalRow.hairline_pattern,
            primary_concern: clinicalRow.primary_concern,
          }
        : null,
      images: timelineImages,
    },
    { hrefContext: { tenantId: tid }, limit: 100, offset: 0, sort: "newest_first" }
  );

  const summary = computePatientProfileSummaryMetrics({
    leads: leadsMapped,
    cases: cases.map((c) => ({ status: c.status })),
    bookings: bookingsRaw.map((b) => ({ start_at: b.start_at, booking_status: b.booking_status })),
    activityEvents: activity.map((e) => ({ occurred_at: e.occurred_at })),
  });

  return {
    ok: true,
    mode: "foundation",
    data: {
      tenantId: tid,
      foundationPatientId,
      patient,
      person,
      clinicalDetails: { row: clinicalRow, updatedByLabel: clinicalDetailsUpdatedByLabel },
      patientImages,
      leads,
      cases,
      bookings: split,
      activity,
      patientTimeline,
      summary,
    },
  };
}
