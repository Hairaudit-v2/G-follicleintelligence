/** Controlled value for calendar toolbar clinic filter — empty string means "All locations". */
export function calendarClinicFilterSelectValue(clinicId: string | null | undefined): string {
  return clinicId?.trim() ?? "";
}

/** Controlled value for calendar toolbar staff filter — empty string means "All staff". */
export function calendarStaffFilterSelectValue(staffId: string | null | undefined): string {
  return staffId?.trim() ?? "";
}
