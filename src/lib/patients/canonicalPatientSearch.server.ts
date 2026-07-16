import "server-only";

import type { SupabaseClient } from "@supabase/supabase-js";
import { supabaseAdmin } from "@/lib/supabaseAdmin";
import { derivePatientIdentityContact } from "@/src/lib/patients/patientIdentityContact";
import {
  buildFiPersonsMetadataSearchOrFilter,
  patientDirectorySearchIlikePattern,
} from "@/src/lib/patients/patientDirectorySearch";
import { isSmokeOrTestPatientIdentity } from "@/src/lib/patients/patientSmokeIdentity";
import {
  assertOrdinaryPatientSearchTenantContext,
  isUuidLike,
  toCanonicalPatientSearchHit,
  type CanonicalPatientSearchHit,
} from "@/src/lib/patients/resolvePatientProfile";

const DEFAULT_LIMIT = 25;
const MAX_LIMIT = 50;
const MAX_PERSON_MATCHES = 500;

export type SearchCanonicalPatientsParams = {
  tenantId: string;
  query: string;
  limit?: number | null;
  /** When true (default), exclude smoke/demo fixture identities. */
  excludeSmokeOrTest?: boolean;
};

function capLimit(n: number | null | undefined): number {
  const x = typeof n === "number" && Number.isFinite(n) ? Math.floor(n) : DEFAULT_LIMIT;
  return Math.min(Math.max(1, x), MAX_LIMIT);
}

async function loadPersonIdsMatchingSearch(
  supabase: SupabaseClient,
  tenantId: string,
  search: string
): Promise<string[]> {
  const term = search.trim();
  if (!term) return [];
  const pattern = patientDirectorySearchIlikePattern(term);
  const orFilter = buildFiPersonsMetadataSearchOrFilter(pattern);
  const { data, error } = await supabase
    .from("fi_persons")
    .select("id")
    .eq("tenant_id", tenantId)
    .or(orFilter)
    .limit(MAX_PERSON_MATCHES);
  if (error) throw new Error(error.message);
  return (data ?? []).map((r) => String((r as { id: string }).id));
}

/**
 * Tenant-scoped clinic patient search that returns only canonical `fi_patients.id` hits.
 * Does not emit lead IDs, person IDs, or unresolved global patient stubs as profile targets.
 */
export async function searchCanonicalPatients(
  params: SearchCanonicalPatientsParams,
  client?: SupabaseClient
): Promise<CanonicalPatientSearchHit[]> {
  const gate = assertOrdinaryPatientSearchTenantContext(params.tenantId);
  if (!gate.ok) return [];

  const tid = gate.tenantId;
  const query = params.query.trim().slice(0, 120);
  if (!query) return [];

  const limit = capLimit(params.limit);
  const excludeSmoke = params.excludeSmokeOrTest !== false;
  const supabase = client ?? supabaseAdmin();

  const personIds = await loadPersonIdsMatchingSearch(supabase, tid, query);
  const uuidQuery = isUuidLike(query) ? query.trim() : null;

  if (personIds.length === 0 && !uuidQuery) return [];

  let listQuery = supabase
    .from("fi_patients")
    .select("id, person_id, created_at, metadata")
    .eq("tenant_id", tid)
    .order("created_at", { ascending: false })
    .limit(Math.min(limit * 4, MAX_LIMIT * 4));

  if (uuidQuery && personIds.length > 0) {
    listQuery = listQuery.or(`id.eq.${uuidQuery},person_id.in.(${personIds.join(",")})`);
  } else if (uuidQuery) {
    listQuery = listQuery.eq("id", uuidQuery);
  } else {
    listQuery = listQuery.in("person_id", personIds);
  }

  const { data: patRows, error: patErr } = await listQuery;
  if (patErr) throw new Error(patErr.message);
  if (!patRows?.length) return [];

  const resolvedPersonIds = Array.from(
    new Set(patRows.map((r) => String((r as { person_id: string }).person_id)))
  );

  const { data: personRows, error: personErr } = await supabase
    .from("fi_persons")
    .select("id, metadata")
    .eq("tenant_id", tid)
    .in("id", resolvedPersonIds);
  if (personErr) throw new Error(personErr.message);

  const personMeta = new Map<string, Record<string, unknown>>();
  for (const row of personRows ?? []) {
    const id = String((row as { id: string }).id);
    const meta = (row as { metadata: unknown }).metadata;
    personMeta.set(
      id,
      meta && typeof meta === "object" && !Array.isArray(meta)
        ? (meta as Record<string, unknown>)
        : {}
    );
  }

  const hits: CanonicalPatientSearchHit[] = [];
  const seen = new Set<string>();

  for (const raw of patRows) {
    const r = raw as {
      id: string;
      person_id: string;
      metadata?: unknown;
    };
    const patientId = String(r.id);
    if (seen.has(patientId)) continue;
    const personId = String(r.person_id);
    const pMeta = personMeta.get(personId) ?? {};
    const patMeta =
      r.metadata && typeof r.metadata === "object" && !Array.isArray(r.metadata)
        ? (r.metadata as Record<string, unknown>)
        : {};

    if (
      excludeSmoke &&
      isSmokeOrTestPatientIdentity({ patientMetadata: patMeta, personMetadata: pMeta })
    ) {
      continue;
    }

    const idc = derivePatientIdentityContact({
      personMetadata: pMeta,
      patientMetadata: patMeta,
    });

    seen.add(patientId);
    hits.push(
      toCanonicalPatientSearchHit({
        tenantId: tid,
        patientId,
        personId,
        displayName: idc.fullName,
        email: idc.primaryEmail,
        phone: idc.primaryPhone,
      })
    );
    if (hits.length >= limit) break;
  }

  return hits;
}
