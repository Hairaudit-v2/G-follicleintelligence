import "server-only";

import type { SupabaseClient } from "@supabase/supabase-js";
import { supabaseAdmin } from "@/lib/supabaseAdmin";
import { derivePatientIdentityContact } from "@/src/lib/patients/patientIdentityContact";

import { buildPhotoProtocolAlerts, type PhotoProtocolAlert } from "./protocolAlerts";
import {
  calculatePhotoProtocolAnalytics,
  clinicalContextFromSession,
  isRequiredSessionSlotMissing,
  requiredSlotDefinitionForSessionSlot,
  type PhotoProtocolAnalyticsSummary,
} from "./protocolAnalytics";
import type {
  HliPhotoProtocolSession,
  HliPhotoProtocolSessionSlot,
  HliPhotoProtocolSlot,
  HliPhotoProtocolTemplate,
} from "./types";

const DEFAULT_RANGE_DAYS = 90;
const MAX_SESSIONS = 5000;

export type PhotoProtocolAnalyticsFilters = {
  clinic_id?: string | null;
  /** Matches `hli_photo_protocol_sessions.metadata->>clinical_context`. */
  clinical_context?: string | null;
  source_system?: HliPhotoProtocolSession["source_system"] | null;
  date_from?: string | null;
  date_to?: string | null;
  status?: HliPhotoProtocolSession["status"] | "all" | null;
};

export type PhotoProtocolIncompleteSessionRow = {
  session_id: string;
  patient_id: string | null;
  patient_display: string;
  clinical_context: string;
  protocol_name: string;
  protocol_template_slug: string;
  missing_required_count: number;
  status: HliPhotoProtocolSession["status"];
  started_at: string | null;
  patient_twin_href: string;
};

function mapTemplate(r: Record<string, unknown>): HliPhotoProtocolTemplate {
  return {
    id: String(r.id),
    slug: String(r.slug),
    name: String(r.name),
    description: r.description != null ? String(r.description) : null,
    source_system_scope: String(
      r.source_system_scope
    ) as HliPhotoProtocolTemplate["source_system_scope"],
    clinical_context: String(r.clinical_context) as HliPhotoProtocolTemplate["clinical_context"],
    is_active: Boolean(r.is_active),
    created_at: String(r.created_at),
    updated_at: String(r.updated_at),
  };
}

function mapSlot(r: Record<string, unknown>): HliPhotoProtocolSlot {
  const acc = r.acceptable_image_categories;
  const acceptable =
    Array.isArray(acc) && acc.length > 0
      ? (acc.map((x) => String(x)) as HliPhotoProtocolSlot["acceptable_image_categories"])
      : null;
  return {
    id: String(r.id),
    protocol_template_id: String(r.protocol_template_id),
    slot_slug: String(r.slot_slug),
    label: String(r.label),
    required_image_category:
      r.required_image_category != null
        ? (String(r.required_image_category) as HliPhotoProtocolSlot["required_image_category"])
        : null,
    acceptable_image_categories: acceptable,
    required_surgery_stage:
      r.required_surgery_stage != null
        ? (String(r.required_surgery_stage) as HliPhotoProtocolSlot["required_surgery_stage"])
        : null,
    required_hair_state:
      r.required_hair_state != null
        ? (String(r.required_hair_state) as HliPhotoProtocolSlot["required_hair_state"])
        : null,
    required_shave_state:
      r.required_shave_state != null
        ? (String(r.required_shave_state) as HliPhotoProtocolSlot["required_shave_state"])
        : null,
    sort_order: Number(r.sort_order ?? 0),
    is_required: Boolean(r.is_required),
    capture_guidance: r.capture_guidance != null ? String(r.capture_guidance) : null,
    quality_guidance: r.quality_guidance != null ? String(r.quality_guidance) : null,
  };
}

function mapSession(r: Record<string, unknown>): HliPhotoProtocolSession {
  const meta = r.metadata;
  return {
    id: String(r.id),
    source_system: String(r.source_system) as HliPhotoProtocolSession["source_system"],
    source_record_id: String(r.source_record_id),
    tenant_id: r.tenant_id != null ? String(r.tenant_id) : null,
    patient_id: r.patient_id != null ? String(r.patient_id) : null,
    case_id: r.case_id != null ? String(r.case_id) : null,
    protocol_template_id: String(r.protocol_template_id),
    status: String(r.status) as HliPhotoProtocolSession["status"],
    started_at: r.started_at != null ? String(r.started_at) : null,
    completed_at: r.completed_at != null ? String(r.completed_at) : null,
    created_by_user_id: r.created_by_user_id != null ? String(r.created_by_user_id) : null,
    metadata:
      meta && typeof meta === "object" && !Array.isArray(meta)
        ? (meta as Record<string, unknown>)
        : {},
    created_at: String(r.created_at),
    updated_at: String(r.updated_at),
  };
}

function mapSessionSlot(r: Record<string, unknown>): HliPhotoProtocolSessionSlot {
  return {
    id: String(r.id),
    session_id: String(r.session_id),
    slot_id: String(r.slot_id),
    patient_image_id: r.patient_image_id != null ? String(r.patient_image_id) : null,
    status: String(r.status) as HliPhotoProtocolSessionSlot["status"],
    ai_match_confidence:
      r.ai_match_confidence != null && r.ai_match_confidence !== ""
        ? Number(r.ai_match_confidence)
        : null,
    staff_note: r.staff_note != null ? String(r.staff_note) : null,
    reviewed_by_user_id: r.reviewed_by_user_id != null ? String(r.reviewed_by_user_id) : null,
    reviewed_at: r.reviewed_at != null ? String(r.reviewed_at) : null,
    created_at: String(r.created_at),
    updated_at: String(r.updated_at),
  };
}

function defaultDateFrom(): string {
  return new Date(Date.now() - DEFAULT_RANGE_DAYS * 86400000).toISOString();
}

async function loadFilteredSessions(
  tenantId: string,
  filters: PhotoProtocolAnalyticsFilters,
  statusOverride: HliPhotoProtocolSession["status"][] | null,
  client: SupabaseClient
): Promise<HliPhotoProtocolSession[]> {
  const tid = tenantId.trim();
  const dateFrom = filters.date_from?.trim() || defaultDateFrom();
  const dateTo = filters.date_to?.trim() || new Date().toISOString();

  let patientIdsForClinic: string[] | null = null;
  if (filters.clinic_id?.trim()) {
    const cid = filters.clinic_id.trim();
    const { data: pats, error } = await client
      .from("fi_patients")
      .select("id")
      .eq("tenant_id", tid)
      .eq("primary_clinic_id", cid);
    if (error) throw new Error(error.message);
    patientIdsForClinic = (pats ?? []).map((p) => String((p as { id: string }).id));
    if (patientIdsForClinic.length === 0) return [];
  }

  let q = client
    .from("hli_photo_protocol_sessions")
    .select("*")
    .eq("tenant_id", tid)
    .gte("created_at", dateFrom)
    .lte("created_at", dateTo)
    .order("created_at", { ascending: false })
    .limit(MAX_SESSIONS);

  if (filters.source_system?.trim()) {
    q = q.eq(
      "source_system",
      filters.source_system.trim() as HliPhotoProtocolSession["source_system"]
    );
  }

  if (filters.clinical_context?.trim()) {
    q = q.filter("metadata->>clinical_context", "eq", filters.clinical_context.trim());
  }

  if (patientIdsForClinic) {
    q = q.in("patient_id", patientIdsForClinic);
  }

  const st = filters.status?.trim();
  if (statusOverride) {
    q = q.in("status", statusOverride);
  } else if (st && st !== "all") {
    q = q.eq("status", st as HliPhotoProtocolSession["status"]);
  }

  const { data, error } = await q;
  if (error) throw new Error(error.message);
  return (data ?? []).map((row) => mapSession(row as Record<string, unknown>));
}

async function loadSessionSlotsForSessions(
  sessionIds: string[],
  client: SupabaseClient
): Promise<HliPhotoProtocolSessionSlot[]> {
  if (sessionIds.length === 0) return [];
  const out: HliPhotoProtocolSessionSlot[] = [];
  const chunk = 200;
  for (let i = 0; i < sessionIds.length; i += chunk) {
    const slice = sessionIds.slice(i, i + chunk);
    const { data, error } = await client
      .from("hli_photo_protocol_session_slots")
      .select("*")
      .in("session_id", slice);
    if (error) throw new Error(error.message);
    for (const row of data ?? []) out.push(mapSessionSlot(row as Record<string, unknown>));
  }
  return out;
}

async function loadTemplatesAndSlots(
  templateIds: string[],
  client: SupabaseClient
): Promise<{
  templatesById: Map<string, HliPhotoProtocolTemplate>;
  slotsByTemplateId: Map<string, HliPhotoProtocolSlot[]>;
}> {
  const templatesById = new Map<string, HliPhotoProtocolTemplate>();
  const slotsByTemplateId = new Map<string, HliPhotoProtocolSlot[]>();
  if (templateIds.length === 0) return { templatesById, slotsByTemplateId };

  const { data: tRows, error: tErr } = await client
    .from("hli_photo_protocol_templates")
    .select("*")
    .in("id", templateIds);
  if (tErr) throw new Error(tErr.message);
  for (const row of tRows ?? []) {
    const t = mapTemplate(row as Record<string, unknown>);
    templatesById.set(t.id, t);
  }

  const { data: sRows, error: sErr } = await client
    .from("hli_photo_protocol_slots")
    .select("*")
    .in("protocol_template_id", templateIds);
  if (sErr) throw new Error(sErr.message);
  for (const row of sRows ?? []) {
    const s = mapSlot(row as Record<string, unknown>);
    const list = slotsByTemplateId.get(s.protocol_template_id) ?? [];
    list.push(s);
    slotsByTemplateId.set(s.protocol_template_id, list);
  }
  for (const [, list] of slotsByTemplateId) {
    list.sort((a, b) => a.sort_order - b.sort_order);
  }

  return { templatesById, slotsByTemplateId };
}

async function loadPatientClinicAndNames(
  tenantId: string,
  patientIds: string[],
  client: SupabaseClient
): Promise<{ clinicByPatient: Map<string, string | null>; displayByPatient: Map<string, string> }> {
  const clinicByPatient = new Map<string, string | null>();
  const displayByPatient = new Map<string, string>();
  if (patientIds.length === 0) return { clinicByPatient, displayByPatient };

  const chunk = 150;
  for (let i = 0; i < patientIds.length; i += chunk) {
    const slice = patientIds.slice(i, i + chunk);
    const { data, error } = await client
      .from("fi_patients")
      .select("id, primary_clinic_id, person_id, metadata")
      .eq("tenant_id", tenantId.trim())
      .in("id", slice);
    if (error) throw new Error(error.message);
    const personIds = new Set<string>();
    const patientMetaById = new Map<string, Record<string, unknown>>();
    for (const row of data ?? []) {
      const r = row as {
        id: string;
        primary_clinic_id: string | null;
        person_id: string;
        metadata: unknown;
      };
      clinicByPatient.set(
        String(r.id),
        r.primary_clinic_id != null ? String(r.primary_clinic_id) : null
      );
      personIds.add(String(r.person_id));
      const pm =
        r.metadata && typeof r.metadata === "object" && !Array.isArray(r.metadata)
          ? (r.metadata as Record<string, unknown>)
          : {};
      patientMetaById.set(String(r.id), pm);
    }
    const pids = Array.from(personIds);
    const personMetaByPersonId = new Map<string, Record<string, unknown>>();
    if (pids.length > 0) {
      const { data: persons, error: pe } = await client
        .from("fi_persons")
        .select("id, metadata")
        .in("id", pids);
      if (pe) throw new Error(pe.message);
      for (const pr of persons ?? []) {
        const p = pr as { id: string; metadata: unknown };
        const meta =
          p.metadata && typeof p.metadata === "object" && !Array.isArray(p.metadata)
            ? (p.metadata as Record<string, unknown>)
            : {};
        personMetaByPersonId.set(String(p.id), meta);
      }
    }
    for (const row of data ?? []) {
      const r = row as { id: string; person_id: string };
      const id = String(r.id);
      const view = derivePatientIdentityContact({
        personMetadata: personMetaByPersonId.get(String(r.person_id)) ?? {},
        patientMetadata: patientMetaById.get(id) ?? {},
      });
      const label =
        (view.preferredDisplayName && view.preferredDisplayName.trim()) ||
        (view.fullName && view.fullName !== "—" ? view.fullName : null) ||
        `Patient ${id.slice(0, 8)}`;
      displayByPatient.set(id, label);
    }
  }
  return { clinicByPatient, displayByPatient };
}

type Dataset = {
  sessions: HliPhotoProtocolSession[];
  sessionSlots: HliPhotoProtocolSessionSlot[];
  templatesById: Map<string, HliPhotoProtocolTemplate>;
  slotsByTemplateId: Map<string, HliPhotoProtocolSlot[]>;
  patientPrimaryClinicByPatientId: Map<string, string | null>;
  patientDisplayByPatientId: Map<string, string>;
};

export async function loadPhotoProtocolDatasetForTenant(
  tenantId: string,
  filters: PhotoProtocolAnalyticsFilters,
  statusOverride: HliPhotoProtocolSession["status"][] | null,
  client?: SupabaseClient
): Promise<Dataset> {
  const supabase = client ?? supabaseAdmin();
  const sessions = await loadFilteredSessions(tenantId, filters, statusOverride, supabase);
  const sessionIds = sessions.map((s) => s.id);
  const sessionSlots = await loadSessionSlotsForSessions(sessionIds, supabase);
  const templateIds = [...new Set(sessions.map((s) => s.protocol_template_id))];
  const { templatesById, slotsByTemplateId } = await loadTemplatesAndSlots(templateIds, supabase);
  const patientIds = [
    ...new Set(sessions.map((s) => s.patient_id).filter((x): x is string => Boolean(x))),
  ];
  const { clinicByPatient, displayByPatient } = await loadPatientClinicAndNames(
    tenantId,
    patientIds,
    supabase
  );
  return {
    sessions,
    sessionSlots,
    templatesById,
    slotsByTemplateId,
    patientPrimaryClinicByPatientId: clinicByPatient,
    patientDisplayByPatientId: displayByPatient,
  };
}

export type PhotoProtocolAnalyticsForTenantResult = {
  tenant_id: string;
  summary: PhotoProtocolAnalyticsSummary;
  alerts: PhotoProtocolAlert[];
  scan_note: string | null;
};

export async function loadPhotoProtocolAnalyticsForTenant(
  tenantId: string,
  filters: PhotoProtocolAnalyticsFilters = {},
  client?: SupabaseClient
): Promise<PhotoProtocolAnalyticsForTenantResult> {
  const supabase = client ?? supabaseAdmin();
  const ds = await loadPhotoProtocolDatasetForTenant(tenantId, filters, null, supabase);
  const scan_note =
    ds.sessions.length >= MAX_SESSIONS
      ? `Session list capped at ${MAX_SESSIONS} rows for this tenant window — narrow date range for full accuracy.`
      : null;

  const summary = calculatePhotoProtocolAnalytics({
    sessions: ds.sessions,
    sessionSlots: ds.sessionSlots,
    templatesById: ds.templatesById,
    slotsByTemplateId: ds.slotsByTemplateId,
    patientPrimaryClinicByPatientId: ds.patientPrimaryClinicByPatientId,
  });

  const alerts = buildPhotoProtocolAlerts({
    sessions: ds.sessions,
    sessionSlots: ds.sessionSlots,
    slotsByTemplateId: ds.slotsByTemplateId,
  });

  return { tenant_id: tenantId.trim(), summary, alerts, scan_note };
}

export async function loadIncompletePhotoProtocolSessionsForTenant(
  tenantId: string,
  filters: PhotoProtocolAnalyticsFilters = {},
  client?: SupabaseClient
): Promise<PhotoProtocolIncompleteSessionRow[]> {
  const supabase = client ?? supabaseAdmin();
  const openStatuses: HliPhotoProtocolSession["status"][] = ["draft", "in_progress", "incomplete"];
  const mergedFilters = { ...filters, status: "all" as const };
  const ds = await loadPhotoProtocolDatasetForTenant(
    tenantId,
    mergedFilters,
    openStatuses,
    supabase
  );

  const slotsBySession = new Map<string, HliPhotoProtocolSessionSlot[]>();
  for (const ss of ds.sessionSlots) {
    const list = slotsBySession.get(ss.session_id) ?? [];
    list.push(ss);
    slotsBySession.set(ss.session_id, list);
  }

  const tid = tenantId.trim();
  const rows: PhotoProtocolIncompleteSessionRow[] = [];

  for (const session of ds.sessions) {
    if (!openStatuses.includes(session.status)) continue;
    const ssList = slotsBySession.get(session.id) ?? [];
    let missingReq = 0;
    for (const ss of ssList) {
      const def = requiredSlotDefinitionForSessionSlot(session, ss, ds.slotsByTemplateId);
      if (isRequiredSessionSlotMissing(ss, def)) missingReq += 1;
    }
    const template = ds.templatesById.get(session.protocol_template_id);
    const pid = session.patient_id;
    const display = pid
      ? (ds.patientDisplayByPatientId.get(pid) ?? `Patient ${pid.slice(0, 8)}`)
      : "Unknown patient";
    rows.push({
      session_id: session.id,
      patient_id: pid,
      patient_display: display,
      clinical_context: clinicalContextFromSession(session),
      protocol_name: template?.name ?? "Protocol",
      protocol_template_slug: template?.slug ?? session.protocol_template_id,
      missing_required_count: missingReq,
      status: session.status,
      started_at: session.started_at,
      patient_twin_href: pid
        ? `/fi-admin/${encodeURIComponent(tid)}/patients/${encodeURIComponent(pid)}/twin`
        : `/fi-admin/${encodeURIComponent(tid)}/patients`,
    });
  }

  rows.sort((a, b) => {
    const ta = a.started_at ? Date.parse(a.started_at) : 0;
    const tb = b.started_at ? Date.parse(b.started_at) : 0;
    return tb - ta;
  });

  return rows;
}

export async function loadPhotoProtocolAlertsForTenant(
  tenantId: string,
  filters: PhotoProtocolAnalyticsFilters = {},
  client?: SupabaseClient
): Promise<{ tenant_id: string; alerts: PhotoProtocolAlert[]; scan_note: string | null }> {
  const r = await loadPhotoProtocolAnalyticsForTenant(tenantId, filters, client);
  return { tenant_id: r.tenant_id, alerts: r.alerts, scan_note: r.scan_note };
}
