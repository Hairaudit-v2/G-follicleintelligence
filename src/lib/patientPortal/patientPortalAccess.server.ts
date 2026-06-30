import "server-only";

import { supabaseAdmin } from "@/lib/supabaseAdmin";
import { resolveAuthUserId } from "@/src/lib/crm/crmGate";

export type PatientPortalAccessState =
  | { status: "unauthenticated"; clinicName: string | null }
  | { status: "unlinked"; clinicName: string | null }
  | { status: "linked"; patientId: string; clinicName: string | null };

async function loadClinicDisplayName(tenantId: string): Promise<string | null> {
  const supabase = supabaseAdmin();
  const { data, error } = await supabase
    .from("fi_tenants")
    .select("display_name")
    .eq("id", tenantId)
    .maybeSingle();
  if (error) return null;
  const name = String((data as { display_name?: unknown } | null)?.display_name ?? "").trim();
  return name.length > 0 ? name : null;
}

/**
 * Resolves whether the current Supabase user can access the patient portal for a tenant.
 */
export async function resolvePatientPortalAccess(tenantId: string): Promise<PatientPortalAccessState> {
  const tid = tenantId.trim();
  const clinicName = await loadClinicDisplayName(tid);
  const authId = await resolveAuthUserId(null);
  if (!authId) {
    return { status: "unauthenticated", clinicName };
  }

  const supabase = supabaseAdmin();
  const { data, error } = await supabase
    .from("fi_patients")
    .select("id")
    .eq("tenant_id", tid)
    .eq("portal_auth_user_id", authId)
    .maybeSingle();
  if (error) throw new Error(error.message);
  if (!data) {
    return { status: "unlinked", clinicName };
  }

  return {
    status: "linked",
    patientId: String((data as { id: string }).id),
    clinicName,
  };
}

/**
 * Resolves the foundation patient row for the current Supabase user when `fi_patients.portal_auth_user_id` is set.
 */
export async function loadPatientPortalPatientRow(tenantId: string): Promise<{ patientId: string } | null> {
  const access = await resolvePatientPortalAccess(tenantId);
  if (access.status !== "linked") return null;
  return { patientId: access.patientId };
}