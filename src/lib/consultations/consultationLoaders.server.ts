import "server-only";

import { supabaseAdmin } from "@/lib/supabaseAdmin";

import { displayFromPersonMetadata } from "@/src/lib/patients/patientLabels";

import { CONSULTATION_TYPE_DEFINITIONS } from "./consultationTypeConfig";
import type { ConsultationRow, ConsultationStatus, ConsultationTypeId } from "./consultationTypes";

function mapRow(raw: Record<string, unknown>): ConsultationRow {
  return {
    id: String(raw.id),
    tenant_id: String(raw.tenant_id),
    person_id: raw.person_id == null ? null : String(raw.person_id),
    patient_id: raw.patient_id == null ? null : String(raw.patient_id),
    lead_id: raw.lead_id == null ? null : String(raw.lead_id),
    case_id: raw.case_id == null ? null : String(raw.case_id),
    consultation_type: raw.consultation_type as ConsultationTypeId,
    status: raw.status as ConsultationStatus,
    consultant_name: raw.consultant_name == null ? null : String(raw.consultant_name),
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
  return mapRow(data as Record<string, unknown>);
}

export type ListConsultationsOptions = {
  limit?: number;
  offset?: number;
  status?: ConsultationStatus;
};

/** Worklist row: base consultation + resolved subject line for the index UI. */
export type ConsultationIndexRow = ConsultationRow & {
  consultation_type_label: string;
  subject_line: string;
};

function consultationTypeLabel(id: ConsultationTypeId): string {
  return CONSULTATION_TYPE_DEFINITIONS.find((d) => d.id === id)?.label ?? id;
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

  if (options.status) {
    q = q.eq("status", options.status);
  }

  const { data, error } = await q.range(offset, offset + limit - 1);
  if (error) throw new Error(error.message);
  if (!Array.isArray(data)) return [];
  const rows = data.map((row) => mapRow(row as Record<string, unknown>));
  const subjectById = await resolveConsultationSubjectLines(tid, rows);
  return rows.map((r) => ({
    ...r,
    consultation_type_label: consultationTypeLabel(r.consultation_type),
    subject_line: subjectById.get(r.id) ?? "Unlinked consultation",
  }));
}
