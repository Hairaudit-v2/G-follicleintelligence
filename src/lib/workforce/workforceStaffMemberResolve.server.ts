import "server-only";

import type { SupabaseClient } from "@supabase/supabase-js";

import { assertNonEmptyUuid } from "@/src/lib/crm/validation";
import {
  resolveStaffIdentity,
  toResolvedStaffMemberContext,
} from "@/src/lib/team/identity/server";

export type ResolvedStaffMemberContext = {
  staffMemberId: string;
  fiStaffId: string | null;
  employmentStatus: string;
  fullName: string | null;
};

/**
 * Resolves a lifecycle member context from either a member id or a scheduling staff id.
 *
 * @deprecated Import `resolveStaffIdentity` from "@/src/lib/team/identity/server".
 * Remove during FI-TEAM-COHESION identity consumer migration.
 */
export async function resolveStaffMemberContext(
  tenantId: string,
  staffId: string,
  client?: SupabaseClient
): Promise<ResolvedStaffMemberContext | null> {
  const tid = assertNonEmptyUuid(tenantId, "tenantId");
  const sid = assertNonEmptyUuid(staffId, "staffId");

  // Preserve legacy dual-lookup order: member id first, then fi_staff id.
  const asMember = await resolveStaffIdentity(
    { tenantId: tid, by: "staffMemberId", staffMemberId: sid },
    { client, throwOnCrossTenant: false }
  );
  const fromMember = toResolvedStaffMemberContext(asMember);
  if (fromMember) return fromMember;

  const asStaff = await resolveStaffIdentity(
    { tenantId: tid, by: "staffId", staffId: sid },
    { client, throwOnCrossTenant: false }
  );
  return toResolvedStaffMemberContext(asStaff);
}
