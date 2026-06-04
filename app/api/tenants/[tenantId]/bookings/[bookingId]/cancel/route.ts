/**
 * POST /api/tenants/[tenantId]/bookings/[bookingId]/cancel
 */
import { assertCrmTenantWriteAllowed, tryResolveFiUserIdForTenant } from "@/src/lib/crm/crmGate";
import { crmJsonOk, crmJsonError, extractAdminKeyFromRequest, mapCrmRouteError } from "@/src/lib/crm/crmHttp";
import { bookingCancelBodySchema } from "@/src/lib/bookings/bookingApiSchemas";
import { cancelBooking } from "@/src/lib/bookings/server";

export const dynamic = "force-dynamic";

export async function POST(req: Request, { params }: { params: Promise<{ tenantId: string; bookingId: string }> }) {
  try {
    const { tenantId, bookingId } = await params;
    if (!tenantId?.trim() || !bookingId?.trim()) return crmJsonError(400, "Missing tenantId or bookingId.");

    const body = await req.json().catch(() => ({}));
    const adminKey = extractAdminKeyFromRequest(req, body);
    await assertCrmTenantWriteAllowed({ tenantId, adminKey, request: req });

    const parsed = bookingCancelBodySchema.parse(body);
    const cancelledByUserId = await tryResolveFiUserIdForTenant(tenantId, req);

    const booking = await cancelBooking({
      tenantId,
      bookingId,
      cancellationReason: parsed.cancellationReason ?? null,
      cancelledByUserId,
    });

    return crmJsonOk({ booking });
  } catch (e) {
    return mapCrmRouteError(e);
  }
}
