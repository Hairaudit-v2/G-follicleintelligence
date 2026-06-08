import "server-only";

import { assertCrmTenantWriteAllowed } from "@/src/lib/crm/crmGate";
import { resolveEvolvedHrPerthClinicForTenant } from "@/src/lib/staffImport/iiohrHrStaffImportRunner";

export type HrStaffImportPageModel = {
  hasPerthClinic: boolean;
  perthClinicDisplayName: string | null;
};

/**
 * FI Admin HR staff import page: CRM write gate + Perth clinic hint for Evolved Hair Restoration Perth imports.
 */
export async function loadHrStaffImportPageModel(tenantId: string): Promise<HrStaffImportPageModel> {
  const tid = tenantId.trim();
  await assertCrmTenantWriteAllowed({ tenantId: tid, request: undefined });
  const perth = await resolveEvolvedHrPerthClinicForTenant(tid);
  return {
    hasPerthClinic: Boolean(perth.clinicId),
    perthClinicDisplayName: perth.displayName,
  };
}
