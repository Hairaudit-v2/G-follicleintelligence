/** Resolve consultant label for UI — linked staff name wins, then legacy consultant_name. */
export function resolveConsultationConsultantDisplayName(input: {
  consultant_staff_id?: string | null;
  consultant_name?: string | null;
  linkedStaffName?: string | null;
}): string | null {
  if (input.linkedStaffName?.trim()) return input.linkedStaffName.trim();
  if (input.consultant_name?.trim()) return input.consultant_name.trim();
  return null;
}
