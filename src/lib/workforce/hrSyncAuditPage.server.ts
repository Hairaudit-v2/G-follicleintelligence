import "server-only";

import { assertCrmTenantWriteAllowed } from "@/src/lib/crm/crmGate";
import {
  loadHrSyncHealthSummary,
  loadLatestHrSyncRuns,
  type FiHrSyncRunRow,
  type HrSyncHealthSummary,
} from "@/src/lib/workforce/hrSyncAudit.server";
import { loadIdentityLinksForTenant, loadStaffMembersForReconciliation } from "@/src/lib/workforce/identityReconciliation.server";
import { supabaseAdmin } from "@/lib/supabaseAdmin";
import { assertNonEmptyUuid } from "@/src/lib/crm/validation";

export type WorkforceDuplicateCandidateRow = {
  id: string;
  staffAId: string;
  staffBId: string;
  staffAName: string;
  staffBName: string;
  similarityScore: number;
  matchEmail: boolean;
  matchName: boolean;
  status: string;
  detectedAt: string;
};

export type WorkforceUnlinkedStaffRow = {
  id: string;
  fullName: string;
  email: string | null;
  fiStaffId: string | null;
};

export type WorkforceHrSyncAuditPageModel = {
  healthSummary: HrSyncHealthSummary;
  recentRuns: FiHrSyncRunRow[];
  openDuplicates: WorkforceDuplicateCandidateRow[];
  unlinkedActiveStaff: WorkforceUnlinkedStaffRow[];
};

export async function loadWorkforceHrSyncAuditPageModel(
  tenantId: string
): Promise<WorkforceHrSyncAuditPageModel> {
  const tid = assertNonEmptyUuid(tenantId, "tenantId");
  await assertCrmTenantWriteAllowed({ tenantId: tid, request: undefined });

  const [healthSummary, recentRuns, members, identityLinks, dupRes] = await Promise.all([
    loadHrSyncHealthSummary(tid),
    loadLatestHrSyncRuns(tid, 20),
    loadStaffMembersForReconciliation(tid),
    loadIdentityLinksForTenant(tid),
    supabaseAdmin()
      .from("fi_staff_duplicate_candidates")
      .select(
        "id, staff_a_id, staff_b_id, similarity_score, match_email, match_name, status, detected_at"
      )
      .eq("tenant_id", tid)
      .eq("status", "open")
      .order("similarity_score", { ascending: false })
      .limit(25),
  ]);

  if (dupRes.error) throw new Error(dupRes.error.message);

  const nameById = new Map(members.map((m) => [m.id, m.fullName]));
  const linkedIds = new Set(identityLinks.map((l) => l.staffMemberId));

  const openDuplicates: WorkforceDuplicateCandidateRow[] = (
    (dupRes.data ?? []) as Record<string, unknown>[]
  ).map((r) => ({
    id: String(r.id),
    staffAId: String(r.staff_a_id),
    staffBId: String(r.staff_b_id),
    staffAName: nameById.get(String(r.staff_a_id)) ?? "Staff A",
    staffBName: nameById.get(String(r.staff_b_id)) ?? "Staff B",
    similarityScore: Number(r.similarity_score ?? 0),
    matchEmail: Boolean(r.match_email),
    matchName: Boolean(r.match_name),
    status: String(r.status),
    detectedAt: String(r.detected_at),
  }));

  const unlinkedActiveStaff: WorkforceUnlinkedStaffRow[] = members
    .filter((m) => !m.archivedAt && !m.mergedInto && !linkedIds.has(m.id))
    .map((m) => ({
      id: m.id,
      fullName: m.fullName,
      email: m.email,
      fiStaffId: m.fiStaffId,
    }))
    .slice(0, 50);

  return {
    healthSummary,
    recentRuns,
    openDuplicates,
    unlinkedActiveStaff,
  };
}