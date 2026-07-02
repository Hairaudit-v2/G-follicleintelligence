/**
 * GET  /api/tenants/[tenantId]/pathology-email-routes — list tenant inbound routes
 * POST /api/tenants/[tenantId]/pathology-email-routes — create inbound route
 */
import { z } from "zod";
import { assertCrmTenantReadAllowed, assertCrmTenantWriteAllowed } from "@/src/lib/crm/crmGate";
import {
  crmJsonError,
  crmJsonOk,
  extractAdminKeyFromRequest,
  mapCrmRouteError,
} from "@/src/lib/crm/crmHttp";
import { loadPathologyEmailRoutesForTenant } from "@/src/lib/pathology/email/pathologyEmailRoutesLoad.server";
import {
  createPathologyEmailRoute,
  PathologyEmailRouteDuplicateError,
  PathologyEmailRouteValidationError,
} from "@/src/lib/pathology/email/pathologyEmailRoutesMutations.server";

export const dynamic = "force-dynamic";

const createBodySchema = z.object({
  inbound_email: z.string().trim().min(1, "inbound_email is required."),
  source_label: z.string().trim().optional().nullable(),
  route_status: z.enum(["active", "disabled"]).optional(),
});

export async function GET(
  req: Request,
  { params }: { params: Promise<{ tenantId: string }> }
) {
  try {
    const { tenantId } = await params;
    if (!tenantId?.trim()) return crmJsonError(400, "Missing tenantId.");

    if (!process.env.NEXT_PUBLIC_SUPABASE_URL || !process.env.SUPABASE_SERVICE_ROLE_KEY) {
      return crmJsonError(500, "Server misconfigured.");
    }

    const adminKey = extractAdminKeyFromRequest(req);
    await assertCrmTenantReadAllowed({ tenantId, adminKey, request: req });

    const routes = await loadPathologyEmailRoutesForTenant(tenantId.trim());
    return crmJsonOk({ routes });
  } catch (e) {
    return mapCrmRouteError(e);
  }
}

export async function POST(
  req: Request,
  { params }: { params: Promise<{ tenantId: string }> }
) {
  try {
    const { tenantId } = await params;
    if (!tenantId?.trim()) return crmJsonError(400, "Missing tenantId.");

    if (!process.env.NEXT_PUBLIC_SUPABASE_URL || !process.env.SUPABASE_SERVICE_ROLE_KEY) {
      return crmJsonError(500, "Server misconfigured.");
    }

    const body = await req.json().catch(() => null);
    const adminKey = extractAdminKeyFromRequest(req, body);
    await assertCrmTenantWriteAllowed({ tenantId, adminKey, request: req });

    const parsed = createBodySchema.parse(body);
    const route = await createPathologyEmailRoute({
      tenantId: tenantId.trim(),
      inboundEmail: parsed.inbound_email,
      sourceLabel: parsed.source_label,
      routeStatus: parsed.route_status,
    });

    return crmJsonOk({ route }, 201);
  } catch (e) {
    if (e instanceof PathologyEmailRouteDuplicateError) {
      return crmJsonError(409, e.message);
    }
    if (e instanceof PathologyEmailRouteValidationError) {
      return crmJsonError(400, e.message);
    }
    return mapCrmRouteError(e);
  }
}
