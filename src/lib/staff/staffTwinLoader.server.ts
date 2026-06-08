import "server-only";

import { supabaseAdmin } from "@/lib/supabaseAdmin";
import { resolveAuthUserId } from "@/src/lib/crm/crmGate";
import { isCrmStaffManageRole } from "@/src/lib/crm/crmGatePolicy";
import { assertNonEmptyUuid } from "@/src/lib/crm/validation";
import { loadFiOsIdentity } from "@/src/lib/fiOs/fiOsIdentity.server";
import { isFiOsElevatedOsOperatorRole } from "@/src/lib/fiOs/fiOsRoles";
import { loadStaffMemberForTenant, type FiStaffRow } from "@/src/lib/staff/staff.server";
import { buildStaffComplianceSummaryFromSourceRows } from "@/src/lib/staffCompliance/staffComplianceSummary";
import type { StaffComplianceSummary } from "@/src/lib/staffCompliance/staffComplianceTypes";
import { formatStaffWeeklyHoursSummary, parseStaffWeeklyHours } from "@/src/lib/staff/staffWeeklyHours";

export type StaffTwinLinkedUser = {
  id: string;
  email: string | null;
  role: string | null;
};

export type StaffTwinSourceIdRow = {
  id: string;
  source_system: string;
  source_staff_id: string;
  source_url: string | null;
  metadata: Record<string, unknown> | null;
};

export type StaffTwinPageData = {
  tenantId: string;
  staff: FiStaffRow;
  linkedUser: StaffTwinLinkedUser | null;
  sourceIds: StaffTwinSourceIdRow[];
  /** Human-readable weekly hours summary, or empty when none configured. */
  workingHoursSummary: string;
  /** IANA timezone used for hours (staff default or Perth fallback label in summary). */
  schedulingTimezoneLabel: string;
  /** Read-only IIOHR / Academy snapshot from `fi_staff_source_ids.metadata` (not the system of record). */
  complianceSummary: StaffComplianceSummary;
};

async function loadFiUserRowForAuth(
  tenantId: string,
  authUserId: string
): Promise<{ id: string; role: string } | null> {
  const supabase = supabaseAdmin();
  const { data, error } = await supabase
    .from("fi_users")
    .select("id, role")
    .eq("tenant_id", tenantId.trim())
    .eq("auth_user_id", authUserId.trim())
    .maybeSingle();
  if (error) throw new Error(error.message);
  if (!data) return null;
  return { id: String((data as { id: string }).id), role: String((data as { role: string | null }).role ?? "member") };
}

async function canViewStaffTwin(opts: {
  tenantId: string;
  staff: FiStaffRow;
  authUserId: string;
}): Promise<boolean> {
  const os = await loadFiOsIdentity(opts.authUserId);
  if (isFiOsElevatedOsOperatorRole(os?.osRole)) {
    return true;
  }

  const fiUser = await loadFiUserRowForAuth(opts.tenantId, opts.authUserId);
  if (!fiUser) return false;

  if (isCrmStaffManageRole(fiUser.role)) {
    return true;
  }

  const linked = opts.staff.fi_user_id?.trim() || null;
  if (linked && linked === fiUser.id) {
    return true;
  }

  return false;
}

/**
 * Read-only Staff Twin payload. Returns `null` when staff is missing or the viewer may not access this row.
 */
export async function loadStaffTwinPage(tenantId: string, staffId: string): Promise<StaffTwinPageData | null> {
  const tid = assertNonEmptyUuid(tenantId, "tenantId");
  const sid = assertNonEmptyUuid(staffId, "staffId");

  const authUserId = await resolveAuthUserId(null);
  if (!authUserId?.trim()) {
    return null;
  }

  const staff = await loadStaffMemberForTenant(tid, sid);
  if (!staff) {
    return null;
  }

  const allowed = await canViewStaffTwin({ tenantId: tid, staff, authUserId });
  if (!allowed) {
    return null;
  }

  const supabase = supabaseAdmin();

  let linkedUser: StaffTwinLinkedUser | null = null;
  const uid = staff.fi_user_id?.trim();
  if (uid) {
    const { data: u, error: uErr } = await supabase
      .from("fi_users")
      .select("id, email, role")
      .eq("tenant_id", tid)
      .eq("id", uid)
      .maybeSingle();
    if (uErr) throw new Error(uErr.message);
    if (u) {
      const row = u as { id: string; email: string | null; role: string | null };
      linkedUser = {
        id: String(row.id),
        email: row.email != null ? String(row.email) : null,
        role: row.role != null ? String(row.role) : null,
      };
    }
  }

  const { data: srcRows, error: srcErr } = await supabase
    .from("fi_staff_source_ids")
    .select("id, source_system, source_staff_id, source_url, metadata")
    .eq("tenant_id", tid)
    .eq("staff_id", sid)
    .order("source_system", { ascending: true });
  if (srcErr) throw new Error(srcErr.message);

  const sourceIds: StaffTwinSourceIdRow[] = (srcRows ?? []).map((r) => {
    const x = r as {
      id: string;
      source_system: string;
      source_staff_id: string;
      source_url: string | null;
      metadata: unknown;
    };
    const md = x.metadata;
    const metadata =
      md && typeof md === "object" && !Array.isArray(md) ? (md as Record<string, unknown>) : null;
    return {
      id: String(x.id),
      source_system: String(x.source_system),
      source_staff_id: String(x.source_staff_id),
      source_url: x.source_url != null ? String(x.source_url) : null,
      metadata,
    };
  });

  const complianceSummary = buildStaffComplianceSummaryFromSourceRows(
    sourceIds.map((row) => ({ source_system: row.source_system, metadata: row.metadata }))
  );

  const weekly = parseStaffWeeklyHours(staff.working_hours);
  const workingHoursSummary = formatStaffWeeklyHoursSummary(weekly).trim();
  const schedulingTimezoneLabel =
    staff.default_timezone?.trim() || "Australia/Perth (fallback when staff timezone unset)";

  return {
    tenantId: tid,
    staff,
    linkedUser,
    sourceIds,
    workingHoursSummary,
    schedulingTimezoneLabel,
    complianceSummary,
  };
}
