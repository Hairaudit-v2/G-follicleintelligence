import "server-only";

import type { SupabaseClient } from "@supabase/supabase-js";
import { supabaseAdmin } from "@/lib/supabaseAdmin";
import { derivePatientIdentityContact } from "@/src/lib/patients/patientIdentityContact";
import {
  pickBestPathologyPatientMatch,
  type PathologyExtractedPatientHints,
  type PathologyPatientMatchCandidate,
  type PathologyPatientMatchScore,
} from "@/src/lib/pathology/pathologyPatientMatchCore";

function readMrnFromMetadata(meta: Record<string, unknown>): string | null {
  const direct = meta.mrn ?? meta.MRN;
  if (typeof direct === "string" && direct.trim()) return direct.trim();
  const hub = meta.hubspot;
  if (hub && typeof hub === "object" && !Array.isArray(hub)) {
    const h = hub as Record<string, unknown>;
    const m = h.mrn ?? h.medical_record_number;
    if (typeof m === "string" && m.trim()) return m.trim();
  }
  return null;
}

export async function loadPathologyPatientMatchCandidates(
  tenantId: string,
  client?: SupabaseClient
): Promise<PathologyPatientMatchCandidate[]> {
  const supabase = client ?? supabaseAdmin();
  const tid = tenantId.trim();

  const { data: patients, error } = await supabase
    .from("fi_patients")
    .select("id, person_id, metadata")
    .eq("tenant_id", tid);
  if (error) throw new Error(error.message);
  if (!patients?.length) return [];

  const personIds = [
    ...new Set(
      patients.map((row) => String((row as { person_id: string }).person_id)).filter(Boolean)
    ),
  ];
  const personMeta = new Map<string, Record<string, unknown>>();
  if (personIds.length) {
    const { data: persons, error: pe } = await supabase
      .from("fi_persons")
      .select("id, metadata")
      .eq("tenant_id", tid)
      .in("id", personIds);
    if (pe) throw new Error(pe.message);
    for (const row of persons ?? []) {
      const id = String((row as { id: string }).id);
      const m = (row as { metadata: unknown }).metadata;
      personMeta.set(
        id,
        m && typeof m === "object" && !Array.isArray(m) ? (m as Record<string, unknown>) : {}
      );
    }
  }

  const out: PathologyPatientMatchCandidate[] = [];
  for (const raw of patients) {
    const row = raw as { id: string; person_id: string; metadata: unknown };
    const patientMeta =
      row.metadata && typeof row.metadata === "object" && !Array.isArray(row.metadata)
        ? (row.metadata as Record<string, unknown>)
        : {};
    const identity = derivePatientIdentityContact({
      personMetadata: personMeta.get(String(row.person_id)) ?? {},
      patientMetadata: patientMeta,
    });
    out.push({
      patientId: String(row.id),
      fullName: identity.fullName === "—" ? "" : identity.fullName,
      dateOfBirth: identity.dateOfBirth,
      primaryEmail: identity.primaryEmail,
      mrn: readMrnFromMetadata({ ...patientMeta, ...personMeta.get(String(row.person_id)) }),
    });
  }
  return out;
}

export async function suggestPathologyPatientMatch(
  tenantId: string,
  extracted: PathologyExtractedPatientHints,
  client?: SupabaseClient
): Promise<PathologyPatientMatchScore | null> {
  const candidates = await loadPathologyPatientMatchCandidates(tenantId, client);
  return pickBestPathologyPatientMatch(extracted, candidates);
}
