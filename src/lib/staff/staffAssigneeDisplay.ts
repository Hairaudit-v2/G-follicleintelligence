import type { FiBookingRow } from "@/src/lib/bookings/types";
import type { CrmShellUserPickerOption } from "@/src/lib/crm/types";

function humanizeRole(role: string | null | undefined): string {
  const t = String(role ?? "")
    .trim()
    .toLowerCase()
    .replace(/_/g, " ");
  if (!t.length) return "Staff";
  return t.replace(/\b\w/g, (c) => c.toUpperCase());
}

function userDisplayLabel(
  users: CrmShellUserPickerOption[],
  userId: string | null | undefined
): string | null {
  const uid = userId?.trim() || null;
  if (!uid) return null;
  const u = users.find((x) => x.id === uid);
  if (u?.full_name?.trim()) return u.full_name.trim();
  if (u?.email?.trim()) return u.email.trim();
  return `User ${uid.slice(0, 8)}…`;
}

function staffDisplayLabel(
  staffOptions: CrmShellUserPickerOption[],
  staffId: string | null | undefined
): string | null {
  const sid = staffId?.trim() || null;
  if (!sid) return null;
  const s = staffOptions.find((x) => x.id === sid);
  if (s) return staffOptionPrimaryLabel(s);
  return `Staff ${sid.slice(0, 8)}…`;
}

export type BookingAssignmentDisplay = {
  providerLabel: string;
  ownerLabel: string | null;
  /** Compact line for table cells and calendar chips. */
  summaryLine: string;
};

/**
 * Resolve booking assignee for display — clinical staff provider first, legacy fi_user fallback,
 * optional owner when staff and user diverge (audit / ownership).
 */
export function bookingAssignmentDisplay(
  staffOptions: CrmShellUserPickerOption[],
  userOptions: CrmShellUserPickerOption[],
  row: Pick<FiBookingRow, "assigned_staff_id" | "assigned_user_id">
): BookingAssignmentDisplay {
  const staffId = row.assigned_staff_id?.trim() || null;
  const userId = row.assigned_user_id?.trim() || null;

  let providerLabel = "Unassigned";
  let ownerLabel: string | null = null;

  if (staffId) {
    providerLabel = staffDisplayLabel(staffOptions, staffId) ?? providerLabel;
    const staff = staffOptions.find((x) => x.id === staffId);
    const linkedUserId = staff?.fi_user_id?.trim() || null;
    if (userId && userId !== linkedUserId) {
      ownerLabel = userDisplayLabel(userOptions, userId);
    }
  } else if (userId) {
    const linkedStaff = staffOptions.find((x) => x.fi_user_id?.trim() === userId);
    if (linkedStaff) {
      providerLabel = staffOptionPrimaryLabel(linkedStaff);
    } else {
      providerLabel = userDisplayLabel(userOptions, userId) ?? `User ${userId.slice(0, 8)}…`;
    }
  }

  let summaryLine = providerLabel;
  if (ownerLabel) {
    summaryLine = `Provider: ${providerLabel} · Owner: ${ownerLabel}`;
  } else if (providerLabel !== "Unassigned") {
    summaryLine = `Provider: ${providerLabel}`;
  }

  return { providerLabel, ownerLabel, summaryLine };
}

/** @deprecated Prefer {@link bookingAssignmentDisplay} — kept for calendar drawer compatibility. */
export function bookingAssigneeDisplayLabel(
  staffOptions: CrmShellUserPickerOption[],
  row: Pick<FiBookingRow, "assigned_staff_id" | "assigned_user_id">
): string {
  return bookingAssignmentDisplay(staffOptions, [], row).providerLabel;
}

export function staffOptionPrimaryLabel(s: CrmShellUserPickerOption): string {
  const name = s.full_name?.trim();
  if (name) return name;
  if (s.email?.trim()) return s.email.trim();
  return `Staff ${s.id.slice(0, 8)}…`;
}

export function staffOptionSubtitle(s: CrmShellUserPickerOption): string {
  return humanizeRole(s.staff_role);
}
