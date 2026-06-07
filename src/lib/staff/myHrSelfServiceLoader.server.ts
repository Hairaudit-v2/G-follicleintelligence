import "server-only";

import { supabaseAdmin } from "@/lib/supabaseAdmin";
import { resolveAuthUserId } from "@/src/lib/crm/crmGate";
import { assertNonEmptyUuid } from "@/src/lib/crm/validation";
import { normalizeFiStaffSourceSystem } from "@/src/lib/staff/staffSourceIdsNormalize";
import { IIOHR_HR_SOURCE_SYSTEM } from "@/src/lib/staffImport/iiohrHrStaffImportPlan";

export type MyHrSelfServicePageState =
  | { kind: "unauthenticated" }
  | { kind: "no_tenant_membership" }
  | { kind: "no_staff_profile" }
  | { kind: "hr_not_linked" }
  | { kind: "ready"; hrPortalUrl: string };

export type MyHrSelfServicePageData = {
  tenantId: string;
  state: MyHrSelfServicePageState;
};

/**
 * Self-service HR entry: current auth user's `fi_users` row, linked `fi_staff`, and their own
 * `fi_staff_source_ids` for `iiohr_hr` only. Never loads other staff rows.
 */
export async function loadMyHrSelfServicePage(tenantId: string): Promise<MyHrSelfServicePageData> {
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
    .select("id")
    .eq("tenant_id", tid)
    .eq("fi_user_id", fiUserId)
    .maybeSingle();
  if (staffErr) throw new Error(staffErr.message);
  if (!staff) {
    return { tenantId: tid, state: { kind: "no_staff_profile" } };
  }
  const staffId = String((staff as { id: string }).id);

  const { data: sourceRows, error: srcErr } = await supabase
    .from("fi_staff_source_ids")
    .select("source_system, source_url")
    .eq("tenant_id", tid)
    .eq("staff_id", staffId);
  if (srcErr) throw new Error(srcErr.message);

  const hrRows = (sourceRows ?? []).filter((r) => {
    const sys = normalizeFiStaffSourceSystem(String((r as { source_system: string }).source_system));
    return sys === IIOHR_HR_SOURCE_SYSTEM;
  });

  const withUrl = hrRows
    .map((r) => String((r as { source_url: string | null }).source_url ?? "").trim())
    .find((u) => u.length > 0);

  if (!withUrl) {
    return { tenantId: tid, state: { kind: "hr_not_linked" } };
  }

  return { tenantId: tid, state: { kind: "ready", hrPortalUrl: withUrl } };
}
