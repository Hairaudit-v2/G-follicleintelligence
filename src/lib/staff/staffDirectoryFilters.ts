import { isStaffRoleNeedsReview, NEEDS_REVIEW_STAFF_ROLE } from "@/src/lib/staff/staffRolePolicy";
import type { StaffHrNotificationSummary } from "@/src/lib/staff/staffHrNotificationSummary";
import { buildStaffHrNotificationNoLinkSummary } from "@/src/lib/staff/staffHrNotificationSummary";
import type { StaffPayrollSourceDisplay } from "@/src/lib/staff/staffPayrollSourceDisplay";
import type { FiStaffRow } from "@/src/lib/staff/staff.server";

export type StaffDirectoryFilterState = {
  staffRole: string | null;
  payrollOnly: boolean;
  activeFilter: "all" | "active" | "inactive";
};

export type StaffDirectoryRowView = FiStaffRow & {
  payroll: StaffPayrollSourceDisplay | null;
  hrNotification: StaffHrNotificationSummary;
  needsReview: boolean;
  payrollImported: boolean;
};

export function parseStaffDirectoryFiltersFromSearchParams(sp: {
  staff_role?: string | null;
  payroll?: string | null;
  active?: string | null;
}): StaffDirectoryFilterState {
  const staffRoleRaw = sp.staff_role?.trim() || null;
  const staffRole =
    staffRoleRaw?.toLowerCase() === NEEDS_REVIEW_STAFF_ROLE ? NEEDS_REVIEW_STAFF_ROLE : staffRoleRaw;
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

export function buildStaffDirectorySearchParams(filters: StaffDirectoryFilterState): URLSearchParams {
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
  hrNotificationByStaffId?: Record<string, StaffHrNotificationSummary | null | undefined>
): StaffDirectoryRowView[] {
  return staff.map((row) => {
    const payroll = payrollByStaffId[row.id] ?? null;
    return {
      ...row,
      payroll,
      hrNotification: hrNotificationByStaffId?.[row.id] ?? buildStaffHrNotificationNoLinkSummary(),
      needsReview: isStaffRoleNeedsReview(row.staff_role),
      payrollImported: Boolean(payroll),
    };
  });
}

export function filterStaffDirectoryRows(
  rows: StaffDirectoryRowView[],
  filters: StaffDirectoryFilterState
): StaffDirectoryRowView[] {
  return rows.filter((row) => {
    if (filters.staffRole && row.staff_role.toLowerCase() !== filters.staffRole.toLowerCase()) return false;
    if (filters.payrollOnly && !row.payrollImported) return false;
    if (filters.activeFilter === "active" && !row.is_active) return false;
    if (filters.activeFilter === "inactive" && row.is_active) return false;
    return true;
  });
}
