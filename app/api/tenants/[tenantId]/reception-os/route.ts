/**
 * GET /api/tenants/[tenantId]/reception-os
 * ReceptionOS live refresh payload (tenant-scoped).
 */
import { assertCrmTenantReadAllowed } from "@/src/lib/crm/crmGate";
import {
  crmJsonOk,
  crmJsonError,
  extractAdminKeyFromRequest,
  mapCrmRouteError,
} from "@/src/lib/crm/crmHttp";
import { resolveReceptionOsViewerContext } from "@/src/lib/receptionOs/receptionOsAccess.server";
import { loadReceptionOsCommandCentrePayload } from "@/src/lib/receptionOs/receptionOsCommandCentreLoader.server";

export const dynamic = "force-dynamic";

export async function GET(req: Request, { params }: { params: Promise<{ tenantId: string }> }) {
  try {
    const { tenantId } = await params;
    if (!tenantId?.trim()) return crmJsonError(400, "Missing tenantId.");

    const adminKey = extractAdminKeyFromRequest(req);
    await assertCrmTenantReadAllowed({ tenantId, adminKey, request: req });

    const viewer = await resolveReceptionOsViewerContext(tenantId.trim());
    if (!viewer.canAccessReceptionOs) {
      return crmJsonError(
        403,
        "ReceptionOS access requires an active staff or CRM shell role for this tenant."
      );
    }

    const url = new URL(req.url);
    const demoModeRequested = url.searchParams.get("demo") === "1";

    const data = await loadReceptionOsCommandCentrePayload(tenantId.trim(), new Date(), {
      demoModeRequested,
    });
    return crmJsonOk({ data });
  } catch (e) {
    return mapCrmRouteError(e);
  }
}
