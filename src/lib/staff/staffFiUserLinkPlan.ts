/**
 * Pure planner for linking fi_staff rows (with email, no fi_user_id) to fi_users.
 * No database I/O — callers load snapshots and execute separately.
 */

export type StaffFiUserLinkCandidate = {
  staffId: string;
  fullName: string;
  email: string;
  fiUserId: string | null;
};

export type StaffFiUserLinkExistingUser = {
  id: string;
  email: string | null;
  tenantId: string;
};

export type StaffFiUserLinkActionKind = "link_existing_user" | "create_user_and_link" | "skip_no_email" | "skip_already_linked";

export type StaffFiUserLinkPlanRow = {
  staffId: string;
  fullName: string;
  email: string;
  action: StaffFiUserLinkActionKind;
  matchedUserId: string | null;
  matchedUserEmail: string | null;
  createUserEmail: string | null;
};

export type StaffFiUserLinkPlanResult = {
  rows: StaffFiUserLinkPlanRow[];
  unlinkedBefore: number;
  unlinkedAfter: number;
  selectedCount: number;
  linkableCount: number;
};

export function normalizeStaffLinkEmail(email: string | null | undefined): string | null {
  if (email == null) return null;
  const t = email.trim();
  if (!t) return null;
  return t.toLowerCase();
}

export function buildEmailToFiUserMap(users: StaffFiUserLinkExistingUser[]): Map<string, StaffFiUserLinkExistingUser> {
  const out = new Map<string, StaffFiUserLinkExistingUser>();
  for (const u of users) {
    const key = normalizeStaffLinkEmail(u.email);
    if (!key || out.has(key)) continue;
    out.set(key, u);
  }
  return out;
}

export function listUnlinkedStaffWithEmail(staff: StaffFiUserLinkCandidate[]): StaffFiUserLinkCandidate[] {
  return staff.filter((s) => !s.fiUserId?.trim() && normalizeStaffLinkEmail(s.email));
}

export function planStaffFiUserLinks(input: {
  staff: StaffFiUserLinkCandidate[];
  users: StaffFiUserLinkExistingUser[];
  selectedStaffIds: string[];
  tenantId: string;
}): StaffFiUserLinkPlanResult {
  const tid = input.tenantId.trim();
  const selected = new Set(input.selectedStaffIds.map((id) => id.trim()).filter(Boolean));
  const emailToUser = buildEmailToFiUserMap(input.users.filter((u) => u.tenantId.trim() === tid));
  const unlinked = listUnlinkedStaffWithEmail(input.staff.filter((s) => s.staffId.trim()));

  const rows: StaffFiUserLinkPlanRow[] = unlinked.map((s) => {
    const emailKey = normalizeStaffLinkEmail(s.email)!;
    const displayEmail = s.email.trim();
    const matched = emailToUser.get(emailKey) ?? null;
    if (matched) {
      return {
        staffId: s.staffId,
        fullName: s.fullName,
        email: displayEmail,
        action: "link_existing_user" as const,
        matchedUserId: matched.id,
        matchedUserEmail: matched.email?.trim() || displayEmail,
        createUserEmail: null,
      };
    }
    return {
      staffId: s.staffId,
      fullName: s.fullName,
      email: displayEmail,
      action: "create_user_and_link" as const,
      matchedUserId: null,
      matchedUserEmail: null,
      createUserEmail: displayEmail,
    };
  });

  const selectedRows = rows.filter((r) => selected.has(r.staffId));
  const linkableCount = rows.length;
  const selectedLinkCount = selectedRows.length;

  return {
    rows,
    unlinkedBefore: linkableCount,
    unlinkedAfter: Math.max(0, linkableCount - selectedLinkCount),
    selectedCount: selectedLinkCount,
    linkableCount,
  };
}
