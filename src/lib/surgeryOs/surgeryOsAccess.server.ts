import "server-only";

import type { FiWorkspaceProfileKey } from "@/src/config/fiWorkspaceProfiles";
import { resolveWorkspaceProfileKeyFromSignals } from "@/src/lib/fi-os/workspaceProfileDerivation";
import { isCrmShellNavRole } from "@/src/lib/crm/crmGatePolicy";
import { resolveAuthUserId, isFiOsPlatformAdminFullSessionBypass } from "@/src/lib/crm/crmGate";
import { supabaseAdmin } from "@/lib/supabaseAdmin";
import { loadActiveTenantAdminProfileForSession } from "@/src/lib/tenantAdmin/tenantAdminProfile.server";
import type { FiTenantAdminRole } from "@/src/lib/tenantAdmin/tenantAdminRoles";
import {
  type SurgeryOsViewerRole,
  resolveSurgeryOsPersonaFromWorkspaceProfile,
  visibleWidgetsForSurgeryOsRole,
  type SurgeryOsWidgetKey,
} from "@/src/lib/surgeryOs/surgeryOsBoardModel";

export type SurgeryOsViewerContext = {
  authUserId: string | null;
  fiUserRole: string | null;
  staffRole: string | null;
  workspaceProfile: FiWorkspaceProfileKey;
  surgeryOsRole: SurgeryOsViewerRole;
  visibleWidgets: readonly SurgeryOsWidgetKey[];
  canAccessSurgeryOs: boolean;
};

function mapToSurgeryOsRole(input: {
  workspaceProfile: FiWorkspaceProfileKey;
  fiUserRole: string | null;
  tenantAdminRole: FiTenantAdminRole | null;
  platformAdmin: boolean;
  staffRole: string | null;
}): SurgeryOsViewerRole {
  if (input.platformAdmin || isCrmShellNavRole(input.fiUserRole)) return "admin";
  const fromProfile = resolveSurgeryOsPersonaFromWorkspaceProfile(input.workspaceProfile);
  if (fromProfile) return fromProfile;
  if (input.tenantAdminRole === "operations_admin") return "theatre_manager";
  if (input.tenantAdminRole === "clinic_admin") return "admin";
  const sr = (input.staffRole ?? "").trim().toLowerCase();
  if (sr.includes("surgeon") || sr.includes("doctor")) return "surgeon";
  if (sr.includes("nurse") || sr.includes("tech")) return "coordinator";
  return "coordinator";
}

async function loadStaffSignalsForAuthUser(
  tenantId: string,
  authUserId: string
): Promise<{
  staffRole: string | null;
  explicitWorkspaceProfile: unknown;
}> {
  const supabase = supabaseAdmin();
  const { data: fiUser } = await supabase
    .from("fi_users")
    .select("id")
    .eq("tenant_id", tenantId.trim())
    .eq("auth_user_id", authUserId.trim())
    .maybeSingle();
  if (!fiUser) return { staffRole: null, explicitWorkspaceProfile: null };

  const fiUserId = String((fiUser as { id: string }).id);
  const { data: staff } = await supabase
    .from("fi_staff")
    .select("staff_role, staff_metadata")
    .eq("tenant_id", tenantId.trim())
    .eq("fi_user_id", fiUserId)
    .eq("is_active", true)
    .maybeSingle();

  if (!staff) return { staffRole: null, explicitWorkspaceProfile: null };
  const row = staff as { staff_role: string | null; staff_metadata: unknown };
  const meta =
    row.staff_metadata &&
    typeof row.staff_metadata === "object" &&
    !Array.isArray(row.staff_metadata)
      ? (row.staff_metadata as Record<string, unknown>)
      : {};
  return {
    staffRole: row.staff_role,
    explicitWorkspaceProfile: meta.workspace_profile,
  };
}

/**
 * Resolve SurgeryOS viewer context for widget visibility and route access.
 * Theatre staff, CRM shell roles, and tenant backend admins may access.
 */
export async function resolveSurgeryOsViewerContext(
  tenantId: string
): Promise<SurgeryOsViewerContext> {
  const tid = tenantId.trim();
  const authUserId = await resolveAuthUserId(null);
  const platformAdmin = authUserId ? await isFiOsPlatformAdminFullSessionBypass(authUserId) : false;

  let fiUserRole: string | null = null;
  let staffRole: string | null = null;
  let explicitWorkspaceProfile: unknown = null;
  let tenantAdminRole: FiTenantAdminRole | null = null;

  if (authUserId) {
    const supabase = supabaseAdmin();
    const { data } = await supabase
      .from("fi_users")
      .select("role")
      .eq("tenant_id", tid)
      .eq("auth_user_id", authUserId.trim())
      .maybeSingle();
    fiUserRole = data ? String((data as { role: string | null }).role ?? "member") : null;

    const staffSignals = await loadStaffSignalsForAuthUser(tid, authUserId);
    staffRole = staffSignals.staffRole;
    explicitWorkspaceProfile = staffSignals.explicitWorkspaceProfile;

    const prof = await loadActiveTenantAdminProfileForSession(tid, authUserId);
    tenantAdminRole = prof?.adminRole ?? null;
  }

  const workspaceProfile = resolveWorkspaceProfileKeyFromSignals({
    explicitWorkspaceProfile,
    staffRole,
    tenantAdminRole,
    fiOsRole: platformAdmin ? "fi_platform_admin" : null,
  });

  const surgeryOsRole = mapToSurgeryOsRole({
    workspaceProfile,
    fiUserRole,
    tenantAdminRole,
    platformAdmin,
    staffRole,
  });

  const hasStaffOrShell =
    platformAdmin ||
    isCrmShellNavRole(fiUserRole) ||
    Boolean(staffRole?.trim()) ||
    tenantAdminRole != null;

  return {
    authUserId,
    fiUserRole,
    staffRole,
    workspaceProfile,
    surgeryOsRole,
    visibleWidgets: visibleWidgetsForSurgeryOsRole(surgeryOsRole),
    canAccessSurgeryOs: hasStaffOrShell,
  };
}
