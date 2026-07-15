import "server-only";

import { resolveAuthUserId } from "@/src/lib/crm/crmGate";
import { resolveDevelopmentClinicAccessForTenant } from "@/src/lib/fiOs/developmentClinicAccess.server";

/**
 * Soft CRM-write probe for HubSpot mutation UI (Sync / Approve / Reject / Import).
 * Server actions remain authoritative; this only hides controls.
 */
export async function canMutateHubspotWorkspace(tenantId: string): Promise<boolean> {
  const authUserId = await resolveAuthUserId(null);
  if (!authUserId) return false;
  const access = await resolveDevelopmentClinicAccessForTenant(tenantId, authUserId);
  return access.allowed;
}
