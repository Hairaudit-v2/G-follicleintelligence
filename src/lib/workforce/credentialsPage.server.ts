import "server-only";

import type { SupabaseClient } from "@supabase/supabase-js";

import { supabaseAdmin } from "@/lib/supabaseAdmin";
import { assertNonEmptyUuid } from "@/src/lib/crm/validation";
import {
  applyStaffComplianceEntryFlags,
  projectStaffComplianceEntry,
  type StaffComplianceAttentionReason,
} from "@/src/lib/team/compliance";
import { resolveStaffIdentities } from "@/src/lib/team/identity/server";
import { loadStaffCredentialsForMembers } from "@/src/lib/workforce/staffCredentials.server";
import type { StaffCredentialRecord } from "@/src/lib/workforce/workforceClinicalTypes";

export type CredentialsPageStaffRow = {
  staffMemberId: string;
  fullName: string;
  email: string | null;
  credentials: StaffCredentialRecord[];
  /** Identity integrity / compliance attention — never invents credential decisions. */
  attentionReasons: StaffComplianceAttentionReason[];
  canUploadCredential: boolean;
};

/**
 * Credentials page aggregation (FI-TEAM-COHESION-B1.5).
 *
 * Query budget:
 * 1. one lifecycle members load
 * 2. one `resolveStaffIdentities({ by: "staffMemberId" })` batch
 * 3. one credentials `.in(staff_member_id)` batch
 *
 * No per-person identity or credential query loop.
 */
export async function loadCredentialsPageModel(
  tenantId: string,
  options?: { canManage?: boolean; client?: SupabaseClient }
): Promise<{
  staffRows: CredentialsPageStaffRow[];
}> {
  const tid = assertNonEmptyUuid(tenantId, "tenantId");
  const supabase = options?.client ?? supabaseAdmin();
  const canManage = options?.canManage !== false;

  const { data: members, error } = await supabase
    .from("fi_staff_members")
    .select("id, full_name, email")
    .eq("tenant_id", tid)
    .eq("employment_status", "active")
    .is("archived_at", null)
    .is("merged_into", null)
    .order("full_name");
  if (error) throw new Error(error.message);

  const memberRows = (members ?? []) as { id: string; full_name: string; email: string | null }[];
  const memberIds = memberRows.map((m) => String(m.id));

  const [identityBatch, credentialsByMember] = await Promise.all([
    resolveStaffIdentities(
      {
        tenantId: tid,
        by: "staffMemberId",
        staffMemberIds: memberIds,
      },
      { client: supabase }
    ),
    loadStaffCredentialsForMembers(tid, memberIds, supabase),
  ]);

  const staffRows: CredentialsPageStaffRow[] = [];
  for (const row of memberRows) {
    const mid = String(row.id);
    const identity = identityBatch.byKey.get(mid) ?? null;
    const credentials = credentialsByMember.get(mid) ?? [];

    const domainCanUpload = canManage;
    const entry = identity
      ? projectStaffComplianceEntry(identity, {
          credentials,
          certifications: [],
          canUpload: domainCanUpload,
          canVerify: domainCanUpload,
          canReject: domainCanUpload,
          canRequestReplacement: domainCanUpload,
        })
      : null;
    const flags = entry
      ? applyStaffComplianceEntryFlags(entry)
      : {
          canUploadCredential: false,
          canVerifyCredential: false,
          canRejectCredential: false,
          attentionReasons: ["identity_invalid"] as StaffComplianceAttentionReason[],
        };

    staffRows.push({
      staffMemberId: mid,
      fullName: String(row.full_name ?? identity?.displayName ?? "Staff"),
      email: row.email ?? identity?.email ?? null,
      credentials,
      attentionReasons: flags.attentionReasons,
      canUploadCredential: flags.canUploadCredential,
    });
  }

  return { staffRows };
}
