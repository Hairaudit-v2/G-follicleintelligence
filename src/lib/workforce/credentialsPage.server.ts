import "server-only";

import { supabaseAdmin } from "@/lib/supabaseAdmin";
import { assertNonEmptyUuid } from "@/src/lib/crm/validation";
import { loadStaffCredentials } from "@/src/lib/workforce/staffCredentials.server";
import type { StaffCredentialRecord } from "@/src/lib/workforce/workforceClinicalTypes";

export type CredentialsPageStaffRow = {
  staffMemberId: string;
  fullName: string;
  email: string | null;
  credentials: StaffCredentialRecord[];
};

export async function loadCredentialsPageModel(tenantId: string): Promise<{
  staffRows: CredentialsPageStaffRow[];
}> {
  const tid = assertNonEmptyUuid(tenantId, "tenantId");
  const supabase = supabaseAdmin();

  const { data: members, error } = await supabase
    .from("fi_staff_members")
    .select("id, full_name, email")
    .eq("tenant_id", tid)
    .eq("employment_status", "active")
    .is("archived_at", null)
    .is("merged_into", null)
    .order("full_name");
  if (error) throw new Error(error.message);

  const staffRows: CredentialsPageStaffRow[] = [];
  for (const raw of members ?? []) {
    const row = raw as { id: string; full_name: string; email: string | null };
    const credentials = await loadStaffCredentials(tid, String(row.id), supabase);
    staffRows.push({
      staffMemberId: String(row.id),
      fullName: String(row.full_name),
      email: row.email,
      credentials,
    });
  }

  return { staffRows };
}