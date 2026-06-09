import "server-only";

import { supabaseAdmin } from "@/lib/supabaseAdmin";
import { resolveAuthUserId } from "@/src/lib/crm/crmGate";
import { assertNonEmptyUuid } from "@/src/lib/crm/validation";
import { pickHrPortalFromSourceIds } from "@/src/lib/staff/myHrPortalSelection";
import { pickStaffHrNotificationFromSourceRows } from "@/src/lib/staff/staffHrNotificationSummary";
import type { StaffHrNotificationSummary } from "@/src/lib/staff/staffHrNotificationSummary";
import { buildStaffComplianceSummaryFromSourceRows } from "@/src/lib/staffCompliance/staffComplianceSummary";
import type { StaffComplianceSummary } from "@/src/lib/staffCompliance/staffComplianceTypes";

export type MyHrPortalPageState =
  | { kind: "unauthenticated" }
  | { kind: "no_tenant_membership" }
  | { kind: "no_staff_profile" }
  | {
      kind: "ready";
      staffName: string;
      staffRole: string;
      isActive: boolean;
      hrPortalUrl: string | null;
      sourceSystem: string | null;
      hasHrLink: boolean;
      complianceSummary: StaffComplianceSummary;
      hrNotification: StaffHrNotificationSummary;
    };

export type MyHrPortalPageData = {
  tenantId: string;
  state: MyHrPortalPageState;
};

/**
 * My HR Portal: current user's tenant `fi_users` row, linked `fi_staff`, and that staff member's
 * `fi_staff_source_ids` only. Never loads other staff. Read-only — no HR mutations.
 */
export async function loadMyHrPortalPage(tenantId: string): Promise<MyHrPortalPageData> {
  const tid = assertNonEmptyUuid(tenantId, "tenantId");
  const authUserId = await resolveAuthUserId(null);
  if (!authUserId?.trim()) {
    return { tenantId: tid, state: { kind: "unauthenticated" } };
  }

  const supabase = supabaseAdmin();
  const { data: fiUser, error: userErr } = await supabase
    .from("fi_users")
    .select("id")
    .eq("tenant_id", tid)
    .eq("auth_user_id", authUserId.trim())
    .maybeSingle();
  if (userErr) throw new Error(userErr.message);
  if (!fiUser) {
    return { tenantId: tid, state: { kind: "no_tenant_membership" } };
  }
  const fiUserId = String((fiUser as { id: string }).id);

  const { data: staff, error: staffErr } = await supabase
    .from("fi_staff")
    .select("id, full_name, staff_role, is_active")
    .eq("tenant_id", tid)
    .eq("fi_user_id", fiUserId)
    .maybeSingle();
  if (staffErr) throw new Error(staffErr.message);
  if (!staff) {
    return { tenantId: tid, state: { kind: "no_staff_profile" } };
  }
  const staffId = String((staff as { id: string }).id);
  const staffName = String((staff as { full_name?: string }).full_name ?? "").trim() || "Staff";
  const staffRole = String((staff as { staff_role?: string }).staff_role ?? "").trim() || "—";
  const isActive = Boolean((staff as { is_active?: boolean }).is_active);

  const { data: sourceRows, error: srcErr } = await supabase
    .from("fi_staff_source_ids")
    .select("source_system, source_url, metadata")
    .eq("tenant_id", tid)
    .eq("staff_id", staffId)
    .order("source_system", { ascending: true });
  if (srcErr) throw new Error(srcErr.message);

  const rows = (sourceRows ?? []).map((r) => {
    const row = r as { source_system: string; source_url: string | null; metadata?: unknown };
    return {
      source_system: String(row.source_system),
      source_url: row.source_url != null ? String(row.source_url) : null,
      metadata: row.metadata,
    };
  });

  const picked = pickHrPortalFromSourceIds(rows);

  const complianceSummary = buildStaffComplianceSummaryFromSourceRows(
    rows.map((r) => {
      const md = r.metadata;
      const metadata =
        md && typeof md === "object" && !Array.isArray(md) ? (md as Record<string, unknown>) : null;
      return { source_system: r.source_system, metadata };
    })
  );

  const hrNotification = pickStaffHrNotificationFromSourceRows(
    rows.map((r) => {
      const md = r.metadata;
      const metadata =
        md && typeof md === "object" && !Array.isArray(md) ? (md as Record<string, unknown>) : null;
      return { source_system: r.source_system, source_url: r.source_url, metadata };
    })
  );

  return {
    tenantId: tid,
    state: {
      kind: "ready",
      staffName,
      staffRole,
      isActive,
      hrPortalUrl: picked.hrPortalUrl,
      sourceSystem: picked.sourceSystem,
      hasHrLink: picked.hasHrLink,
      complianceSummary,
      hrNotification,
    },
  };
}
