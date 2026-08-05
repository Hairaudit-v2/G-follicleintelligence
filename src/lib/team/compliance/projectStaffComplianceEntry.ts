/**
 * Pure projection: StaffIdentity + existing credential/cert facts → StaffComplianceEntry.
 *
 * Adapts already-evaluated compliance results; does not recreate expiry math.
 */

import type { StaffIdentity } from "@/src/lib/team/identity/types";
import { deriveStaffComplianceActionFlags } from "@/src/lib/team/compliance/complianceActionFlags";
import { deriveStaffComplianceAttentionReasons } from "@/src/lib/team/compliance/complianceAttentionReasons";
import {
  deriveComplianceBlockers,
  summariseCertifications,
  summariseCredentials,
} from "@/src/lib/team/compliance/credentialReadinessBridge";
import type { StaffComplianceEntry } from "@/src/lib/team/compliance/types";
import type {
  StaffCertificationRecord,
  StaffCredentialRecord,
} from "@/src/lib/workforce/workforceClinicalTypes";

export type StaffComplianceProjectionFacts = {
  credentials: readonly StaffCredentialRecord[];
  certifications: readonly StaffCertificationRecord[];
  canUpload: boolean;
  canVerify: boolean;
  canReject: boolean;
  canRequestReplacement: boolean;
};

export function projectStaffComplianceEntry(
  identity: StaffIdentity,
  facts: StaffComplianceProjectionFacts
): StaffComplianceEntry {
  const credentials = summariseCredentials(facts.credentials);
  const certifications = summariseCertifications(facts.certifications);
  const complianceBlockers = deriveComplianceBlockers({ credentials, certifications });

  return {
    identity: {
      personId: identity.personKey,
      staffId: identity.staffId,
      staffMemberId: identity.staffMemberId,
      userId: identity.userId,
      integrity: identity.integrity,
    },
    credentials,
    certifications,
    readiness: {
      status: identity.readinessStatus,
      complianceBlockers,
    },
    attentionReasons: deriveStaffComplianceAttentionReasons(identity, {
      credentials,
      certifications,
    }),
    actions: deriveStaffComplianceActionFlags(identity, {
      canUpload: facts.canUpload,
      canVerify: facts.canVerify,
      canReject: facts.canReject,
      canRequestReplacement: facts.canRequestReplacement,
    }),
  };
}
