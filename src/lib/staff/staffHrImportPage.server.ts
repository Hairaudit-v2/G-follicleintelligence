import "server-only";

import { assertCrmTenantWriteAllowed } from "@/src/lib/crm/crmGate";
import { resolveEvolvedHrPerthClinicForTenant } from "@/src/lib/staffImport/iiohrHrStaffImportRunner";
import { listRecentStaffSyncRunsForTenant, type FiStaffSyncRunRow } from "@/src/lib/staffImport/iiohrHrStaffSyncRuns.server";

export type HrStaffImportPageModel = {
  hasPerthClinic: boolean;
  perthClinicDisplayName: string | null;
  recentStaffSyncRuns: FiStaffSyncRunRow[];
};

/**
 * FI Admin HR staff import page: CRM write gate + Perth clinic hint for Evolved Hair Restoration Perth imports.
 */
export async function loadHrStaffImportPageModel(tenantId: string): Promise<HrStaffImportPageModel> {
  const tid = tenantId.trim();
  await assertCrmTenantWriteAllowed({ tenantId: tid, request: undefined });
  const [perth, recentStaffSyncRuns] = await Promise.all([
    resolveEvolvedHrPerthClinicForTenant(tid),
    listRecentStaffSyncRunsForTenant(tid, 5),
  ]);
  return {
    hasPerthClinic: Boolean(perth.clinicId),
    perthClinicDisplayName: perth.displayName,
    recentStaffSyncRuns,
  };
}
