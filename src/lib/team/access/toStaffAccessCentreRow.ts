/**
 * Bridge StaffAccessEntry into the legacy Staff Access Centre page DTO shape.
 * Avoid importing .server modules — keeps team/access pure for client-safe type use.
 */

import type { StaffAccessAttentionReason, StaffAccessEntry } from "@/src/lib/team/access/types";

export type StaffAccessCentreActionFlags = {
  canSendInvite: boolean;
  canResendInvite: boolean;
  canSuspendAccess: boolean;
  canRevokeAccess: boolean;
  attentionReasons: StaffAccessAttentionReason[];
};

/**
 * Overlay identity-safe action flags from the access projection onto centre-row fields.
 * Status / label fields stay sourced from the existing access-centre computation.
 */
export function applyStaffAccessEntryFlags(
  entry: StaffAccessEntry
): StaffAccessCentreActionFlags {
  return {
    canSendInvite: entry.canInvite,
    canResendInvite: entry.canResend,
    canSuspendAccess: entry.canSuspend,
    canRevokeAccess: entry.canRevoke,
    attentionReasons: entry.attentionReasons,
  };
}
