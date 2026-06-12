import "server-only";

import { cache } from "react";

import { supabaseAdmin } from "@/lib/supabaseAdmin";
import type { FiWorkspaceProfileKey } from "@/src/config/fiWorkspaceProfiles";
import { isFiWorkspaceProfileKey } from "@/src/config/fiWorkspaceProfiles";
import { resolveAuthUserId } from "@/src/lib/crm/crmGate";
import { assertStaffFeatureAccessMutationAllowed } from "@/src/lib/fi-os/featureAccess.server";
import { loadLinkedStaffOrganisationalSignalsForFiUser } from "@/src/lib/fi-os/organisationalProfile.server";
import { resolveWorkspaceProfileKeyFromSignals } from "@/src/lib/fi-os/workspaceProfileDerivation";
import { loadFiOsIdentity } from "@/src/lib/fiOs/fiOsIdentity.server";
import { loadActiveTenantAdminProfileForSession } from "@/src/lib/tenantAdmin/tenantAdminProfile.server";
import { loadStaffMemberForTenant, updateFiStaff } from "@/src/lib/staff/staff.server";

async function loadFiUserRow(
  tenantId: string,
  authUserId: string
): Promise<{ id: string; role: string } | null> {
  const supabase = supabaseAdmin();
  const { data, error } = await supabase
    .from("fi_users")
    .select("id, role")
    .eq("tenant_id", tenantId.trim())
    .eq("auth_user_id", authUserId.trim())
    .maybeSingle();
  if (error) return null;
  if (!data) return null;
  return { id: String((data as { id: string }).id), role: String((data as { role: string | null }).role ?? "member") };
}

async function loadWorkspaceProfileKeyForViewerImpl(tenantId: string): Promise<FiWorkspaceProfileKey> {
  const tid = tenantId.trim();
  if (!tid) return "default";
  try {
    const authId = await resolveAuthUserId(null);
    if (!authId) return "default";

    const fiUser = await loadFiUserRow(tid, authId);
    const staff = fiUser ? await loadLinkedStaffOrganisationalSignalsForFiUser(tid, fiUser.id) : null;
    const tenantAdmin = await loadActiveTenantAdminProfileForSession(tid, authId);
    const os = await loadFiOsIdentity(authId);

    return resolveWorkspaceProfileKeyFromSignals({
      explicitWorkspaceProfile: staff?.explicitWorkspaceProfile,
      positionTypeDefaultWorkspaceProfile: staff?.positionTypeDefaultWorkspaceProfile ?? null,
      featureTemplateWorkspaceProfile: staff?.featureTemplateWorkspaceProfile ?? null,
      staffRole: staff?.staff_role ?? null,
      tenantAdminRole: tenantAdmin?.adminRole ?? null,
      fiOsRole: os?.osRole ?? null,
    });
  } catch {
    return "default";
  }
}

/** Deduped per request — used by tenant home and related shells. */
export const loadWorkspaceProfileKeyForViewer = cache(loadWorkspaceProfileKeyForViewerImpl);

export async function persistStaffWorkspaceProfileOverride(opts: {
  tenantId: string;
  staffId: string;
  /** When `default`, clears explicit override so automatic derivation resumes. */
  profile: FiWorkspaceProfileKey | "default";
  adminKey?: string | null;
}): Promise<void> {
  const tid = opts.tenantId.trim();
  const sid = opts.staffId.trim();
  if (!tid || !sid) throw new Error("tenantId and staffId are required.");
  if (opts.profile !== "default" && opts.profile === "platform_admin") {
    throw new Error("platform_admin workspace is implicit for platform operators and cannot be assigned on staff rows.");
  }
  await assertStaffFeatureAccessMutationAllowed({ tenantId: tid, adminKey: opts.adminKey ?? undefined });
  const staff = await loadStaffMemberForTenant(tid, sid);
  if (!staff) throw new Error("Staff not found.");
  const nextMeta = { ...staff.staff_metadata };
  if (!opts.profile || opts.profile === "default") {
    delete nextMeta.workspace_profile;
  } else {
    nextMeta.workspace_profile = opts.profile;
  }
  await updateFiStaff(tid, sid, { staff_metadata: nextMeta });
}

export function assertAssignableWorkspaceProfileKey(raw: string): FiWorkspaceProfileKey | "default" {
  const t = raw.trim().toLowerCase();
  if (!t || t === "default") return "default";
  if (!isFiWorkspaceProfileKey(t)) throw new Error("Invalid workspace profile.");
  if (t === "platform_admin") throw new Error("platform_admin cannot be assigned.");
  return t;
}
