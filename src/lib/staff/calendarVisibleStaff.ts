/** Pure helpers for calendar provider column visibility. */

export const CALENDAR_VISIBLE_CLINICAL_ROLES = [
  "doctor",
  "nurse",
  "technician",
  "consultant",
  "trichologist",
  "surgeon",
  "clinical_assistant",
] as const;

const NON_CALENDAR_ROLES = new Set(["reception", "admin", "coordinator", "finance", "backend"]);

export type CalendarVisibleStaffInput = {
  is_active: boolean;
  staff_role: string | null | undefined;
  /** When set, overrides role-based default visibility. */
  calendar_visible?: boolean | null;
};

export function isNonCalendarSupportRole(staffRole: string | null | undefined): boolean {
  const r = String(staffRole ?? "")
    .trim()
    .toLowerCase();
  if (!r) return false;
  if (NON_CALENDAR_ROLES.has(r)) return true;
  if (/\b(reception|receptionist|administrator|admin|finance|coordinator|backend)\b/.test(r))
    return true;
  return false;
}

export function isCalendarVisibleClinicalStaff(staff: CalendarVisibleStaffInput): boolean {
  if (!staff.is_active) return false;

  if (staff.calendar_visible === true) return true;
  if (staff.calendar_visible === false) return false;

  const role = String(staff.staff_role ?? "")
    .trim()
    .toLowerCase();
  if (!role || role === "needs_review") return false;
  if (isNonCalendarSupportRole(role)) return false;

  if (CALENDAR_VISIBLE_CLINICAL_ROLES.some((clinical) => role.includes(clinical))) return true;
  if (
    /\b(doctor|physician|nurse|technician|consultant|trichologist|surgeon|clinical assistant)\b/.test(
      role
    )
  ) {
    return true;
  }

  return false;
}
