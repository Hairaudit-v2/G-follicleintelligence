import "server-only";

import { supabaseAdmin } from "@/lib/supabaseAdmin";
import { assertNonEmptyUuid } from "@/src/lib/crm/validation";
import { loadCertificationHistory } from "@/src/lib/workforce/staffCertification.server";
import type { StaffCertificationRecord } from "@/src/lib/workforce/workforceClinicalTypes";

export type CertificationsPageStaffRow = {
  staffMemberId: string;
  fullName: string;
  certifications: StaffCertificationRecord[];
};

export async function loadCertificationsPageModel(tenantId: string): Promise<{
  staffRows: CertificationsPageStaffRow[];
}> {
  const tid = assertNonEmptyUuid(tenantId, "tenantId");
  const supabase = supabaseAdmin();

  const { data: members, error } = await supabase
    .from("fi_staff_members")
    .select("id, full_name")
    .eq("tenant_id", tid)
    .is("archived_at", null)
    .is("merged_into", null)
    .order("full_name");
  if (error) throw new Error(error.message);

  const staffRows: CertificationsPageStaffRow[] = [];
  for (const raw of members ?? []) {
    const row = raw as { id: string; full_name: string };
    const certifications = await loadCertificationHistory(tid, String(row.id), supabase);
    staffRows.push({
      staffMemberId: String(row.id),
      fullName: String(row.full_name),
      certifications,
    });
  }

  return { staffRows };
}