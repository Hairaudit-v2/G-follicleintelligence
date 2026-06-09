/**
 * Pure helpers for operational calendar staff/user resource columns.
 */

import type { ParsedCalendarQuery } from "@/src/lib/bookings/calendarQuery";
import type { FiBookingRow } from "@/src/lib/bookings/types";
import type { CrmShellUserPickerOption } from "@/src/lib/crm/types";
import type { ClinicalStaffPickerOption } from "@/src/lib/staff/clinicalStaffPicker";
import { staffOptionPrimaryLabel, staffOptionSubtitle } from "@/src/lib/staff/staffAssigneeDisplay";
import {
  resourceColumnIdForBooking,
  type BusinessGridConfig,
} from "@/src/lib/calendar/operationalCalendarLayout";
import type { CalendarResourceView } from "@/src/lib/bookings/calendarQuery";
import type { OperationalCalendarResourceColumn } from "@/src/lib/calendar/operationalCalendarTypes";

export type StaffUserLinkIndex = {
  staffIdByUserId: Map<string, string>;
  userIdByStaffId: Map<string, string | null>;
};

export function buildStaffUserLinkIndex(
  staff: Array<Pick<CrmShellUserPickerOption, "id" | "fi_user_id">>
): StaffUserLinkIndex {
  const staffIdByUserId = new Map<string, string>();
  const userIdByStaffId = new Map<string, string | null>();
  for (const s of staff) {
    const sid = s.id?.trim();
    if (!sid) continue;
    const uid = s.fi_user_id?.trim() || null;
    userIdByStaffId.set(sid, uid);
    if (uid) staffIdByUserId.set(uid, sid);
  }
  return { staffIdByUserId, userIdByStaffId };
}

export function legacyUserColumnId(userId: string): string {
  return `u:${userId.trim()}`;
}

export function staffColumnId(staffId: string): string {
  return `s:${staffId.trim()}`;
}

/** Map legacy `u:{fi_user_id}` to `s:{staff_id}` when the user is linked to staff. */
export function resolveUserColumnToStaffColumnId(
  userId: string,
  staffIdByUserId: Map<string, string>
): string | null {
  const uid = userId.trim();
  if (!uid) return null;
  const sid = staffIdByUserId.get(uid);
  return sid ? staffColumnId(sid) : null;
}

/** Highlight / quick-create column from URL filters — prefers staff, resolves linked users. */
export function calendarFilterColumnId(
  query: Pick<ParsedCalendarQuery, "staffId" | "assignedUserId">,
  staffIdByUserId: Map<string, string>
): string | undefined {
  if (query.staffId?.trim()) return staffColumnId(query.staffId.trim());
  if (query.assignedUserId?.trim()) {
    const resolved = resolveUserColumnToStaffColumnId(query.assignedUserId, staffIdByUserId);
    return resolved ?? legacyUserColumnId(query.assignedUserId);
  }
  return undefined;
}

export type NormalizedCalendarStaffFilter = {
  query: ParsedCalendarQuery;
  /** True when `assignedUserId` was upgraded to `staffId` (canonical URL should use staffId). */
  shouldCanonicalizeToStaffId: boolean;
};

/** When legacy assignedUserId maps to linked staff, normalize filter to staffId. */
export function normalizeCalendarStaffFilter(
  query: ParsedCalendarQuery,
  staffIdByUserId: Map<string, string>
): NormalizedCalendarStaffFilter {
  if (query.staffId?.trim()) return { query, shouldCanonicalizeToStaffId: false };
  const uid = query.assignedUserId?.trim();
  if (!uid) return { query, shouldCanonicalizeToStaffId: false };
  const sid = staffIdByUserId.get(uid);
  if (!sid) return { query, shouldCanonicalizeToStaffId: false };
  return {
    query: { ...query, staffId: sid, assignedUserId: null },
    shouldCanonicalizeToStaffId: true,
  };
}

export type ColumnPrefillAssignment = {
  assignedStaffId: string;
  /** Legacy owner-only column — no linked staff. */
  legacyOwnerUserId: string;
};

export function columnPrefillAssignment(
  columnId: string | undefined,
  staffIdByUserId: Map<string, string>
): ColumnPrefillAssignment {
  const col = columnId?.trim() ?? "";
  if (col.startsWith("s:")) {
    return { assignedStaffId: col.slice(2), legacyOwnerUserId: "" };
  }
  if (col.startsWith("u:")) {
    const uid = col.slice(2);
    const sid = staffIdByUserId.get(uid);
    if (sid) return { assignedStaffId: sid, legacyOwnerUserId: "" };
    return { assignedStaffId: "", legacyOwnerUserId: uid };
  }
  return { assignedStaffId: "", legacyOwnerUserId: "" };
}

export function staffColumnReadinessMeta(
  staff: ClinicalStaffPickerOption | CrmShellUserPickerOption
): Pick<OperationalCalendarResourceColumn, "clinicallyAvailable" | "readinessWarning"> {
  const readiness = (staff as ClinicalStaffPickerOption).clinical_readiness;
  if (!readiness) return { clinicallyAvailable: true, readinessWarning: null };
  return {
    clinicallyAvailable: readiness.clinically_available,
    readinessWarning: readiness.clinically_available
      ? readiness.warning_label
      : readiness.block_reason ?? readiness.warning_label,
  };
}

export function buildStaffResourceColumns(
  calendarStaff: ClinicalStaffPickerOption[]
): OperationalCalendarResourceColumn[] {
  return calendarStaff.map((s) => ({
    id: staffColumnId(String(s.id)),
    kind: "fi_staff" as const,
    label: staffOptionPrimaryLabel(s),
    subtitle: staffOptionSubtitle(s),
    staffId: String(s.id),
    ...staffColumnReadinessMeta(s),
  }));
}

export function buildLegacyUserResourceColumns(input: {
  userAssignees: CrmShellUserPickerOption[];
  staffIdByUserId: Map<string, string>;
  bookings: FiBookingRow[];
  filterUserId?: string | null;
}): OperationalCalendarResourceColumn[] {
  const userIds = new Set<string>();
  const filterUid = input.filterUserId?.trim();
  if (filterUid && !input.staffIdByUserId.has(filterUid)) userIds.add(filterUid);

  for (const b of input.bookings) {
    const uid = b.assigned_user_id?.trim();
    if (!uid || b.assigned_staff_id?.trim()) continue;
    if (input.staffIdByUserId.has(uid)) continue;
    userIds.add(uid);
  }

  const cols: OperationalCalendarResourceColumn[] = [];
  for (const uid of Array.from(userIds)) {
    const u = input.userAssignees.find((x) => x.id === uid);
    const label =
      u?.full_name?.trim() || u?.email?.trim() || `User ${uid.slice(0, 8)}…`;
    cols.push({
      id: legacyUserColumnId(uid),
      kind: "fi_user",
      label,
      subtitle: "Owner / user",
      legacyUserId: uid,
      clinicallyAvailable: true,
      readinessWarning: null,
    });
  }
  return cols.sort((a, b) => a.label.localeCompare(b.label));
}

export function assigneeMetaFromResourceColumnId(
  columnId: string,
  staffIdByUserId: Map<string, string>
): { assignedStaffId?: string | null; assignedUserId?: string | null; clinicId?: string | null } {
  if (columnId.startsWith("s:")) {
    return { assignedStaffId: columnId.slice(2) };
  }
  if (columnId.startsWith("u:")) {
    const uid = columnId.slice(2);
    const sid = staffIdByUserId.get(uid);
    if (sid) return { assignedStaffId: sid };
    return { assignedUserId: uid, assignedStaffId: null };
  }
  if (columnId.startsWith("c:")) {
    return { assignedStaffId: null, clinicId: columnId.slice(2) };
  }
  if (columnId === "unassigned") {
    return { assignedStaffId: null, clinicId: null };
  }
  return {};
}

/** Re-export with staff-user alignment for day/month column placement. */
export function operationalResourceColumnIdForBooking(
  b: FiBookingRow,
  opts?: { resourceView?: CalendarResourceView; staffIdByUserId?: Map<string, string> }
): string {
  return resourceColumnIdForBooking(b, opts);
}

export type { BusinessGridConfig };
