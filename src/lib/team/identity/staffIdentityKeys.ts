/**
 * Opaque person keys for StaffIdentity maps / batch results.
 */

import { STAFF_PERSON_KEY_PREFIX } from "@/src/lib/team/identity/constants";

export type StaffPersonKeyParts = {
  staffId: string | null;
  staffMemberId: string | null;
  userId?: string | null;
};

/**
 * Prefer lifecycle member id when present (HR person), else scheduling id,
 * else user id. Never invent a key when all identifiers are missing.
 */
export function buildStaffPersonKey(parts: StaffPersonKeyParts): string {
  const memberId = parts.staffMemberId?.trim() || null;
  const staffId = parts.staffId?.trim() || null;
  const userId = parts.userId?.trim() || null;
  if (memberId) return `${STAFF_PERSON_KEY_PREFIX.staffMember}:${memberId}`;
  if (staffId) return `${STAFF_PERSON_KEY_PREFIX.staff}:${staffId}`;
  if (userId) return `${STAFF_PERSON_KEY_PREFIX.user}:${userId}`;
  return STAFF_PERSON_KEY_PREFIX.invalid;
}

export function isInvalidStaffPersonKey(personKey: string): boolean {
  return personKey === STAFF_PERSON_KEY_PREFIX.invalid || !personKey.trim();
}
