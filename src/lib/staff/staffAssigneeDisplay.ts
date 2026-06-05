import type { FiBookingRow } from "@/src/lib/bookings/types";
import type { CrmShellStaffPickerOption } from "@/src/lib/crm/types";

function humanizeRole(role: string | null | undefined): string {
  const t = String(role ?? "").trim().toLowerCase().replace(/_/g, " ");
  if (!t.length) return "Staff";
  return t.replace(/\b\w/g, (c) => c.toUpperCase());
}

/** Primary label for calendar / booking UIs (staff directory first, then legacy user id match). */
export function bookingAssigneeDisplayLabel(
  staffOptions: CrmShellStaffPickerOption[],
  row: Pick<FiBookingRow, "assigned_staff_id" | "assigned_user_id">
): string {
  const sid = row.assigned_staff_id?.trim() || null;
  if (sid) {
    const s = staffOptions.find((x) => x.id === sid);
    if (s) return s.full_name.trim() || s.email?.trim() || `Staff ${sid.slice(0, 8)}…`;
  }
  const uid = row.assigned_user_id?.trim() || null;
  if (uid) {
    const linked = staffOptions.find((x) => x.fi_user_id === uid);
    if (linked) return linked.full_name.trim() || linked.email?.trim() || `Staff ${linked.id.slice(0, 8)}…`;
    return `User ${uid.slice(0, 8)}…`;
  }
  return "Unassigned";
}

export function staffOptionPrimaryLabel(s: CrmShellStaffPickerOption): string {
  const name = s.full_name?.trim();
  if (name) return name;
  if (s.email?.trim()) return s.email.trim();
  return `Staff ${s.id.slice(0, 8)}…`;
}

export function staffOptionSubtitle(s: CrmShellStaffPickerOption): string {
  return humanizeRole(s.staff_role);
}
