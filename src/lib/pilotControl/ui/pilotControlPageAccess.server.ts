/**
 * FI-CONTROLLED-PILOT-CONTROL-CENTRE-1A.5 — server page access gate.
 */
import "server-only";

import {
  isFiOsPlatformAdminFullSessionBypass,
  resolveAuthUserId,
  tryResolveFiUserIdForTenant,
} from "@/src/lib/crm/crmGate";
import { loadActiveTenantAdminProfileForSession } from "@/src/lib/tenantAdmin/tenantAdminProfile.server";
import { supabaseAdmin } from "@/lib/supabaseAdmin";

import type { PilotControlRoleKey } from "../pilotControlContracts";
import { mapToPilotControlRole } from "../api/pilotControlRoleMap";
import { roleHasApiPermission } from "../api/pilotControlPermissions";

export type PilotControlPageAccess =
  | { allowed: true; role: PilotControlRoleKey; actorId: string }
  | { allowed: false; reason: "unauthenticated" | "forbidden" };

/**
 * Resolve whether the current session may open the Control Centre UI.
 * Mirrors API role mapping; does not replace API authorization on each fetch.
 */
export async function resolvePilotControlPageAccess(
  tenantId: string
): Promise<PilotControlPageAccess> {
  const tid = tenantId.trim();
  if (!tid) return { allowed: false, reason: "unauthenticated" };

  const authUserId = await resolveAuthUserId();
  if (!authUserId) return { allowed: false, reason: "unauthenticated" };

  const platformAdmin = await isFiOsPlatformAdminFullSessionBypass(authUserId);
  let fiUserRole: string | null = null;
  let staffRole: string | null = null;
  let explicitPilotRole: string | null = null;

  const fiUserId = await tryResolveFiUserIdForTenant(tid);
  if (fiUserId) {
    const supabase = supabaseAdmin();
    const { data: fiUser } = await supabase
      .from("fi_users")
      .select("id, role")
      .eq("tenant_id", tid)
      .eq("id", fiUserId)
      .maybeSingle();
    fiUserRole = fiUser ? String((fiUser as { role: string | null }).role ?? "") : null;

    const { data: staffRows } = await supabase
      .from("fi_staff")
      .select("staff_role, staff_metadata, is_active")
      .eq("tenant_id", tid)
      .eq("fi_user_id", fiUserId)
      .eq("is_active", true);

    const rows = (staffRows ?? []) as Array<{
      staff_role: string | null;
      staff_metadata: unknown;
    }>;
    if (rows[0]) {
      staffRole = rows[0].staff_role;
      const meta = rows[0].staff_metadata;
      if (meta && typeof meta === "object" && !Array.isArray(meta)) {
        const m = meta as Record<string, unknown>;
        if (typeof m.pilot_control_role === "string") {
          explicitPilotRole = m.pilot_control_role;
        }
      }
    }
  }

  const adminProf = await loadActiveTenantAdminProfileForSession(tid, authUserId);
  const role = mapToPilotControlRole({
    explicitPilotRole,
    staffRole,
    fiUserRole,
    tenantAdminRole: adminProf?.adminRole ?? null,
    platformAdmin,
  });

  if (!role || !roleHasApiPermission(role, "pilot_control.overview.read")) {
    return { allowed: false, reason: "forbidden" };
  }

  return { allowed: true, role, actorId: authUserId };
}

/**
 * Lightweight migration presence check for fail-safe empty/error messaging.
 * Does not auto-apply migrations.
 */
export async function checkPilotControlMigrationsPresent(tenantId: string): Promise<{
  ok: boolean;
  missing: string[];
}> {
  const required = [
    "fi_pilot_programmes",
    "fi_pilot_enrolments",
    "fi_pilot_control_events",
    "fi_pilot_blockers",
  ];
  const missing: string[] = [];
  const supabase = supabaseAdmin();
  for (const table of required) {
    const { error } = await supabase.from(table).select("id", { head: true, count: "exact" }).limit(1);
    if (error) {
      const msg = String(error.message ?? error.code ?? "").toLowerCase();
      if (
        msg.includes("does not exist") ||
        msg.includes("could not find") ||
        msg.includes("schema cache") ||
        error.code === "42P01" ||
        error.code === "PGRST205"
      ) {
        missing.push(table);
      }
    }
  }
  // Tenant scoped soft check: programmes readable for tenant when table exists
  if (!missing.includes("fi_pilot_programmes")) {
    const { error } = await supabase
      .from("fi_pilot_programmes")
      .select("id")
      .eq("tenant_id", tenantId.trim())
      .limit(1);
    if (error && String(error.message).toLowerCase().includes("does not exist")) {
      missing.push("fi_pilot_programmes");
    }
  }
  return { ok: missing.length === 0, missing };
}
