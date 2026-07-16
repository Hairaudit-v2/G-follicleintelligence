import "server-only";

import type { SupabaseClient } from "@supabase/supabase-js";
import { supabaseAdmin } from "@/lib/supabaseAdmin";
import {
  buildResolvedPatientProfile,
  validateResolvePatientProfileInput,
  type ResolvePatientProfileInput,
  type ResolvePatientProfileResult,
} from "./resolvePatientProfile";

/**
 * Fail-closed canonical patient profile resolver.
 *
 * Contract:
 * - `patientId` must be exact `fi_patients.id` (no person/lead/global substitution)
 * - exact `tenant_id` match is mandatory
 * - exactly one patient row
 * - linked person must belong to the same tenant
 * - no email / fuzzy / first-row fallback
 */
export async function resolvePatientProfile(
  input: ResolvePatientProfileInput,
  client?: SupabaseClient
): Promise<ResolvePatientProfileResult> {
  const invalid = validateResolvePatientProfileInput(input);
  if (invalid) return invalid;

  const tid = input.tenantId.trim();
  const pid = input.patientId.trim();
  const supabase = client ?? supabaseAdmin();

  const { data: patientRow, error: patientErr } = await supabase
    .from("fi_patients")
    .select("id, tenant_id, person_id")
    .eq("tenant_id", tid)
    .eq("id", pid)
    .maybeSingle();

  if (patientErr) throw new Error(patientErr.message);
  if (!patientRow) {
    // Distinguish unknown id vs wrong-tenant ownership without leaking cross-tenant data.
    const { data: anyTenantRow, error: anyErr } = await supabase
      .from("fi_patients")
      .select("id, tenant_id")
      .eq("id", pid)
      .maybeSingle();
    if (anyErr) throw new Error(anyErr.message);
    if (anyTenantRow && String((anyTenantRow as { tenant_id: string }).tenant_id) !== tid) {
      return { ok: false, error: "cross_tenant_denied" };
    }
    return { ok: false, error: "patient_not_found" };
  }

  const personId = String((patientRow as { person_id: string }).person_id ?? "").trim();
  if (!personId) return { ok: false, error: "person_not_found" };

  const { data: personRow, error: personErr } = await supabase
    .from("fi_persons")
    .select("id, tenant_id")
    .eq("id", personId)
    .maybeSingle();
  if (personErr) throw new Error(personErr.message);
  if (!personRow) return { ok: false, error: "person_not_found" };

  const personTenantId = String((personRow as { tenant_id: string }).tenant_id ?? "").trim();
  if (personTenantId !== tid) {
    return { ok: false, error: "person_tenant_mismatch" };
  }

  return {
    ok: true,
    data: buildResolvedPatientProfile({
      tenantId: tid,
      patientId: pid,
      personId,
    }),
  };
}
