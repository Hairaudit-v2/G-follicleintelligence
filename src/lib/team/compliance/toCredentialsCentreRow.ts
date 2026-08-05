/**
 * Bridge StaffComplianceEntry into credentials-page row action overlays.
 */

import type {
  StaffComplianceAttentionReason,
  StaffComplianceEntry,
} from "@/src/lib/team/compliance/types";

export type CredentialsCentreActionFlags = {
  canUploadCredential: boolean;
  canVerifyCredential: boolean;
  canRejectCredential: boolean;
  attentionReasons: StaffComplianceAttentionReason[];
};

export function applyStaffComplianceEntryFlags(
  entry: StaffComplianceEntry
): CredentialsCentreActionFlags {
  return {
    canUploadCredential: entry.actions.canUploadCredential,
    canVerifyCredential: entry.actions.canVerifyCredential,
    canRejectCredential: entry.actions.canRejectCredential,
    attentionReasons: entry.attentionReasons,
  };
}
