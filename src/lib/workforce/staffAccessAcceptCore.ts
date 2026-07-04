/**
 * Pure Staff Access invite acceptance / tenant-link integrity helpers.
 */

export type StaffTenantLinkSnapshot = {
  staffMemberFiStaffId: string | null;
  fiStaffFiUserId: string | null;
  invitationFiStaffId: string | null;
  invitationFiUserId: string | null;
};

export type StaffTenantLinkIntegrity = {
  valid: boolean;
  staffId: string | null;
  fiUserId: string | null;
};

/** True when staff member, fi_staff, and invitation rows agree on tenant linkage. */
export function assessStaffTenantLinkIntegrity(
  snapshot: StaffTenantLinkSnapshot
): StaffTenantLinkIntegrity {
  const memberStaffId = snapshot.staffMemberFiStaffId?.trim() || null;
  const inviteStaffId = snapshot.invitationFiStaffId?.trim() || null;
  const staffId = memberStaffId ?? inviteStaffId;
  const fiStaffUserId = snapshot.fiStaffFiUserId?.trim() || null;
  const inviteUserId = snapshot.invitationFiUserId?.trim() || null;
  const fiUserId = fiStaffUserId ?? inviteUserId;

  if (!staffId || !fiUserId) {
    return { valid: false, staffId, fiUserId };
  }
  if (memberStaffId && inviteStaffId && memberStaffId !== inviteStaffId) {
    return { valid: false, staffId, fiUserId };
  }
  if (fiStaffUserId && inviteUserId && fiStaffUserId !== inviteUserId) {
    return { valid: false, staffId, fiUserId };
  }
  if (!fiStaffUserId) {
    return { valid: false, staffId, fiUserId };
  }

  return { valid: true, staffId, fiUserId };
}

export type StaffAccessAcceptAuditKind = "newly_accepted" | "repaired_after_accepted" | "idempotent";

export function resolveStaffAccessAcceptAuditKind(input: {
  alreadyAccepted: boolean;
  linkageValidBeforeRepair: boolean;
  repaired: boolean;
}): StaffAccessAcceptAuditKind {
  if (!input.alreadyAccepted) return "newly_accepted";
  if (input.linkageValidBeforeRepair) return "idempotent";
  if (input.repaired) return "repaired_after_accepted";
  return "idempotent";
}