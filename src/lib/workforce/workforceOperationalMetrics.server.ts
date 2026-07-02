import "server-only";

import type { SupabaseClient } from "@supabase/supabase-js";

import { supabaseAdmin } from "@/lib/supabaseAdmin";
import { assertNonEmptyUuid } from "@/src/lib/crm/validation";
import { loadHrSyncHealthSummary } from "@/src/lib/workforce/hrSyncAudit.server";
import { loadIdentityLinksForTenant, loadStaffMembersForReconciliation } from "@/src/lib/workforce/identityReconciliation.server";
import { loadInactiveStaffCount } from "@/src/lib/workforce/staffOffboarding.server";
import { CREDENTIAL_DUE_SOON_DAYS } from "@/src/lib/workforce/credentialExpiryCore";

export type WorkforceOperationalMetrics = {
  syncHealthPercent: number | null;
  openDuplicateCount: number;
  unlinkedStaffCount: number;
  inactiveStaffCount: number;
  offboardingQueueCount: number;
  clinicallyEligibleStaff: number;
  expiringCredentials: number;
  complianceAlerts: number;
  expiredCertifications: number;
};

const ACTIVE_STATUSES = new Set(["active", "pending_onboarding", "on_leave"]);

export async function loadWorkforceOperationalMetrics(
  tenantId: string,
  client?: SupabaseClient
): Promise<WorkforceOperationalMetrics> {
  const tid = assertNonEmptyUuid(tenantId, "tenantId");
  const supabase = client ?? supabaseAdmin();
  const now = new Date();
  const soonCutoff = new Date(now.getTime() + CREDENTIAL_DUE_SOON_DAYS * 86_400_000).toISOString();

  const [
    health,
    members,
    identityLinks,
    inactiveStaffCount,
    offboardingRes,
    expiringCredRes,
    alertsRes,
    expiredCertRes,
    activeMembersRes,
  ] = await Promise.all([
    loadHrSyncHealthSummary(tid, supabase),
    loadStaffMembersForReconciliation(tid, supabase),
    loadIdentityLinksForTenant(tid, supabase),
    loadInactiveStaffCount(tid, supabase),
    supabase
      .from("fi_staff_members")
      .select("id", { count: "exact", head: true })
      .eq("tenant_id", tid)
      .in("employment_status", ["terminated", "resigned", "contract_ended", "contract_expired"])
      .is("archived_at", null),
    supabase
      .from("fi_staff_credentials")
      .select("id", { count: "exact", head: true })
      .eq("tenant_id", tid)
      .is("archived_at", null)
      .in("status", ["expiring_soon"])
      .not("expires_at", "is", null)
      .lte("expires_at", soonCutoff),
    supabase
      .from("fi_staff_compliance_alerts")
      .select("id", { count: "exact", head: true })
      .eq("tenant_id", tid)
      .eq("resolved", false),
    supabase
      .from("fi_staff_certifications")
      .select("id", { count: "exact", head: true })
      .eq("tenant_id", tid)
      .is("archived_at", null)
      .eq("status", "expired"),
    supabase
      .from("fi_staff_members")
      .select("id, employment_status, fi_staff_id")
      .eq("tenant_id", tid)
      .eq("employment_status", "active")
      .is("archived_at", null)
      .is("merged_into", null),
  ]);

  if (offboardingRes.error) throw new Error(offboardingRes.error.message);
  if (expiringCredRes.error) throw new Error(expiringCredRes.error.message);
  if (alertsRes.error) throw new Error(alertsRes.error.message);
  if (expiredCertRes.error) throw new Error(expiredCertRes.error.message);
  if (activeMembersRes.error) throw new Error(activeMembersRes.error.message);

  const linkedMemberIds = new Set(identityLinks.map((l) => l.staffMemberId));
  const activeMembers = members.filter((m) => !m.archivedAt && !m.mergedInto);

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

  let clinicallyEligibleStaff = 0;
  const activeRows = (activeMembersRes.data ?? []) as {
    id: string;
    fi_staff_id: string | null;
  }[];

  const { data: blockingCreds } = await supabase
    .from("fi_staff_credentials")
    .select("staff_member_id")
    .eq("tenant_id", tid)
    .is("archived_at", null)
    .eq("status", "expired")
    .eq("blocks_clinical_work", true);
  const blockedMemberIds = new Set(
    ((blockingCreds ?? []) as { staff_member_id: string }[]).map((r) =>
      String(r.staff_member_id)
    )
  );

  const { data: openCriticalAlerts } = await supabase
    .from("fi_staff_compliance_alerts")
    .select("staff_member_id")
    .eq("tenant_id", tid)
    .eq("resolved", false)
    .in("severity", ["critical", "high"]);
  for (const row of openCriticalAlerts ?? []) {
    blockedMemberIds.add(String((row as { staff_member_id: string }).staff_member_id));
  }

  for (const member of activeRows) {
    if (!blockedMemberIds.has(String(member.id))) {
      clinicallyEligibleStaff += 1;
    }
  }

  return {
    syncHealthPercent,
    openDuplicateCount: health.openDuplicateCandidatesCount,
    unlinkedStaffCount: health.unlinkedActiveStaffCount,
    inactiveStaffCount,
    offboardingQueueCount: offboardingRes.count ?? 0,
    clinicallyEligibleStaff,
    expiringCredentials: expiringCredRes.count ?? 0,
    complianceAlerts: alertsRes.count ?? 0,
    expiredCertifications: expiredCertRes.count ?? 0,
  };
}