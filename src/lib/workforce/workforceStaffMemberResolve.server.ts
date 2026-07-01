import "server-only";

import type { SupabaseClient } from "@supabase/supabase-js";

import { supabaseAdmin } from "@/lib/supabaseAdmin";
import { assertNonEmptyUuid } from "@/src/lib/crm/validation";

export type ResolvedStaffMemberContext = {
  staffMemberId: string;
  fiStaffId: string | null;
  employmentStatus: string;
  fullName: string | null;
};

/**
 * Resolves fi_staff_members row from either staff_member id or fi_staff id.
 */
export async function resolveStaffMemberContext(
  tenantId: string,
  staffId: string,
  client?: SupabaseClient
): Promise<ResolvedStaffMemberContext | null> {
  const tid = assertNonEmptyUuid(tenantId, "tenantId");
  const sid = assertNonEmptyUuid(staffId, "staffId");
  const supabase = client ?? supabaseAdmin();

  const byMember = await supabase
    .from("fi_staff_members")
    .select("id, fi_staff_id, employment_status, full_name")
    .eq("tenant_id", tid)
    .eq("id", sid)
    .is("archived_at", null)
    .is("merged_into", null)
    .maybeSingle();
  if (byMember.error) throw new Error(byMember.error.message);
  if (byMember.data) {
    const row = byMember.data as {
      id: string;
      fi_staff_id: string | null;
      employment_status: string;
      full_name: string | null;
    };
    return {
      staffMemberId: String(row.id),
      fiStaffId: row.fi_staff_id != null ? String(row.fi_staff_id) : null,
      employmentStatus: String(row.employment_status ?? "active"),
      fullName: row.full_name,
    };
  }

  const byFiStaff = await supabase
    .from("fi_staff_members")
    .select("id, fi_staff_id, employment_status, full_name")
    .eq("tenant_id", tid)
    .eq("fi_staff_id", sid)
    .is("archived_at", null)
    .is("merged_into", null)
    .maybeSingle();
  if (byFiStaff.error) throw new Error(byFiStaff.error.message);
  if (!byFiStaff.data) return null;

  const row = byFiStaff.data as {
    id: string;
    fi_staff_id: string | null;
    employment_status: string;
    full_name: string | null;
  };
  return {
    staffMemberId: String(row.id),
    fiStaffId: row.fi_staff_id != null ? String(row.fi_staff_id) : null,
    employmentStatus: String(row.employment_status ?? "active"),
    fullName: row.full_name,
  };
}