import "server-only";

import { revalidatePath, revalidateTag } from "next/cache";

/** Cache tags used by {@link loadReceptionShellBootstrapCached} / calendar shell bootstrap. */
export const FI_TENANT_REFERENCE_TAG_PREFIX = "fi-tenant-";
export const FI_REFERENCE_DATA_TAG = "fi-reference-data";

/**
 * Invalidate cross-request reference-data cache and FI OS surfaces that show
 * live external inputs (calendar, CRM, reception, operations, today home).
 */
export function revalidateLiveDataSurfacesForTenant(
  tenantId: string,
  opts?: { includeIntegrationsSettings?: boolean }
): void {
  const tid = tenantId.trim();
  if (!tid) return;

  revalidateTag(`${FI_TENANT_REFERENCE_TAG_PREFIX}${tid}`, "max");
  revalidateTag(FI_REFERENCE_DATA_TAG, "max");

  const paths = [
    `/fi-admin/${tid}`,
    `/fi-admin/${tid}/calendar`,
    `/fi-admin/${tid}/reception`,
    `/fi-admin/${tid}/operations`,
    `/fi-admin/${tid}/crm`,
    `/fi-admin/${tid}/leadflow`,
    `/fi-admin/${tid}/reception-os`,
    `/fi-admin/${tid}/reception-board`,
    `/fi-admin/${tid}/onboarding-os/import-review`,
  ];

  if (opts?.includeIntegrationsSettings) {
    paths.push(`/fi-admin/${tid}/settings/integrations`);
  }

  for (const path of paths) {
    revalidatePath(path);
  }
}

/** Revalidate live-data surfaces for each tenant that had at least one processed event. */
export function revalidateLiveDataSurfacesForTenants(
  tenantSummaries: Array<{ tenant_id: string; processed: number }>
): void {
  for (const row of tenantSummaries) {
    if (row.processed > 0) {
      revalidateLiveDataSurfacesForTenant(row.tenant_id);
    }
  }
}
