import "server-only";

import {
  buildStaffHrNotificationNoLinkSummary,
  pickStaffHrNotificationFromSourceRows,
  type StaffHrNotificationSummary,
} from "@/src/lib/staff/staffHrNotificationSummary";
import { HR_PORTAL_SOURCE_SYSTEM_PRIORITY } from "@/src/lib/staff/myHrPortalSelection";
import { normalizeFiStaffSourceSystem } from "@/src/lib/staff/staffSourceIdsNormalize";
import { supabaseAdmin } from "@/lib/supabaseAdmin";

export async function loadHrNotificationByStaffId(
  tenantId: string,
  staffIds: string[]
): Promise<Record<string, StaffHrNotificationSummary>> {
  const out: Record<string, StaffHrNotificationSummary> = {};
  for (const id of staffIds) out[id] = buildStaffHrNotificationNoLinkSummary();
  if (!staffIds.length) return out;

  const hrSystems = HR_PORTAL_SOURCE_SYSTEM_PRIORITY.map((s) => normalizeFiStaffSourceSystem(s));
  const supabase = supabaseAdmin();
  const { data, error } = await supabase
    .from("fi_staff_source_ids")
    .select("staff_id, source_system, source_staff_id, source_url, metadata")
    .eq("tenant_id", tenantId)
    .in("staff_id", staffIds)
    .in("source_system", hrSystems);
  if (error) throw new Error(error.message);

  const byStaff = new Map<
    string,
    { source_system: string; source_url: string | null; metadata: Record<string, unknown> | null }[]
  >();
  for (const raw of data ?? []) {
    const r = raw as {
      staff_id: string;
      source_system: string;
      source_url: string | null;
      metadata: unknown;
    };
    const sid = String(r.staff_id);
    const md =
      r.metadata && typeof r.metadata === "object" && !Array.isArray(r.metadata)
        ? (r.metadata as Record<string, unknown>)
        : null;
    const list = byStaff.get(sid) ?? [];
    list.push({
      source_system: String(r.source_system),
      source_url: r.source_url != null ? String(r.source_url) : null,
      metadata: md,
    });
    byStaff.set(sid, list);
  }

  for (const staffId of staffIds) {
    const rows = byStaff.get(staffId) ?? [];
    out[staffId] = pickStaffHrNotificationFromSourceRows(
      rows.map((r) => ({
        source_system: r.source_system,
        source_url: r.source_url,
        metadata: r.metadata,
      }))
    );
  }

  return out;
}
