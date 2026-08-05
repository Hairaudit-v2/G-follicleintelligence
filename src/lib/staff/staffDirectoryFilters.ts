import { isStaffRoleNeedsReview, NEEDS_REVIEW_STAFF_ROLE } from "@/src/lib/staff/staffRolePolicy";
import type { StaffHrNotificationSummary } from "@/src/lib/staff/staffHrNotificationSummary";
import { buildStaffHrNotificationNoLinkSummary } from "@/src/lib/staff/staffHrNotificationSummary";
import type { StaffPayrollSourceDisplay } from "@/src/lib/staff/staffPayrollSourceDisplay";
import type { FiStaffRow } from "@/src/lib/staff/staff.server";
import type { StaffDirectoryAttentionReason } from "@/src/lib/team/directory";
import {
  resolveCanonicalStaffLifecycleStatus,
  isCanonicalStaffLifecycleActive,
  canonicalStaffLifecycleLabel,
  resolveStaffDuplicateGroups,
  type CanonicalStaffLifecycleStatus,
} from "@/src/lib/team/identity/staffCanonicalLifecycle";

export type StaffDirectoryFilterState = {
  staffRole: string | null;
  payrollOnly: boolean;
  activeFilter: "all" | "active" | "inactive";
};

/** HR lifecycle signal for one directory row (from canonical identity resolution). */
export type StaffDirectoryLifecycleSignal = {
  employmentStatus: string | null;
  archivedAt: string | null;
  hrLinked?: boolean;
};

export type StaffDirectoryRowView = FiStaffRow & {
  payroll: StaffPayrollSourceDisplay | null;
  hrNotification: StaffHrNotificationSummary;
  needsReview: boolean;
  payrollImported: boolean;
  /** Canonical lifecycle status combining `is_active` + HR employment status. */
  lifecycleStatus: CanonicalStaffLifecycleStatus;
  lifecycleLabel: string;
  /** The only flag the UI may use to present a row (or count it) as Active. */
  isLifecycleActive: boolean;
  /** Non-canonical duplicate of another staff record (same name/email). */
  isDuplicate: boolean;
  duplicateOfStaffId: string | null;
  /** Identity integrity attention — partial/invalid links stay visible. */
  attentionReasons: StaffDirectoryAttentionReason[];
};

export function parseStaffDirectoryFiltersFromSearchParams(sp: {
  staff_role?: string | null;
  payroll?: string | null;
  active?: string | null;
}): StaffDirectoryFilterState {
  const staffRoleRaw = sp.staff_role?.trim() || null;
  const staffRole =
    staffRoleRaw?.toLowerCase() === NEEDS_REVIEW_STAFF_ROLE
      ? NEEDS_REVIEW_STAFF_ROLE
      : staffRoleRaw;
  const payrollOnly = sp.payroll === "1" || sp.payroll === "true";
  const activeRaw = sp.active?.trim();
  const activeFilter =
    activeRaw === "1" || activeRaw === "true"
      ? "active"
      : activeRaw === "0" || activeRaw === "false"
        ? "inactive"
        : "all";
  return { staffRole, payrollOnly, activeFilter };
}

export function buildStaffDirectorySearchParams(
  filters: StaffDirectoryFilterState
): URLSearchParams {
  const q = new URLSearchParams();
  if (filters.staffRole) q.set("staff_role", filters.staffRole);
  if (filters.payrollOnly) q.set("payroll", "1");
  if (filters.activeFilter === "active") q.set("active", "1");
  if (filters.activeFilter === "inactive") q.set("active", "0");
  return q;
}

export function enrichStaffDirectoryRows(
  staff: FiStaffRow[],
  payrollByStaffId: Record<string, StaffPayrollSourceDisplay | null | undefined>,
  hrNotificationByStaffId?: Record<string, StaffHrNotificationSummary | null | undefined>,
  lifecycleByStaffId?: Record<string, StaffDirectoryLifecycleSignal | null | undefined>,
  attentionByStaffId?: Record<string, StaffDirectoryAttentionReason[] | null | undefined>
): StaffDirectoryRowView[] {
  const lifecycleStatusById = new Map<string, CanonicalStaffLifecycleStatus>(
    staff.map((row) => {
      const signal = lifecycleByStaffId?.[row.id] ?? null;
      return [
        row.id,
        resolveCanonicalStaffLifecycleStatus({
          isActive: row.is_active,
          employmentStatus: signal?.employmentStatus ?? null,
          archivedAt: signal?.archivedAt ?? null,
        }),
      ];
    })
  );

  const duplicates = resolveStaffDuplicateGroups(
    staff.map((row) => ({
      id: row.id,
      fullName: row.full_name,
      email: row.email,
      createdAt: row.created_at,
      lifecycleStatus: lifecycleStatusById.get(row.id) ?? "inactive",
      hrLinked: lifecycleByStaffId?.[row.id]?.hrLinked ?? false,
    }))
  );

  return staff.map((row) => {
    const payroll = payrollByStaffId[row.id] ?? null;
    const lifecycleStatus = lifecycleStatusById.get(row.id) ?? "inactive";
    return {
      ...row,
      payroll,
      hrNotification: hrNotificationByStaffId?.[row.id] ?? buildStaffHrNotificationNoLinkSummary(),
      needsReview: isStaffRoleNeedsReview(row.staff_role),
      payrollImported: Boolean(payroll),
      lifecycleStatus,
      lifecycleLabel: canonicalStaffLifecycleLabel(lifecycleStatus),
      isLifecycleActive: isCanonicalStaffLifecycleActive(lifecycleStatus),
      isDuplicate: duplicates.duplicateStaffIds.has(row.id),
      duplicateOfStaffId: duplicates.canonicalIdByDuplicateId.get(row.id) ?? null,
      attentionReasons: attentionByStaffId?.[row.id] ?? [],
    };
  });
}

export function filterStaffDirectoryRows(
  rows: StaffDirectoryRowView[],
  filters: StaffDirectoryFilterState
): StaffDirectoryRowView[] {
  return rows.filter((row) => {
    if (filters.staffRole && row.staff_role.toLowerCase() !== filters.staffRole.toLowerCase())
      return false;
    if (filters.payrollOnly && !row.payrollImported) return false;
    if (filters.activeFilter === "active" && !row.isLifecycleActive) return false;
    if (filters.activeFilter === "inactive" && row.isLifecycleActive) return false;
    return true;
  });
}
