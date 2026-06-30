import type { CrmShellUserPickerOption } from "@/src/lib/crm/types";

/** Map `fi_staff.id` → linked `fi_users.id` for availability + calendar overlap checks. */
export function staffPickerUserMap(
  assignees: CrmShellUserPickerOption[]
): Map<string, string | null> {
  const m = new Map<string, string | null>();
  for (const a of assignees) {
    m.set(a.id, a.fi_user_id?.trim() || null);
  }
  return m;
}
