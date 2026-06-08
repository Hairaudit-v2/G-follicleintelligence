import "server-only";

import { assertCrmTenantWriteAllowed } from "@/src/lib/crm/crmGate";
import { buildHrStaffAutomationStatus, type HrStaffAutomationStatus } from "@/src/lib/hr/hrStaffAutomationStatus";
import { resolveEvolvedHrPerthClinicForTenant } from "@/src/lib/staffImport/iiohrHrStaffImportRunner";
import { listRecentStaffSyncRunsForTenant, type FiStaffSyncRunRow } from "@/src/lib/staffImport/iiohrHrStaffSyncRuns.server";

export type HrStaffImportPageModel = {
  hasPerthClinic: boolean;
  perthClinicDisplayName: string | null;
  recentStaffSyncRuns: FiStaffSyncRunRow[];
  automation: HrStaffAutomationStatus;
};

/**
 * FI Admin HR staff import page: CRM write gate + Perth clinic hint for Evolved Hair Restoration Perth imports.
 */
export async function loadHrStaffImportPageModel(tenantId: string): Promise<HrStaffImportPageModel> {
  const tid = tenantId.trim();
  await assertCrmTenantWriteAllowed({ tenantId: tid, request: undefined });
  const [perth, recentStaffSyncRuns] = await Promise.all([
    resolveEvolvedHrPerthClinicForTenant(tid),
    listRecentStaffSyncRunsForTenant(tid, 40),
  ]);
  const automation = buildHrStaffAutomationStatus({
    pageTenantId: tid,
    recentRuns: recentStaffSyncRuns.map((r) => ({
      status: r.status,
      started_at: r.started_at,
      finished_at: r.finished_at,
      metadata: r.metadata,
    })),
    getEnv: (k) => process.env[k],
  });
  return {
    hasPerthClinic: Boolean(perth.clinicId),
    perthClinicDisplayName: perth.displayName,
    recentStaffSyncRuns,
    automation,
  };
}
