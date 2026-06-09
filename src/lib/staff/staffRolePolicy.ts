/** Default role for payroll-imported staff until an admin assigns a clinical role. */
export const NEEDS_REVIEW_STAFF_ROLE = "needs_review";

export const CLINICAL_STAFF_ROLE_OPTIONS = [
  "surgeon",
  "consultant",
  "nurse",
  "technician",
  "admin",
  "reception",
  "coordinator",
] as const;

export type ClinicalStaffRoleOption = (typeof CLINICAL_STAFF_ROLE_OPTIONS)[number];

export function isStaffRoleNeedsReview(staffRole: string | null | undefined): boolean {
  return String(staffRole ?? "").trim().toLowerCase() === NEEDS_REVIEW_STAFF_ROLE;
}

/**
 * Staff may appear in the directory but must not be assignable to clinical bookings / provider pickers
 * until a proper role replaces `needs_review`.
 */
export function isStaffBookableForClinicalWorkflow(input: {
  is_active: boolean;
  staff_role: string | null | undefined;
}): boolean {
  return Boolean(input.is_active) && !isStaffRoleNeedsReview(input.staff_role);
}

export function staffClinicalBookingBlockReason(staff: {
  full_name: string;
  is_active: boolean;
  staff_role: string | null | undefined;
}): string | null {
  if (!staff.is_active) {
    return `${staff.full_name} is inactive and cannot be assigned to clinical bookings. Reactivate them in Staff or choose another clinician.`;
  }
  if (isStaffRoleNeedsReview(staff.staff_role)) {
    return `${staff.full_name} still has role “needs review” from payroll import. Assign a clinical role in Staff before booking or assigning them as a provider.`;
  }
  return null;
}

export function assertStaffBookableForClinicalWorkflow(staff: {
  full_name: string;
  is_active: boolean;
  staff_role: string | null | undefined;
}): void {
  const reason = staffClinicalBookingBlockReason(staff);
  if (reason) throw new Error(reason);
}
