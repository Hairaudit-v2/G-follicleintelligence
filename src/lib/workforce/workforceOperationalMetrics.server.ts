import "server-only";

import type { SupabaseClient } from "@supabase/supabase-js";

import { supabaseAdmin } from "@/lib/supabaseAdmin";
import { assertNonEmptyUuid } from "@/src/lib/crm/validation";
import { loadHrSyncHealthSummary } from "@/src/lib/workforce/hrSyncAudit.server";
import { loadIdentityLinksForTenant, loadStaffMembersForReconciliation } from "@/src/lib/workforce/identityReconciliation.server";
import { loadInactiveStaffCount } from "@/src/lib/workforce/staffOffboarding.server";

export type WorkforceOperationalMetrics = {
  syncHealthPercent: number | null;
  openDuplicateCount: number;
  unlinkedStaffCount: number;
  inactiveStaffCount: number;
  offboardingQueueCount: number;
};

const ACTIVE_STATUSES = new Set(["active", "pending_onboarding", "on_leave"]);

export async function loadWorkforceOperationalMetrics(
  tenantId: string,
  client?: SupabaseClient
): Promise<WorkforceOperationalMetrics> {
  const tid = assertNonEmptyUuid(tenantId, "tenantId");
  const supabase = client ?? supabaseAdmin();

  const [health, members, identityLinks, inactiveStaffCount, offboardingRes] =
    await Promise.all([
      loadHrSyncHealthSummary(tid, supabase),
      loadStaffMembersForReconciliation(tid, supabase),
      loadIdentityLinksForTenant(tid, supabase),
      loadInactiveStaffCount(tid, supabase),
      supabase
        .from("fi_staff_members")
        .select("id", { count: "exact", head: true })
        .eq("tenant_id", tid)
        .in("employment_status", ["terminated", "resigned"])
        .is("archived_at", null),
    ]);

  if (offboardingRes.error) throw new Error(offboardingRes.error.message);

  const linkedMemberIds = new Set(identityLinks.map((l) => l.staffMemberId));
  const activeMembers = members.filter(
    (m) => !m.archivedAt && !m.mergedInto
  );

  const { data: statusRows, error: statusError } = await supabase
    .from("fi_staff_members")
    .select("id, employment_status")
    .eq("tenant_id", tid);
  if (statusError) throw new Error(statusError.message);

  const statusById = new Map(
    ((statusRows ?? []) as { id: string; employment_status: string }[]).map((r) => [
      String(r.id),
      String(r.employment_status ?? "active"),
    ])
  );

  const activeOperational = activeMembers.filter((m) =>
    ACTIVE_STATUSES.has((statusById.get(m.id) ?? "active").toLowerCase())
  );
  const linkedActive = activeOperational.filter((m) => linkedMemberIds.has(m.id));
  const syncHealthPercent =
    activeOperational.length > 0
      ? Math.round((linkedActive.length / activeOperational.length) * 100)
      : null;

  return {
    syncHealthPercent,
    openDuplicateCount: health.openDuplicateCandidatesCount,
    unlinkedStaffCount: health.unlinkedActiveStaffCount,
    inactiveStaffCount,
    offboardingQueueCount: offboardingRes.count ?? 0,
  };
}