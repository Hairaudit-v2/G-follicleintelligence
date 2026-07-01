import "server-only";

import type { SupabaseClient } from "@supabase/supabase-js";
import { supabaseAdmin } from "@/lib/supabaseAdmin";
import { assertNonEmptyUuid } from "@/src/lib/crm/validation";
import {
  buildImagingReviewerDisplayName,
  isEligibleImagingReviewerStaffRole,
  isEligibleImagingReviewerUserRole,
  mergeImagingReviewerDirectoryRows,
  type ImagingReviewerDirectoryRow,
} from "./imagingReviewerDirectoryCore";

export type ImagingReviewerPickerOption = ImagingReviewerDirectoryRow;

export async function loadImagingReviewerDirectoryForTenant(
  tenantId: string,
  client?: SupabaseClient
): Promise<ImagingReviewerPickerOption[]> {
  const supabase = client ?? supabaseAdmin();
  const tid = assertNonEmptyUuid(tenantId, "tenantId");

  const [{ data: staffRows, error: staffErr }, { data: userRows, error: userErr }] =
    await Promise.all([
      supabase
        .from("fi_staff")
        .select("id, full_name, staff_role, fi_user_id, email, is_active")
        .eq("tenant_id", tid)
        .eq("is_active", true)
        .not("fi_user_id", "is", null)
        .limit(500),
      supabase
        .from("fi_users")
        .select("id, email, role")
        .eq("tenant_id", tid)
        .order("email", { ascending: true, nullsFirst: false })
        .limit(500),
    ]);

  if (staffErr) throw new Error(staffErr.message);
  if (userErr) throw new Error(userErr.message);

  const staffLinked: ImagingReviewerDirectoryRow[] = [];
  const linkedUserIds = new Set<string>();

  for (const raw of staffRows ?? []) {
    const row = raw as Record<string, unknown>;
    const fiUserId = row.fi_user_id != null ? String(row.fi_user_id) : "";
    const staffRole = row.staff_role != null ? String(row.staff_role) : null;
    if (!fiUserId || !isEligibleImagingReviewerStaffRole(staffRole)) continue;
    linkedUserIds.add(fiUserId);
    staffLinked.push({
      fi_user_id: fiUserId,
      email: row.email != null ? String(row.email) : null,
      user_role: null,
      staff_id: String(row.id),
      staff_role: staffRole,
      display_name: buildImagingReviewerDisplayName({
        fiUserId,
        fullName: row.full_name != null ? String(row.full_name) : null,
        email: row.email != null ? String(row.email) : null,
        staffRole,
      }),
    });
  }

  const userOnly: ImagingReviewerDirectoryRow[] = [];
  for (const raw of userRows ?? []) {
    const row = raw as Record<string, unknown>;
    const fiUserId = String(row.id);
    if (linkedUserIds.has(fiUserId)) continue;
    const userRole = row.role != null ? String(row.role) : null;
    if (!isEligibleImagingReviewerUserRole(userRole)) continue;
    userOnly.push({
      fi_user_id: fiUserId,
      email: row.email != null ? String(row.email) : null,
      user_role: userRole,
      staff_id: null,
      staff_role: null,
      display_name: buildImagingReviewerDisplayName({
        fiUserId,
        email: row.email != null ? String(row.email) : null,
        userRole,
      }),
    });
  }

  return mergeImagingReviewerDirectoryRows(staffLinked, userOnly);
}