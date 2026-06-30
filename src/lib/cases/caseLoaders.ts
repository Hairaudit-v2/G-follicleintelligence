import "server-only";

import type { SupabaseClient } from "@supabase/supabase-js";
import { supabaseAdmin } from "@/lib/supabaseAdmin";
import { leadTitleFromRow } from "@/src/lib/crm/crmLeadListDisplay";
import { casePersonDisplayFromMetadata } from "@/src/lib/cases/caseLabels";
import { assertNonEmptyUuid } from "@/src/lib/crm/validation";

function asObj(v: unknown): Record<string, unknown> {
  return v && typeof v === "object" && !Array.isArray(v) ? (v as Record<string, unknown>) : {};
}

function caseTypeFromMetadata(metadata: Record<string, unknown>): string | null {
  const ct = metadata.case_type;
  const et = metadata.event_type;
  if (typeof ct === "string" && ct.trim()) return ct.trim();
  if (typeof et === "string" && et.trim()) return et.trim();
  return null;
}

export type CaseIndexRow = {
  id: string;
  status: string;
  treatment_type: string | null;
  case_type: string | null;
  external_id: string | null;
  foundation_patient_id: string | null;
  legacy_patient_id: string | null;
  person_label: string;
  person_email: string | null;
  lead: { id: string; title: string } | null;
  created_at: string;
  updated_at: string;
};

export type CaseBookingListItem = {
  id: string;
  booking_type: string;
  booking_status: string;
  title: string | null;
  start_at: string;
  end_at: string;
};

export type CaseImageListItem = {
  id: string;
  image_category: string;
  image_status: string;
  caption: string | null;
  storage_path: string;
  created_at: string;
};

export type CaseLeadLink = {
  id: string;
  title: string;
  link_reason: "case_id" | "converted_case_id";
  status: string;
};

export type CasePatientLink = {
  foundation_patient_id: string;
  person_id: string;
  person_label: string;
  person_email: string | null;
};

export type CaseAdminDetail = {
  id: string;
  tenant_id: string;
  status: string;
  treatment_type: string | null;
  case_type: string | null;
  planning_notes: string | null;
  external_id: string | null;
  foundation_patient_id: string | null;
  legacy_patient_id: string | null;
  clinic_id: string | null;
  organisation_id: string | null;
  partner_id: string | null;
  metadata: Record<string, unknown>;
  created_at: string;
  updated_at: string;
  patient: CasePatientLink | null;
  leads: CaseLeadLink[];
  bookings: CaseBookingListItem[];
  images: CaseImageListItem[];
};

export async function loadCasesIndexForTenant(
  tenantId: string,
  client?: SupabaseClient
): Promise<CaseIndexRow[]> {
  const supabase = client ?? supabaseAdmin();
  const tid = tenantId.trim();

  const { data: caseRows, error } = await supabase
    .from("fi_cases")
    .select(
      "id, status, metadata, external_id, foundation_patient_id, patient_id, treatment_type, planning_notes, created_at, updated_at"
    )
    .eq("tenant_id", tid)
    .is("deleted_at", null)
    .order("updated_at", { ascending: false })
    .limit(500);
  if (error) throw new Error(error.message);

  const rows = caseRows ?? [];
  if (rows.length === 0) return [];

  const caseIds = rows.map((r) => String((r as { id: string }).id));
  const foundationIds = uniqueIds(
    rows.map((r) => (r as { foundation_patient_id: string | null }).foundation_patient_id)
  );
  const legacyIds = uniqueIds(rows.map((r) => (r as { patient_id: string | null }).patient_id));

  const patientPersonByFoundation = await loadPatientPersonMap(supabase, tid, foundationIds);
  const patientPersonByLegacy = await loadPatientPersonMapByLegacyPatientId(
    supabase,
    tid,
    legacyIds
  );

  const leadByCase = await loadPrimaryLeadLabelsForCases(supabase, tid, caseIds);

  return rows.map((raw) => {
    const r = raw as Record<string, unknown>;
    const id = String(r.id);
    const meta = asObj(r.metadata);
    const fp = r.foundation_patient_id != null ? String(r.foundation_patient_id) : null;
    const leg = r.patient_id != null ? String(r.patient_id) : null;
    const treatment = r.treatment_type != null ? String(r.treatment_type) : null;
    const ct = caseTypeFromMetadata(meta);

    let person_label = "—";
    let person_email: string | null = null;
    if (fp && patientPersonByFoundation.has(fp)) {
      const p = patientPersonByFoundation.get(fp)!;
      person_label = p.label;
      person_email = p.email;
    } else if (leg && patientPersonByLegacy.has(leg)) {
      const p = patientPersonByLegacy.get(leg)!;
      person_label = p.label;
      person_email = p.email;
    }

    return {
      id,
      status: String(r.status ?? ""),
      treatment_type: treatment?.trim() ? treatment.trim() : null,
      case_type: ct,
      external_id: r.external_id != null ? String(r.external_id) : null,
      foundation_patient_id: fp,
      legacy_patient_id: leg,
      person_label,
      person_email,
      lead: leadByCase.get(id) ?? null,
      created_at: String(r.created_at ?? ""),
      updated_at: String(r.updated_at ?? ""),
    };
  });
}

/**
 * Same shape as {@link loadCasesIndexForTenant} but restricted to explicit case ids (Surgery readiness board, etc.).
 */
export async function loadCasesIndexRowsForIds(
  tenantId: string,
  caseIds: string[],
  client?: SupabaseClient
): Promise<CaseIndexRow[]> {
  const supabase = client ?? supabaseAdmin();
  const tid = tenantId.trim();
  const ids = Array.from(new Set(caseIds.map((id) => id.trim()).filter(Boolean)));
  if (ids.length === 0) return [];

  const { data: caseRows, error } = await supabase
    .from("fi_cases")
    .select(
      "id, status, metadata, external_id, foundation_patient_id, patient_id, treatment_type, planning_notes, created_at, updated_at"
    )
    .eq("tenant_id", tid)
    .is("deleted_at", null)
    .in("id", ids);
  if (error) throw new Error(error.message);

  const rows = caseRows ?? [];
  if (rows.length === 0) return [];

  const rowCaseIds = rows.map((r) => String((r as { id: string }).id));
  const foundationIds = uniqueIds(
    rows.map((r) => (r as { foundation_patient_id: string | null }).foundation_patient_id)
  );
  const legacyIds = uniqueIds(rows.map((r) => (r as { patient_id: string | null }).patient_id));

  const patientPersonByFoundation = await loadPatientPersonMap(supabase, tid, foundationIds);
  const patientPersonByLegacy = await loadPatientPersonMapByLegacyPatientId(
    supabase,
    tid,
    legacyIds
  );

  const leadByCase = await loadPrimaryLeadLabelsForCases(supabase, tid, rowCaseIds);

  return rows.map((raw) => {
    const r = raw as Record<string, unknown>;
    const id = String(r.id);
    const meta = asObj(r.metadata);
    const fp = r.foundation_patient_id != null ? String(r.foundation_patient_id) : null;
    const leg = r.patient_id != null ? String(r.patient_id) : null;
    const treatment = r.treatment_type != null ? String(r.treatment_type) : null;
    const ct = caseTypeFromMetadata(meta);

    let person_label = "—";
    let person_email: string | null = null;
    if (fp && patientPersonByFoundation.has(fp)) {
      const p = patientPersonByFoundation.get(fp)!;
      person_label = p.label;
      person_email = p.email;
    } else if (leg && patientPersonByLegacy.has(leg)) {
      const p = patientPersonByLegacy.get(leg)!;
      person_label = p.label;
      person_email = p.email;
    }

    return {
      id,
      status: String(r.status ?? ""),
      treatment_type: treatment?.trim() ? treatment.trim() : null,
      case_type: ct,
      external_id: r.external_id != null ? String(r.external_id) : null,
      foundation_patient_id: fp,
      legacy_patient_id: leg,
      person_label,
      person_email,
      lead: leadByCase.get(id) ?? null,
      created_at: String(r.created_at ?? ""),
      updated_at: String(r.updated_at ?? ""),
    };
  });
}

export async function loadCaseAdminDetail(
  tenantId: string,
  caseId: string,
  client?: SupabaseClient
): Promise<CaseAdminDetail | null> {
  const supabase = client ?? supabaseAdmin();
  const tid = assertNonEmptyUuid(tenantId, "tenantId");
  const cid = assertNonEmptyUuid(caseId, "caseId");

  const { data: c, error } = await supabase
    .from("fi_cases")
    .select(
      "id, tenant_id, status, metadata, external_id, foundation_patient_id, patient_id, treatment_type, planning_notes, clinic_id, organisation_id, partner_id, created_at, updated_at"
    )
    .eq("tenant_id", tid)
    .eq("id", cid)
    .is("deleted_at", null)
    .maybeSingle();
  if (error) throw new Error(error.message);
  if (!c) return null;

  const row = c as Record<string, unknown>;
  const meta = asObj(row.metadata);
  const foundationPatientId =
    row.foundation_patient_id != null ? String(row.foundation_patient_id) : null;
  const legacyPatientId = row.patient_id != null ? String(row.patient_id) : null;

  let patient: CasePatientLink | null = null;
  const patientIdForPerson = foundationPatientId ?? legacyPatientId;
  if (patientIdForPerson) {
    const { data: pat, error: pe } = await supabase
      .from("fi_patients")
      .select("id, person_id")
      .eq("tenant_id", tid)
      .eq("id", patientIdForPerson)
      .maybeSingle();
    if (pe) throw new Error(pe.message);
    if (pat?.person_id) {
      const personId = String((pat as { person_id: string }).person_id);
      const { data: person, error: perr } = await supabase
        .from("fi_persons")
        .select("id, metadata")
        .eq("tenant_id", tid)
        .eq("id", personId)
        .maybeSingle();
      if (perr) throw new Error(perr.message);
      const pm = asObj((person as { metadata?: unknown } | null)?.metadata);
      const disp = casePersonDisplayFromMetadata(pm);
      patient = {
        foundation_patient_id: String((pat as { id: string }).id),
        person_id: personId,
        person_label: disp.label,
        person_email: disp.email,
      };
    }
  }

  const { data: leadRows, error: le } = await supabase
    .from("fi_crm_leads")
    .select("id, summary, status, case_id, converted_case_id")
    .eq("tenant_id", tid)
    .or(`case_id.eq.${cid},converted_case_id.eq.${cid}`);
  if (le) throw new Error(le.message);

  const leads: CaseLeadLink[] = (leadRows ?? []).map((lr) => {
    const L = lr as {
      id: string;
      summary: string | null;
      status: string;
      case_id: string | null;
      converted_case_id: string | null;
    };
    const link_reason: CaseLeadLink["link_reason"] =
      L.case_id && String(L.case_id) === cid ? "case_id" : "converted_case_id";
    return {
      id: String(L.id),
      title: leadTitleFromRow(L.summary, String(L.id)),
      link_reason,
      status: String(L.status ?? ""),
    };
  });

  const { data: bookRows, error: be } = await supabase
    .from("fi_bookings")
    .select("id, booking_type, booking_status, title, start_at, end_at")
    .eq("tenant_id", tid)
    .eq("case_id", cid)
    .order("start_at", { ascending: true });
  if (be) throw new Error(be.message);

  const bookings: CaseBookingListItem[] = (bookRows ?? []).map((b) => {
    const B = b as Record<string, unknown>;
    return {
      id: String(B.id),
      booking_type: String(B.booking_type ?? ""),
      booking_status: String(B.booking_status ?? ""),
      title: B.title != null ? String(B.title) : null,
      start_at: String(B.start_at ?? ""),
      end_at: String(B.end_at ?? ""),
    };
  });

  const { data: imgRows, error: ie } = await supabase
    .from("fi_patient_images")
    .select("id, image_category, image_status, caption, storage_path, created_at")
    .eq("tenant_id", tid)
    .eq("case_id", cid)
    .order("created_at", { ascending: false })
    .limit(200);
  if (ie) throw new Error(ie.message);

  const images: CaseImageListItem[] = (imgRows ?? []).map((im) => {
    const I = im as Record<string, unknown>;
    return {
      id: String(I.id),
      image_category: String(I.image_category ?? ""),
      image_status: String(I.image_status ?? ""),
      caption: I.caption != null ? String(I.caption) : null,
      storage_path: String(I.storage_path ?? ""),
      created_at: String(I.created_at ?? ""),
    };
  });

  return {
    id: String(row.id),
    tenant_id: String(row.tenant_id),
    status: String(row.status ?? ""),
    treatment_type: row.treatment_type != null ? String(row.treatment_type) : null,
    case_type: caseTypeFromMetadata(meta),
    planning_notes: row.planning_notes != null ? String(row.planning_notes) : null,
    external_id: row.external_id != null ? String(row.external_id) : null,
    foundation_patient_id: foundationPatientId,
    legacy_patient_id: legacyPatientId,
    clinic_id: row.clinic_id != null ? String(row.clinic_id) : null,
    organisation_id: row.organisation_id != null ? String(row.organisation_id) : null,
    partner_id: row.partner_id != null ? String(row.partner_id) : null,
    metadata: meta,
    created_at: String(row.created_at ?? ""),
    updated_at: String(row.updated_at ?? ""),
    patient,
    leads,
    bookings,
    images,
  };
}

function uniqueIds(ids: Array<string | null | undefined>): string[] {
  const s = new Set<string>();
  for (const id of ids) {
    if (id && typeof id === "string" && id.trim()) s.add(id.trim());
  }
  return Array.from(s);
}

async function loadPatientPersonMap(
  supabase: SupabaseClient,
  tenantId: string,
  foundationPatientIds: string[]
): Promise<Map<string, { label: string; email: string | null }>> {
  const out = new Map<string, { label: string; email: string | null }>();
  if (foundationPatientIds.length === 0) return out;

  const { data: pats, error } = await supabase
    .from("fi_patients")
    .select("id, person_id")
    .eq("tenant_id", tenantId)
    .in("id", foundationPatientIds);
  if (error) throw new Error(error.message);

  const personIds = uniqueIds((pats ?? []).map((p) => (p as { person_id: string }).person_id));
  if (personIds.length === 0) return out;

  const { data: persons, error: pe } = await supabase
    .from("fi_persons")
    .select("id, metadata")
    .eq("tenant_id", tenantId)
    .in("id", personIds);
  if (pe) throw new Error(pe.message);

  const personMeta = new Map<string, Record<string, unknown>>();
  for (const row of persons ?? []) {
    personMeta.set(
      String((row as { id: string }).id),
      asObj((row as { metadata: unknown }).metadata)
    );
  }

  for (const pr of pats ?? []) {
    const pid = String((pr as { id: string }).id);
    const personId = String((pr as { person_id: string }).person_id);
    const meta = personMeta.get(personId) ?? {};
    const disp = casePersonDisplayFromMetadata(meta);
    out.set(pid, { label: disp.label, email: disp.email });
  }
  return out;
}

/** Legacy `fi_cases.patient_id` may reference `fi_patients.id` in some tenants. */
async function loadPatientPersonMapByLegacyPatientId(
  supabase: SupabaseClient,
  tenantId: string,
  legacyPatientIds: string[]
): Promise<Map<string, { label: string; email: string | null }>> {
  return loadPatientPersonMap(supabase, tenantId, legacyPatientIds);
}

async function loadPrimaryLeadLabelsForCases(
  supabase: SupabaseClient,
  tenantId: string,
  caseIds: string[]
): Promise<Map<string, { id: string; title: string }>> {
  const out = new Map<string, { id: string; title: string }>();
  if (caseIds.length === 0) return out;

  const [{ data: byCaseId }, { data: byConverted }] = await Promise.all([
    supabase
      .from("fi_crm_leads")
      .select("id, summary, case_id")
      .eq("tenant_id", tenantId)
      .in("case_id", caseIds),
    supabase
      .from("fi_crm_leads")
      .select("id, summary, converted_case_id")
      .eq("tenant_id", tenantId)
      .in("converted_case_id", caseIds),
  ]);

  const attach = (caseId: string | null | undefined, id: string, title: string) => {
    if (!caseId || !caseIds.includes(caseId)) return;
    if (!out.has(caseId)) out.set(caseId, { id, title });
  };

  for (const row of byCaseId ?? []) {
    const L = row as { id: string; summary: string | null; case_id: string | null };
    attach(
      L.case_id != null ? String(L.case_id) : null,
      String(L.id),
      leadTitleFromRow(L.summary, String(L.id))
    );
  }
  for (const row of byConverted ?? []) {
    const L = row as { id: string; summary: string | null; converted_case_id: string | null };
    attach(
      L.converted_case_id != null ? String(L.converted_case_id) : null,
      String(L.id),
      leadTitleFromRow(L.summary, String(L.id))
    );
  }

  return out;
}
