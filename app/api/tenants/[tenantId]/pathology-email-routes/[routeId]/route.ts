/**
 * PATCH /api/tenants/[tenantId]/pathology-email-routes/[routeId]
 * Body JSON: { route_status: "active" | "disabled" }
 */
import { z } from "zod";
import { assertCrmTenantWriteAllowed } from "@/src/lib/crm/crmGate";
import {
  crmJsonError,
  crmJsonOk,
  extractAdminKeyFromRequest,
  mapCrmRouteError,
} from "@/src/lib/crm/crmHttp";
import {
  PathologyEmailRouteMutationNotFoundError,
  PathologyEmailRouteValidationError,
  updatePathologyEmailRouteStatus,
} from "@/src/lib/pathology/email/pathologyEmailRoutesMutations.server";

export const dynamic = "force-dynamic";

const patchBodySchema = z.object({
  route_status: z.enum(["active", "disabled"]),
});

export async function PATCH(
  req: Request,
  { params }: { params: Promise<{ tenantId: string; routeId: string }> }
) {
  try {
    const { tenantId, routeId } = await params;
    if (!tenantId?.trim()) return crmJsonError(400, "Missing tenantId.");
    if (!routeId?.trim()) return crmJsonError(400, "Missing routeId.");

    if (!process.env.NEXT_PUBLIC_SUPABASE_URL || !process.env.SUPABASE_SERVICE_ROLE_KEY) {
      return crmJsonError(500, "Server misconfigured.");
    }

    const body = await req.json().catch(() => null);
    const adminKey = extractAdminKeyFromRequest(req, body);
    await assertCrmTenantWriteAllowed({ tenantId, adminKey, request: req });

    const parsed = patchBodySchema.parse(body);
    const route = await updatePathologyEmailRouteStatus({
      tenantId: tenantId.trim(),
      routeId: routeId.trim(),
      routeStatus: parsed.route_status,
    });

    return crmJsonOk({ route });
  } catch (e) {
    if (e instanceof PathologyEmailRouteMutationNotFoundError) {
      return crmJsonError(404, e.message);
    }
    if (e instanceof PathologyEmailRouteValidationError) {
      return crmJsonError(400, e.message);
    }
    return mapCrmRouteError(e);
  }
}
