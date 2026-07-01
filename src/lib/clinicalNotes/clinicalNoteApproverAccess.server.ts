import "server-only";

import { supabaseAdmin } from "@/lib/supabaseAdmin";
import { resolveAuthUserId } from "@/src/lib/crm/crmGate";
import { rejectStaffPinSessionForRestrictedMutation } from "@/src/lib/staffPin/staffPinMutationGuard.server";
import { getFiOsImpersonationTargetAuthUserId } from "@/src/lib/fiOs/fiOsImpersonation.server";
import { loadFiOsIdentity } from "@/src/lib/fiOs/fiOsIdentity.server";
import { isFiOsPlatformAdminRole } from "@/src/lib/fiOs/fiOsRoles";

export type ClinicalNoteApproverActor = {
  authUserId: string;
  fiUserId: string;
  fiUserRole: string;
};

const CLINICAL_NOTE_APPROVER_ROLES_LOWER = new Set([
  "fi_admin",
  "admin",
  "owner",
  "doctor",
  "nurse",
  "surgeon",
  "crm_operator",
  "consultant",
]);

export function isClinicalNoteApproverRole(role: string | null | undefined): boolean {
  return CLINICAL_NOTE_APPROVER_ROLES_LOWER.has(
    String(role ?? "")
      .trim()
      .toLowerCase()
  );
}

/**
 * Voice clinical note approval requires a clinical/operational role on the tenant.
 * Reception and generic member roles are denied.
 */
export async function requireClinicalNoteApproverActor(
  tenantId: string
): Promise<ClinicalNoteApproverActor> {
  const tid = tenantId.trim();
  await rejectStaffPinSessionForRestrictedMutation(tid);

  const sessionAuthId = await resolveAuthUserId(null);
  if (!sessionAuthId) {
    throw new Error("Not signed in.");
  }

  const impersonated = await getFiOsImpersonationTargetAuthUserId(sessionAuthId);
  const principalAuthId = impersonated ?? sessionAuthId;

  const os = await loadFiOsIdentity(sessionAuthId);
  if (os && isFiOsPlatformAdminRole(os.osRole) && !impersonated) {
    throw new Error(
      "Platform administrators must impersonate a clinical staff member before approving voice notes."
    );
  }

  const supabase = supabaseAdmin();
  const { data, error } = await supabase
    .from("fi_users")
    .select("id, role")
    .eq("tenant_id", tid)
    .eq("auth_user_id", principalAuthId)
    .maybeSingle();

  if (error || !data) {
    throw new Error("You do not have access to approve clinical notes for this tenant.");
  }

  const role = String((data as { role: string | null }).role ?? "member");
  if (!isClinicalNoteApproverRole(role)) {
    throw new Error("A clinical or operational role is required to approve voice notes.");
  }

  return {
    authUserId: principalAuthId,
    fiUserId: String((data as { id: string }).id),
    fiUserRole: role,
  };
}