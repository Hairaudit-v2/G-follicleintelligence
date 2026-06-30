import "server-only";

import type { FiStaffRow } from "@/src/lib/staff/staff.server";
import { supabaseAdmin } from "@/lib/supabaseAdmin";
import { assertNonEmptyUuid } from "@/src/lib/crm/validation";
import { buildWorkforceIdentitySummaryFromSourceRows } from "@/src/lib/workforce-os/workforceIdentitySummary";

export type TenantWorkforceIdentityOverview = {
  activeStaffCount: number;
  hrLinkedCount: number;
  academyLinkedCount: number;
  nexusLinkedCount: number;
  staleIdentityCount: number;
  fullyLinkedCount: number;
};

/**
 * Aggregates identity link coverage for WorkforceOS module home and sync health surfaces.
 */
export async function buildTenantWorkforceIdentityOverview(
  tenantId: string,
  staff?: FiStaffRow[]
): Promise<TenantWorkforceIdentityOverview> {
  const tid = assertNonEmptyUuid(tenantId, "tenantId");
  const supabase = supabaseAdmin();

  const activeStaff = staff?.filter((s) => s.is_active) ?? [];
  const activeStaffCount = activeStaff.length;

  if (activeStaffCount === 0) {
    return {
      activeStaffCount: 0,
      hrLinkedCount: 0,
      academyLinkedCount: 0,
      nexusLinkedCount: 0,
      staleIdentityCount: 0,
      fullyLinkedCount: 0,
    };
  }

  const staffIds = activeStaff.map((s) => s.id);
  const { data, error } = await supabase
    .from("fi_staff_source_ids")
    .select("staff_id, source_system, source_staff_id, metadata")
    .eq("tenant_id", tid)
    .in("staff_id", staffIds);

  if (error) throw new Error(error.message);

  const rowsByStaff = new Map<
    string,
    Array<{ source_system: string; source_staff_id: string; metadata: unknown }>
  >();
  for (const raw of data ?? []) {
    const r = raw as {
      staff_id: string;
      source_system: string;
      source_staff_id: string;
      metadata: unknown;
    };
    const sid = String(r.staff_id);
    const list = rowsByStaff.get(sid) ?? [];
    list.push({
      source_system: String(r.source_system),
      source_staff_id: String(r.source_staff_id),
      metadata:
        r.metadata && typeof r.metadata === "object" && !Array.isArray(r.metadata)
          ? (r.metadata as Record<string, unknown>)
          : null,
    });
    rowsByStaff.set(sid, list);
  }

  let hrLinkedCount = 0;
  let academyLinkedCount = 0;
  let nexusLinkedCount = 0;
  let staleIdentityCount = 0;
  let fullyLinkedCount = 0;

  for (const s of activeStaff) {
    const srcRows = rowsByStaff.get(s.id) ?? [];
    const summary = buildWorkforceIdentitySummaryFromSourceRows(
      srcRows.map((row) => ({
        source_system: row.source_system,
        source_staff_id: row.source_staff_id,
        metadata: row.metadata as Record<string, unknown> | null,
      }))
    );

    if (summary.hr.linked) hrLinkedCount += 1;
    if (summary.academy.linked) academyLinkedCount += 1;
    if (summary.nexus.linked) nexusLinkedCount += 1;
    if (summary.hasStaleIdentitySync) staleIdentityCount += 1;
    if (summary.linkedIdentityCount >= 3) fullyLinkedCount += 1;
  }

  return {
    activeStaffCount,
    hrLinkedCount,
    academyLinkedCount,
    nexusLinkedCount,
    staleIdentityCount,
    fullyLinkedCount,
  };
}
