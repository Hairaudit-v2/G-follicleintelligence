import "server-only";

import { supabaseAdmin } from "@/lib/supabaseAdmin";

import { leadTitleFromRow } from "@/src/lib/crm/crmLeadListDisplay";
import { displayFromPersonMetadata } from "@/src/lib/patients/patientLabels";

import { resolveConsultationConsultantDisplayName } from "./consultationConsultantDisplay";
import { CONSULTATION_TYPE_DEFINITIONS } from "./consultationTypeConfig";
import type { ConsultationRow, ConsultationStatus, ConsultationTypeId } from "./consultationTypes";

/** Maps a `fi_consultations` select row to {@link ConsultationRow} (service-role reads). */
export function mapFiConsultationRow(raw: Record<string, unknown>): ConsultationRow {
  return {
    id: String(raw.id),
    tenant_id: String(raw.tenant_id),
    person_id: raw.person_id == null ? null : String(raw.person_id),
    patient_id: raw.patient_id == null ? null : String(raw.patient_id),
    lead_id: raw.lead_id == null ? null : String(raw.lead_id),
    case_id: raw.case_id == null ? null : String(raw.case_id),
    booking_id: raw.booking_id == null ? null : String(raw.booking_id),
    consultation_type: raw.consultation_type as ConsultationTypeId,
    status: raw.status as ConsultationStatus,
    consultant_name: raw.consultant_name == null ? null : String(raw.consultant_name),
    consultant_staff_id: raw.consultant_staff_id == null ? null : String(raw.consultant_staff_id),
    consultation_date: raw.consultation_date == null ? null : String(raw.consultation_date),
    structured_data: (raw.structured_data && typeof raw.structured_data === "object"
      ? (raw.structured_data as Record<string, unknown>)
      : {}) as Record<string, unknown>,
    live_notes: raw.live_notes == null ? null : String(raw.live_notes),
    recommendation_notes: raw.recommendation_notes == null ? null : String(raw.recommendation_notes),
    quote_data:
      raw.quote_data && typeof raw.quote_data === "object" ? (raw.quote_data as Record<string, unknown>) : {},
    created_by: raw.created_by == null ? null : String(raw.created_by),
    updated_by: raw.updated_by == null ? null : String(raw.updated_by),
    created_at: String(raw.created_at),
    updated_at: String(raw.updated_at),
    archived_at: raw.archived_at == null ? null : String(raw.archived_at),
  };
}

function readPatientMetadataLabel(metadata: unknown): string | null {
  if (!metadata || typeof metadata !== "object" || Array.isArray(metadata)) return null;
  const m = metadata as Record<string, unknown>;
  const dn = m.display_name;
  const pn = m.patient_name;
  if (typeof dn === "string" && dn.trim()) return dn.trim();
  if (typeof pn === "string" && pn.trim()) return pn.trim();
  return null;
}

function consultationTypeLabel(id: ConsultationTypeId): string {
  return CONSULTATION_TYPE_DEFINITIONS.find((d) => d.id === id)?.label ?? id;
}

export async function loadConsultationForTenant(
  tenantId: string,
  consultationId: string
): Promise<ConsultationRow | null> {
  const tid = tenantId.trim();
  const cid = consultationId.trim();
  if (!tid || !cid) return null;

  const supabase = supabaseAdmin();
  const { data, error } = await supabase
    .from("fi_consultations")
    .select("*")
    .eq("tenant_id", tid)
    .eq("id", cid)
    .maybeSingle();

  if (error) throw new Error(error.message);
  if (!data || typeof data !== "object") return null;
  // SA-2 field-level redaction (follow-up): redact clinical_notes / diagnosis / quote / consent /
  // private_practitioner_notes for the current viewer via
  // `redactConsultationForStaffAccess(tenantId, row)` from
  // `@/src/lib/staffAccess/staffFieldAccess.server` before rendering the consultation detail.
  // Apply at the consultation detail page/section boundary so masked/summary placeholders don't
  // reach typed consumers. Field access is clamped to ConsultationOS module access by the engine.
  return mapFiConsultationRow(data as Record<string, unknown>);
}

export type ListConsultationsOptions = {
  limit?: number;
  offset?: number;
  status?: ConsultationStatus;
  /** When set, filters to any of these statuses (takes precedence over `status`). */
  statusIn?: ConsultationStatus[];
};

/** Worklist row: base consultation + resolved subject line for the index UI. */
export type ConsultationIndexRow = ConsultationRow & {
  consultation_type_label: string;
  subject_line: string;
  patient_display_name: string | null;
  lead_display_name: string | null;
  link_headline: string;
  consultant_display_name: string | null;
};

export type ConsultationWorkspaceDisplay = {
  patientName: string | null;
  leadName: string | null;
  leadStage: string | null;
};

/** Labels for linked patient / CRM lead on the consultation workspace shell. */
export async function loadConsultationWorkspaceDisplay(
  tenantId: string,
  row: ConsultationRow
): Promise<ConsultationWorkspaceDisplay> {
  const tid = tenantId.trim();
  const supabase = supabaseAdmin();

  let patientName: string | null = null;
  if (row.patient_id?.trim()) {
    const { data, error } = await supabase
      .from("fi_patients")
      .select("metadata")
      .eq("tenant_id", tid)
      .eq("id", row.patient_id.trim())
      .maybeSingle();
    if (error) throw new Error(error.message);
    const lab = data ? readPatientMetadataLabel((data as { metadata: unknown }).metadata) : null;
    patientName = lab ?? `Patient ${row.patient_id.trim().slice(0, 8)}…`;
  }

  let leadName: string | null = null;
  let leadStage: string | null = null;
  if (row.lead_id?.trim()) {
    const lid = row.lead_id.trim();
    const { data, error } = await supabase
      .from("fi_crm_leads")
      .select("id, summary, current_stage_id")
      .eq("tenant_id", tid)
      .eq("id", lid)
      .maybeSingle();
    if (error) throw new Error(error.message);
    if (data) {
      const lr = data as { id: string; summary: string | null; current_stage_id: string | null };
      leadName = leadTitleFromRow(lr.summary, lr.id);
      if (lr.current_stage_id?.trim()) {
        const { data: st, error: se } = await supabase
          .from("fi_crm_pipeline_stages")
          .select("label")
          .eq("tenant_id", tid)
          .eq("id", lr.current_stage_id.trim())
          .maybeSingle();
        if (!se && st) {
          leadStage = String((st as { label: string | null }).label ?? "").trim() || null;
        }
      }
    }
  }

  return { patientName, leadName, leadStage };
}

async function resolveConsultationSubjectLines(
  tenantId: string,
  rows: ConsultationRow[]
): Promise<Map<string, string>> {
  const out = new Map<string, string>();
  if (rows.length === 0) return out;

  const supabase = supabaseAdmin();
  const patientIds = new Set<string>();
  const personOnlyIds = new Set<string>();
  for (const r of rows) {
    if (r.patient_id?.trim()) patientIds.add(r.patient_id.trim());
    else if (r.person_id?.trim()) personOnlyIds.add(r.person_id.trim());
  }

  const patientLabelById = new Map<string, string>();
  if (patientIds.size > 0) {
    const { data: pats, error: pe } = await supabase
      .from("fi_patients")
      .select("id, metadata")
      .eq("tenant_id", tenantId)
      .in("id", Array.from(patientIds));
    if (pe) throw new Error(pe.message);
    for (const raw of pats ?? []) {
      const pr = raw as { id: string; metadata: unknown };
      const lab = readPatientMetadataLabel(pr.metadata);
      if (lab) patientLabelById.set(String(pr.id), lab);
    }
  }

  const personLabelById = new Map<string, string>();
  const personIdsToLoad = new Set(Array.from(personOnlyIds));
  for (const r of rows) {
    if (r.patient_id?.trim() && r.person_id?.trim()) {
      /* person linked via patient — fetch if patient label missing */
      if (!patientLabelById.has(r.patient_id.trim())) personIdsToLoad.add(r.person_id.trim());
    }
  }
  if (personIdsToLoad.size > 0) {
    const { data: persons, error: perE } = await supabase
      .from("fi_persons")
      .select("id, metadata")
      .eq("tenant_id", tenantId)
      .in("id", Array.from(personIdsToLoad));
    if (perE) throw new Error(perE.message);
    for (const raw of persons ?? []) {
      const pr = raw as { id: string; metadata: unknown };
      const meta =
        pr.metadata && typeof pr.metadata === "object" && !Array.isArray(pr.metadata)
          ? (pr.metadata as Record<string, unknown>)
          : {};
      const { name } = displayFromPersonMetadata(meta);
      if (name && name !== "—") personLabelById.set(String(pr.id), name);
    }
  }

  for (const r of rows) {
    const pid = r.patient_id?.trim();
    const perId = r.person_id?.trim();
    if (pid) {
      const fromPatient = patientLabelById.get(pid);
      if (fromPatient) {
        out.set(r.id, fromPatient);
        continue;
      }
      if (perId) {
        const fromPerson = personLabelById.get(perId);
        if (fromPerson) {
          out.set(r.id, fromPerson);
          continue;
        }
      }
      out.set(r.id, `Patient ${pid.slice(0, 8)}…`);
      continue;
    }
    if (perId) {
      const fromPerson = personLabelById.get(perId);
      if (fromPerson) {
        out.set(r.id, fromPerson);
        continue;
      }
      out.set(r.id, `Person ${perId.slice(0, 8)}…`);
      continue;
    }
    out.set(r.id, "Unlinked consultation");
  }

  return out;
}

async function resolveConsultationLinkIndexMaps(
  tenantId: string,
  rows: ConsultationRow[]
): Promise<{ patientLabelById: Map<string, string>; leadTitleById: Map<string, string> }> {
  const patientLabelById = new Map<string, string>();
  const leadTitleById = new Map<string, string>();
  const tid = tenantId.trim();
  if (!tid || rows.length === 0) return { patientLabelById, leadTitleById };

  const patientIds = new Set<string>();
  const leadIds = new Set<string>();
  for (const r of rows) {
    if (r.patient_id?.trim()) patientIds.add(r.patient_id.trim());
    if (r.lead_id?.trim()) leadIds.add(r.lead_id.trim());
  }

  const supabase = supabaseAdmin();
  if (patientIds.size > 0) {
    const { data: pats, error: pe } = await supabase
      .from("fi_patients")
      .select("id, metadata")
      .eq("tenant_id", tid)
      .in("id", Array.from(patientIds));
    if (pe) throw new Error(pe.message);
    for (const raw of pats ?? []) {
      const pr = raw as { id: string; metadata: unknown };
      const lab = readPatientMetadataLabel(pr.metadata);
      if (lab) patientLabelById.set(String(pr.id), lab);
    }
  }

  if (leadIds.size > 0) {
    const { data: leads, error: le } = await supabase
      .from("fi_crm_leads")
      .select("id, summary")
      .eq("tenant_id", tid)
      .in("id", Array.from(leadIds));
    if (le) throw new Error(le.message);
    for (const raw of leads ?? []) {
      const lr = raw as { id: string; summary: string | null };
      leadTitleById.set(String(lr.id), leadTitleFromRow(lr.summary, String(lr.id)));
    }
  }

  return { patientLabelById, leadTitleById };
}

async function resolveConsultantStaffNameById(
  tenantId: string,
  rows: ConsultationRow[]
): Promise<Map<string, string>> {
  const out = new Map<string, string>();
  const staffIds = new Set<string>();
  for (const r of rows) {
    if (r.consultant_staff_id?.trim()) staffIds.add(r.consultant_staff_id.trim());
  }
  if (staffIds.size === 0) return out;

  const supabase = supabaseAdmin();
  const { data, error } = await supabase
    .from("fi_staff")
    .select("id, full_name, email")
    .eq("tenant_id", tenantId.trim())
    .in("id", Array.from(staffIds));
  if (error) throw new Error(error.message);
  for (const raw of data ?? []) {
    const r = raw as { id: string; full_name: string | null; email: string | null };
    const label = String(r.full_name ?? "").trim() || String(r.email ?? "").trim();
    if (label) out.set(String(r.id), label);
  }
  return out;
}

function mapConsultationIndexRow(
  r: ConsultationRow,
  subjectById: Map<string, string>,
  patientLabelById: Map<string, string>,
  leadTitleById: Map<string, string>,
  consultantStaffNameById: Map<string, string>
): ConsultationIndexRow {
  const patient_display_name = r.patient_id?.trim()
    ? patientLabelById.get(r.patient_id.trim()) ?? `Patient ${r.patient_id.trim().slice(0, 8)}…`
    : null;
  const lead_display_name = r.lead_id?.trim()
    ? leadTitleById.get(r.lead_id.trim()) ?? `Lead ${r.lead_id.trim().slice(0, 8)}…`
    : null;
  const link_headline = patient_display_name ?? lead_display_name ?? "Unlinked";
  const linkedStaffName = r.consultant_staff_id?.trim()
    ? consultantStaffNameById.get(r.consultant_staff_id.trim()) ?? null
    : null;
  return {
    ...r,
    consultation_type_label: consultationTypeLabel(r.consultation_type),
    subject_line: subjectById.get(r.id) ?? link_headline,
    patient_display_name,
    lead_display_name,
    link_headline,
    consultant_display_name: resolveConsultationConsultantDisplayName({
      consultant_staff_id: r.consultant_staff_id,
      consultant_name: r.consultant_name,
      linkedStaffName,
    }),
  };
}

/** Consultations linked to a foundation patient (or same person when patient_id unset). */
export async function loadConsultationsForPatient(
  tenantId: string,
  patientId: string,
  personId: string,
  limit = 40
): Promise<ConsultationIndexRow[]> {
  const tid = tenantId.trim();
  const pid = patientId.trim();
  const perId = personId.trim();
  if (!tid || !pid) return [];

  const supabase = supabaseAdmin();
  const { data, error } = await supabase
    .from("fi_consultations")
    .select("*")
    .eq("tenant_id", tid)
    .or(`patient_id.eq.${pid},person_id.eq.${perId}`)
    .order("updated_at", { ascending: false })
    .limit(Math.min(limit, 100));
  if (error) throw new Error(error.message);
  if (!Array.isArray(data)) return [];

  const rows = data.map((row) => mapFiConsultationRow(row as Record<string, unknown>));
  const subjectById = await resolveConsultationSubjectLines(tid, rows);
  const { patientLabelById, leadTitleById } = await resolveConsultationLinkIndexMaps(tid, rows);
  const consultantStaffNameById = await resolveConsultantStaffNameById(tid, rows);
  return rows.map((r) =>
    mapConsultationIndexRow(r, subjectById, patientLabelById, leadTitleById, consultantStaffNameById)
  );
}

export async function listConsultationsForTenant(
  tenantId: string,
  options: ListConsultationsOptions = {}
): Promise<ConsultationIndexRow[]> {
  const tid = tenantId.trim();
  if (!tid) return [];

  const limit = Math.min(Math.max(options.limit ?? 50, 1), 200);
  const offset = Math.max(options.offset ?? 0, 0);

  const supabase = supabaseAdmin();
  let q = supabase.from("fi_consultations").select("*").eq("tenant_id", tid).order("updated_at", { ascending: false });

  if (options.statusIn?.length) {
    q = q.in("status", options.statusIn);
  } else if (options.status) {
    q = q.eq("status", options.status);
  }

  const { data, error } = await q.range(offset, offset + limit - 1);
  if (error) throw new Error(error.message);
  if (!Array.isArray(data)) return [];
  const rows = data.map((row) => mapFiConsultationRow(row as Record<string, unknown>));
  const subjectById = await resolveConsultationSubjectLines(tid, rows);
  const { patientLabelById, leadTitleById } = await resolveConsultationLinkIndexMaps(tid, rows);
  const consultantStaffNameById = await resolveConsultantStaffNameById(tid, rows);
  return rows.map((r) =>
    mapConsultationIndexRow(r, subjectById, patientLabelById, leadTitleById, consultantStaffNameById)
  );
}
