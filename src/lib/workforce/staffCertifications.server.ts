/**
 * @deprecated Import from staffCertification.server.ts — transitional re-exports.
 */
export {
  createCertification,
  verifyCertification,
  loadCertificationHistory,
  loadExpiringCertifications,
  syncStaffCertificationStatusesForMember,
} from "@/src/lib/workforce/staffCertification.server";

import type { StaffCertificationRecord } from "@/src/lib/workforce/workforceClinicalTypes";
import {
  loadCertificationHistory,
  createCertification,
} from "@/src/lib/workforce/staffCertification.server";

/** @deprecated Use loadCertificationHistory */
export async function loadStaffCertificationsForMember(
  tenantId: string,
  staffMemberId: string,
  client?: import("@supabase/supabase-js").SupabaseClient
): Promise<
  Array<{
    id: string;
    certificationKey: string;
    certificationType: string;
    displayName: string;
    expiresAt: string | null;
    status: string;
  }>
> {
  const rows = await loadCertificationHistory(tenantId, staffMemberId, client);
  return rows.map((r: StaffCertificationRecord) => ({
    id: r.id,
    certificationKey: r.certificationKey,
    certificationType: r.certificationType ?? "clinical",
    displayName: r.certificationName,
    expiresAt: r.expiresAt,
    status: r.isExpired ? "expired" : r.isExpiringSoon ? "due_soon" : "current",
  }));
}

/** @deprecated Use createCertification */
export async function upsertStaffCertification(
  input: {
    tenantId: string;
    staffMemberId: string;
    fiStaffId?: string | null;
    certificationType: string;
    certificationKey: string;
    displayName: string;
    issuedAt?: string | null;
    completedAt?: string | null;
    expiresAt?: string | null;
    sourceSystem?: string | null;
    sourceExternalId?: string | null;
    academyCompetencyKey?: string | null;
  },
  client?: import("@supabase/supabase-js").SupabaseClient
) {
  return createCertification(
    {
      tenantId: input.tenantId,
      staffMemberId: input.staffMemberId,
      fiStaffId: input.fiStaffId,
      certificationName: input.displayName,
      certificationType: input.certificationType,
      issuedAt: input.issuedAt ?? input.completedAt,
      expiresAt: input.expiresAt,
    },
    client
  );
}