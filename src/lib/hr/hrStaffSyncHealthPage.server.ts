import "server-only";

import { assertCrmTenantWriteAllowed } from "@/src/lib/crm/crmGate";
import {
  buildHrSyncEnvironmentChecklist,
  buildHrSyncHealthOverview,
  buildStaffHrSyncIssueRows,
  summarizeSyncRunRow,
  type HrStaffSyncIssueRow,
  type HrSyncHealthOverview,
  type HrSyncLatestRunSummary,
} from "@/src/lib/hr/hrStaffSyncHealthDashboard";
import { buildHrStaffAutomationStatus } from "@/src/lib/hr/hrStaffAutomationStatus";
import { buildTenantWorkforceIdentityOverview } from "@/src/lib/workforce-os/workforceIdentityTenantOverview.server";
import type { WorkforceHrSyncAuditPageModel } from "@/src/lib/workforce/hrSyncAuditPage.server";
import { loadWorkforceHrSyncAuditPageModel } from "@/src/lib/workforce/hrSyncAuditPage.server";
import { loadAllStaffForTenant } from "@/src/lib/staff/staff.server";
import { loadHrNotificationByStaffId } from "@/src/lib/staff/staffHrNotificationLoader.server";
import {
  listRecentStaffSyncRunsForTenant,
  type FiStaffSyncRunRow,
} from "@/src/lib/staffImport/iiohrHrStaffSyncRuns.server";

export type HrSyncHealthPageModel = {
  overview: HrSyncHealthOverview;
  latestRun: HrSyncLatestRunSummary;
  latestSuccessfulRun: HrSyncLatestRunSummary;
  envChecklist: ReturnType<typeof buildHrSyncEnvironmentChecklist>;
  staffIssues: HrStaffSyncIssueRow[];
  recentRuns: FiStaffSyncRunRow[];
  automationCronPath: string;
  isEvolvedPerthCronTenant: boolean;
  identityOverview: Awaited<ReturnType<typeof buildTenantWorkforceIdentityOverview>>;
  workforceAudit: WorkforceHrSyncAuditPageModel;
};

function mapRunRefs(rows: FiStaffSyncRunRow[]) {
  return rows.map((r) => ({
    status: r.status,
    started_at: r.started_at,
    finished_at: r.finished_at,
    error_message: r.error_message,
    metadata: r.metadata,
  }));
}

export async function loadHrSyncHealthPageModel(tenantId: string): Promise<HrSyncHealthPageModel> {
  const tid = tenantId.trim();
  await assertCrmTenantWriteAllowed({ tenantId: tid, request: undefined });

  const [staff, recentRuns] = await Promise.all([
    loadAllStaffForTenant(tid),
    listRecentStaffSyncRunsForTenant(tid, 50),
  ]);

  const staffIds = staff.map((s) => s.id);
  const hrByStaffId = await loadHrNotificationByStaffId(tid, staffIds);
  const staffIssues = buildStaffHrSyncIssueRows(
    staff.map((s) => ({
      id: s.id,
      full_name: s.full_name,
      email: s.email,
      is_active: s.is_active,
    })),
    hrByStaffId
  );

  const envChecklist = buildHrSyncEnvironmentChecklist((k) => process.env[k]);
  const overview = buildHrSyncHealthOverview({
    runs: recentRuns,
    staffIssueRows: staffIssues,
    envChecklist,
  });

  const latestSuccessful = recentRuns.find((r) => r.status === "success") ?? null;
  const automation = buildHrStaffAutomationStatus({
    pageTenantId: tid,
    recentRuns: mapRunRefs(recentRuns),
    getEnv: (k) => process.env[k],
  });

  const [identityOverview, workforceAudit] = await Promise.all([
    buildTenantWorkforceIdentityOverview(tid, staff),
    loadWorkforceHrSyncAuditPageModel(tid),
  ]);

  return {
    overview,
    latestRun: summarizeSyncRunRow(recentRuns[0] ?? null),
    latestSuccessfulRun: summarizeSyncRunRow(latestSuccessful),
    envChecklist,
    staffIssues,
    recentRuns: recentRuns.slice(0, 10),
    automationCronPath: automation.cronPath,
    isEvolvedPerthCronTenant: automation.evolvedPerthTenantMatchesPageTenant,
    identityOverview,
    workforceAudit,
  };
}
