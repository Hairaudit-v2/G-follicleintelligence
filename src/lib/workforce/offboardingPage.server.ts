import "server-only";

import { supabaseAdmin } from "@/lib/supabaseAdmin";
import { assertCrmTenantWriteAllowed } from "@/src/lib/crm/crmGate";
import { assertNonEmptyUuid } from "@/src/lib/crm/validation";
import type { OffboardingStaffRow } from "@/src/components/fi-admin/hr/OffboardingCentreClient";

export type OffboardingPageModel = {
  activeStaff: OffboardingStaffRow[];
  offboardedStaff: OffboardingStaffRow[];
};

const ACTIVE_STATUSES = ["active", "pending_onboarding", "on_leave"];
const OFFBOARDED_STATUSES = ["terminated", "resigned", "contract_ended", "contract_expired"];

function mapRow(raw: Record<string, unknown>): OffboardingStaffRow {
  return {
    id: String(raw.id),
    fullName: String(raw.full_name ?? "Staff"),
    email: raw.email != null ? String(raw.email) : null,
    roleCode: raw.role_code != null ? String(raw.role_code) : null,
    employmentStatus: String(raw.employment_status ?? "active"),
    fiStaffId: raw.fi_staff_id != null ? String(raw.fi_staff_id) : null,
  };
}

export async function loadOffboardingPageModel(tenantId: string): Promise<OffboardingPageModel> {
  const tid = assertNonEmptyUuid(tenantId, "tenantId");
  await assertCrmTenantWriteAllowed({ tenantId: tid, request: undefined });

  const { data, error } = await supabaseAdmin()
    .from("fi_staff_members")
    .select("id, full_name, email, role_code, employment_status, fi_staff_id")
    .eq("tenant_id", tid)
    .is("archived_at", null)
    .is("merged_into", null)
    .order("full_name", { ascending: true });
  if (error) throw new Error(error.message);

  const rows = ((data ?? []) as Record<string, unknown>[]).map(mapRow);
  return {
    activeStaff: rows.filter((r) => ACTIVE_STATUSES.includes(r.employmentStatus)),
    offboardedStaff: rows.filter((r) => OFFBOARDED_STATUSES.includes(r.employmentStatus)),
  };
}