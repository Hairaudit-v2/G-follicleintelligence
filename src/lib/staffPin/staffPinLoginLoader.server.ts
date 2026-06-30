import "server-only";

import { supabaseAdmin } from "@/lib/supabaseAdmin";
import { assertNonEmptyUuid } from "@/src/lib/crm/validation";
import { loadActiveStaffForTenant } from "@/src/lib/staff/staff.server";

import { loadStaffPinMetadataMap } from "./staffPin.server";

export type StaffPinLoginPageData = {
  tenantId: string;
  clinicName: string | null;
  staff: Array<{
    id: string;
    fullName: string;
    staffRole: string;
    pinStatus: "active" | "not_set" | "locked" | "disabled";
  }>;
};

export async function loadStaffPinLoginPage(
  tenantId: string
): Promise<StaffPinLoginPageData | null> {
  const tid = assertNonEmptyUuid(tenantId, "tenantId");
  const supabase = supabaseAdmin();

  const { data: tenant, error: tenantErr } = await supabase
    .from("fi_tenants")
    .select("id, name")
    .eq("id", tid)
    .maybeSingle();
  if (tenantErr) throw new Error(tenantErr.message);
  if (!tenant) return null;

  const staffRows = await loadActiveStaffForTenant(tid);
  const pinMap = await loadStaffPinMetadataMap(
    tid,
    staffRows.map((s) => s.id)
  );

  return {
    tenantId: tid,
    clinicName: (tenant as { name: string | null }).name ?? null,
    staff: staffRows
      .map((s) => ({
        id: s.id,
        fullName: s.full_name,
        staffRole: s.staff_role,
        pinStatus: pinMap.get(s.id)?.status ?? "not_set",
      }))
      .filter((s) => s.pinStatus === "active"),
  };
}
